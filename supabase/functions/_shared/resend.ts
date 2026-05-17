const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'alerts@arcbuildpro.com'

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo,
    }),
  })

  return response.ok
}
