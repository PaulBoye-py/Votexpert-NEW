// backend/src/routes/payment.ts

import { Router, Request, Response } from 'express'
import axios from 'axios'
import crypto from 'crypto'
import { PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { db, Tables } from '../lib/db/client'

export const paymentRouter = Router()

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
const CLIENT_URL = process.env.CLIENT_URL ?? 'https://votexpert.online'

// ─── POST /payment/initialize ─────────────────────────────────────────────────
// Initialize a Paystack transaction and return the authorization URL
paymentRouter.post('/initialize', requireAuth, async (req: Request, res: Response) => {
  try {
    const { email, amount, plan, org_id } = req.body

    if (!email)   return send.badRequest(res, 'email is required')
    if (!amount)  return send.badRequest(res, 'amount is required')
    if (!plan)    return send.badRequest(res, 'plan is required')
    if (!org_id)  return send.badRequest(res, 'org_id is required')

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // convert Naira to kobo
        currency: 'NGN',
        callback_url: `${CLIENT_URL}/admin/payment-success`,
        metadata: {
          plan,
          org_id,
          custom_fields: [
            { display_name: 'Plan',   variable_name: 'plan',   value: plan },
            { display_name: 'Org ID', variable_name: 'org_id', value: org_id },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const { authorization_url, access_code, reference } = response.data.data

    send.ok(res, { authorization_url, access_code, reference })
  } catch (err) {
    send.serverError(res, err)
  }
})

// ─── GET /payment/verify/:reference ──────────────────────────────────────────
// Verify a Paystack transaction using its reference
paymentRouter.get('/verify/:reference', requireAuth, async (req: Request, res: Response) => {
  try {
    const { reference } = req.params

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const data = response.data.data

    if (data.status !== 'success') {
      return send.badRequest(res, 'Payment was not successful')
    }

    const { metadata, amount, customer } = data
    const plan   = metadata?.plan
    const org_id = metadata?.org_id

    // Persist only if this reference hasn't already been recorded (webhook may have beaten us)
    const existing = await db.send(new QueryCommand({
      TableName: Tables.PAYMENTS,
      IndexName: 'reference-index',
      KeyConditionExpression: '#ref = :ref',
      ExpressionAttributeNames: { '#ref': 'reference' },
      ExpressionAttributeValues: { ':ref': reference },
      Limit: 1,
    }))

    if (!existing.Items?.length) {
      await Promise.all([
        db.send(new PutCommand({
          TableName: Tables.PAYMENTS,
          Item: {
            payment_id: uuid(),
            org_id,
            plan,
            amount:     amount / 100, // store in Naira
            reference,
            email:      customer.email,
            paid_at:    new Date().toISOString(),
            source:     'verify',
          },
        })),
        db.send(new UpdateCommand({
          TableName: Tables.ORGS,
          Key: { org_id },
          UpdateExpression: 'SET #plan = :plan, plan_activated_at = :activated_at',
          ExpressionAttributeNames: { '#plan': 'plan' },
          ExpressionAttributeValues: {
            ':plan':         plan,
            ':activated_at': new Date().toISOString(),
          },
        })),
      ])
    }

    send.ok(res, {
      success:   true,
      plan,
      org_id,
      amount:    amount / 100,
      reference,
      email:     customer.email,
    })
  } catch (err) {
    send.serverError(res, err)
  }
})

// ─── POST /payment/webhook ────────────────────────────────────────────────────
// Paystack webhook — called directly by Paystack after every transaction
// This is a backup in case the user closes the browser before being redirected
paymentRouter.post('/webhook', async (req: Request, res: Response) => {
  // Process fully before responding — in Lambda, any async work after res.send()
  // is abandoned when serverless-express resolves its promise on response end.
  try {
    const signature = req.headers['x-paystack-signature'] as string

    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex')

    if (hash !== signature) {
      return res.sendStatus(200)
    }

    const event = req.body

    if (event.event === 'charge.success') {
      const { reference, metadata, amount, customer } = event.data
      const plan   = metadata?.plan
      const org_id = metadata?.org_id

      if (plan && org_id) {
        // Idempotency: skip if verify endpoint already recorded this reference
        const existing = await db.send(new QueryCommand({
          TableName: Tables.PAYMENTS,
          IndexName: 'reference-index',
          KeyConditionExpression: '#ref = :ref',
          ExpressionAttributeNames: { '#ref': 'reference' },
          ExpressionAttributeValues: { ':ref': reference },
          Limit: 1,
        }))

        if (!existing.Items?.length) {
          await Promise.all([
            db.send(new PutCommand({
              TableName: Tables.PAYMENTS,
              Item: {
                payment_id: uuid(),
                org_id,
                plan,
                amount:     amount / 100,
                reference,
                email:      customer?.email ?? '',
                paid_at:    new Date().toISOString(),
                source:     'webhook',
              },
            })),
            db.send(new UpdateCommand({
              TableName: Tables.ORGS,
              Key: { org_id },
              UpdateExpression: 'SET #plan = :plan, plan_activated_at = :activated_at',
              ExpressionAttributeNames: { '#plan': 'plan' },
              ExpressionAttributeValues: {
                ':plan':         plan,
                ':activated_at': new Date().toISOString(),
              },
            })),
          ])
        }
      }
    }

    res.sendStatus(200)
  } catch (err) {
    console.error('Webhook processing error:', err)
    res.sendStatus(200) // always 200 so Paystack stops retrying
  }
})