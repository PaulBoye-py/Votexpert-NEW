import nodemailer from 'nodemailer'

// Nodemailer transporter.
// In development/staging: uses Mailtrap (captures emails, never sends them).
// In production: uses Gmail SMTP.
// Switch by setting NODE_ENV=production and providing Gmail credentials.
function createTransporter() {
  const host = process.env.SMTP_HOST!
  const port = parseInt(process.env.SMTP_PORT ?? '2525', 10)
  const user = process.env.SMTP_USER!
  const pass = process.env.SMTP_PASS!

  return nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
    // Gmail requires secure: true on port 465, false on port 587/2525
    secure: port === 465,
  })
}

const transporter = createTransporter()

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  await transporter.sendMail({
    from: `"VoteXpert" <${process.env.EMAIL_FROM}>`,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  })
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function inviteEmailHtml(opts: {
  electionTitle: string
  orgName: string
  inviteUrl: string
  expiresAt: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #1a1a1a;">You've been invited to vote</h2>
      <p><strong>${opts.orgName}</strong> has invited you to participate in the election:</p>
      <h3 style="color: #2563eb;">${opts.electionTitle}</h3>
      <p>Click the button below to cast your vote. This link is unique to you — do not share it.</p>
      <a
        href="${opts.inviteUrl}"
        style="
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          margin: 16px 0;
        "
      >
        Cast My Vote
      </a>
      <p style="color: #666; font-size: 14px;">
        This link expires on ${new Date(opts.expiresAt).toLocaleDateString('en-GB', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}.
      </p>
      <p style="color: #666; font-size: 14px;">
        If you did not expect this email, you can safely ignore it.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">Powered by VoteXpert</p>
    </body>
    </html>
  `
}
