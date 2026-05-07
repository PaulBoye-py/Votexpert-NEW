// backend/src/routes/payment.ts

import { Router, Request, Response } from 'express'
import axios from 'axios'
import crypto from 'crypto'
import { PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { db, Tables } from '../lib/db/client'
import { generateReceiptPDF } from '../lib/pdf/receiptGenerator'
import { sendEmail, paymentReceiptEmailHtml } from '../lib/email/mailer'

export const paymentRouter = Router()

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
const CLIENT_URL = process.env.CLIENT_URL ?? 'https://votexpert.online'
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET || 'votexpert-media'

const s3 = new S3Client({})

// ─── Helper: Generate and upload receipt ──────────────────────────────────────
async function generateAndUploadReceipt(
  payment: any,
  org_id: string
): Promise<{ url?: string; pdfBuffer?: Buffer }> {
  try {
    // Fetch org details for receipt
    const orgResult = await db.send(
      new GetCommand({
        TableName: Tables.ORGS,
        Key: { org_id },
      })
    )

    if (!orgResult.Item) {
      console.warn(`Org ${org_id} not found for receipt generation`)
      return {}
    }

    const org = orgResult.Item as any
    const pdfBuffer = await generateReceiptPDF(payment, {
      org_id,
      org_name: org.org_name || 'Unknown Organization',
      email: org.email,
    })

    const key = `receipts/${org_id}/${payment.reference}.pdf`
    await s3.send(
      new PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    )

    return {
      url: `https://${UPLOADS_BUCKET}.s3.amazonaws.com/${key}`,
      pdfBuffer,
    }
  } catch (err) {
    console.error('Receipt generation/upload failed:', err)
    return {}
  }
}

// ─── Helper: Send receipt email ────────────────────────────────────────────────
async function sendReceiptEmail(payment: any, pdfBuffer?: Buffer): Promise<void> {
  if (!pdfBuffer) return

  try {
    const planName = payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1).replace(/_/g, ' ')
    const date = new Date(payment.paid_at).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    await sendEmail({
      to: payment.email,
      subject: `Payment Receipt - ${payment.reference}`,
      html: paymentReceiptEmailHtml({
        planName,
        amount: `₦${payment.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
        reference: payment.reference,
        date,
        orgName: 'VoteXpert',
      }),
      attachments: [
        {
          filename: `receipt-${payment.reference}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  } catch (err) {
    console.error('Receipt email send failed:', err)
  }
}

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
    console.log('[Payment Verify] Starting verification for reference:', reference)

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const data = response.data.data
    console.log('[Payment Verify] Paystack response status:', data.status)

    if (data.status !== 'success') {
      return send.badRequest(res, 'Payment was not successful')
    }

    const { metadata, amount, customer } = data
    const plan   = metadata?.plan
    const org_id = metadata?.org_id
    console.log('[Payment Verify] Plan:', plan, 'Org ID:', org_id)

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
      const paymentRecord = {
        payment_id: uuid(),
        org_id,
        plan,
        amount:     amount / 100, // store in Naira
        reference,
        email:      customer.email,
        paid_at:    new Date().toISOString(),
        source:     'verify' as const,
      }

      // Generate and upload receipt
      const receipt = await generateAndUploadReceipt(paymentRecord, org_id)
      if (receipt.url) {
        (paymentRecord as any).receipt_url = receipt.url
      }

      await Promise.all([
        db.send(new PutCommand({
          TableName: Tables.PAYMENTS,
          Item: paymentRecord,
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
        sendReceiptEmail(paymentRecord, receipt.pdfBuffer),
      ])
    }

    console.log('[Payment Verify] Payment verified and saved successfully')
    send.ok(res, {
      plan,
      org_id,
      amount:    amount / 100,
      reference,
      email:     customer.email,
    })
  } catch (err) {
    console.error('[Payment Verify] Error:', err)
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
          const paymentRecord = {
            payment_id: uuid(),
            org_id,
            plan,
            amount:     amount / 100,
            reference,
            email:      customer?.email ?? '',
            paid_at:    new Date().toISOString(),
            source:     'webhook' as const,
          }

          // Generate and upload receipt
          const receipt = await generateAndUploadReceipt(paymentRecord, org_id)
          if (receipt.url) {
            (paymentRecord as any).receipt_url = receipt.url
          }

          await Promise.all([
            db.send(new PutCommand({
              TableName: Tables.PAYMENTS,
              Item: paymentRecord,
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
            sendReceiptEmail(paymentRecord, receipt.pdfBuffer),
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

// ─── GET /payment/history ───────────────────────────────────────────────────────
// Get payment history for the authenticated org
paymentRouter.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const org_id = (req as any).org?.org_id

    if (!org_id) {
      return send.badRequest(res, 'Organization ID not found')
    }

    const result = await db.send(
      new QueryCommand({
        TableName: Tables.PAYMENTS,
        IndexName: 'org-payments-index',
        KeyConditionExpression: 'org_id = :org_id',
        ExpressionAttributeValues: { ':org_id': org_id },
        ScanIndexForward: false, // newest first
      })
    )

    send.ok(res, result.Items || [])
  } catch (err) {
    send.serverError(res, err)
  }
})