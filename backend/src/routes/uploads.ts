import { Router, Request, Response } from 'express'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'

export const uploadsRouter = Router()

uploadsRouter.use(requireAuth)

// POST /uploads/presign
// Returns a presigned S3 PUT URL + the public file URL.
// The frontend uploads directly to S3, then saves the fileUrl on the candidate.
uploadsRouter.post('/presign', async (req: Request, res: Response) => {
  try {
    const { filename, contentType } = req.body as { filename?: string; contentType?: string }
    if (!filename || !contentType) return send.badRequest(res, 'filename and contentType are required')

    const bucket = process.env.UPLOADS_BUCKET
    if (!bucket) return send.serverError(res, new Error('UPLOADS_BUCKET not configured'))

    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const key = `candidates/${uuid()}.${ext}`

    const s3 = new S3Client({})
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })
    const fileUrl = `https://${bucket}.s3.amazonaws.com/${key}`

    send.ok(res, { uploadUrl, fileUrl })
  } catch (err) { send.serverError(res, err) }
})
