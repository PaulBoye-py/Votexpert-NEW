import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../lib/db/client'
import { Org } from '../types'

// Fetches Cognito's public signing keys to verify JWT signatures.
// Cached so we don't hit the JWKS endpoint on every request.
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600_000, // 10 minutes
  rateLimit: true,
})

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(header.kid!, (err, key) => {
      if (err) return reject(err)
      resolve(key!.getPublicKey())
    })
  })
}

// Verifies the Cognito JWT, looks up the org, and attaches it to req.org.
// Use this middleware on any route that requires an authenticated org admin.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          getSigningKey(header)
            .then((key) => callback(null, key))
            .catch(callback)
        },
        {
          algorithms: ['RS256'],
          issuer: `https://cognito-idp.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com/${process.env.USER_POOL_ID}`,
        },
        (err, payload) => {
          if (err) reject(err)
          else resolve(payload as jwt.JwtPayload)
        }
      )
    })

    const sub = decoded.sub
    if (!sub) {
      res.status(401).json({ success: false, error: 'Invalid token' })
      return
    }

    // Look up the org by Cognito user sub via GSI
    const result = await db.send(
      new QueryCommand({
        TableName: Tables.ORGS,
        IndexName: 'cognito-sub-index',
        KeyConditionExpression: 'cognito_user_id = :sub',
        ExpressionAttributeValues: { ':sub': sub },
        Limit: 1,
      })
    )

    const org = result.Items?.[0] as Org | undefined
    if (!org) {
      res.status(401).json({ success: false, error: 'Organization not found' })
      return
    }

    req.org = org
    next()
  } catch (err) {
    console.error('[Auth]', err)
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}
