import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { hasPermission } from '@/lib/permissions'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'AUDIT_LOG_VIEW')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = {
    host: process.env.SMTP_HOST ?? null,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? null,
    hasPass: !!process.env.SMTP_PASS,
    from: process.env.FROM_EMAIL ?? null,
  }

  if (!config.host || !config.user || !config.hasPass) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      error: 'SMTP_NOT_CONFIGURED',
      missing: [!config.host && 'SMTP_HOST', !config.user && 'SMTP_USER', !config.hasPass && 'SMTP_PASS'].filter(Boolean),
      config: { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from },
    })
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: process.env.SMTP_PASS },
  })

  // Step 1: verify the connection
  try {
    await transporter.verify()
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return NextResponse.json({
      ok: false,
      stage: 'verify',
      error,
      config: { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from },
      fix: error.includes('BadCredentials') || error.includes('535') || error.includes('Username and Password')
        ? 'SMTP credentials rejected. For Gmail, you must use an App Password (not your regular password). Go to: myaccount.google.com → Security → 2-Step Verification → App Passwords → create one for "Mail / Other" and update SMTP_PASS on Vercel.'
        : error.includes('ECONNREFUSED') || error.includes('ETIMEDOUT')
          ? `Cannot reach ${config.host}:${config.port}. Check SMTP_HOST and SMTP_PORT.`
          : 'SMTP connection failed. Check all SMTP_* environment variables.',
    })
  }

  // Step 2: send test email to the logged-in admin
  const to = session.user.email
  const body = {
    to,
    subject: `[Trustiva Setu LMS] SMTP Test — ${new Date().toISOString()}`,
    html: `<p>SMTP connection verified. This test email was sent from <strong>${config.from ?? config.user}</strong> via <strong>${config.host}:${config.port}</strong>.</p><p>If you received this, email delivery is working correctly.</p>`,
  }
  try {
    await transporter.sendMail({ from: config.from ?? config.user!, ...body })
    return NextResponse.json({
      ok: true,
      stage: 'sent',
      message: `Test email sent to ${to}`,
      config: { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from },
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return NextResponse.json({
      ok: false,
      stage: 'send',
      error,
      config: { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from },
    })
  }
}
