import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function validateEmail(email: any) {
  return typeof email === 'string' && email.includes('@')
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const email = (body.email || '').toString().trim().toLowerCase()
    const name = (body.name || '').toString().trim()
    const client_id = body.client_id || null

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing email' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Prepare metadata for profile trigger
    const userMeta = { role: 'client', client_id, full_name: name }

    // Invite the user via Supabase Admin invite API
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: userMeta,
      redirectTo: 'https://arcbuildpro.vercel.app/auth/callback',
    })

    if (inviteError) {
      // Handle common 'unique constraint' or 'user exists' cases gracefully
      const msg = inviteError.message || String(inviteError)
      if (msg.toLowerCase().includes('already')) {
        return new Response(JSON.stringify({ error: 'User with this email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const createdUser = inviteData?.user ?? null
    const userId = createdUser?.id ?? null

    // Ensure a profiles row exists for this user (trigger normally creates it, but be defensive)
    if (userId) {
      const { data: existingProfile, error: fetchProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchProfileError) {
        console.warn('Failed to check profile for new user:', fetchProfileError.message || fetchProfileError)
      }

      if (!existingProfile) {
        const { error: insertProfileError } = await supabase.from('profiles').insert({ user_id: userId, role: 'client', full_name: name })
        if (insertProfileError) {
          // If this fails, log and continue — the trigger may still run later
          console.warn('Failed to create profile for invited user:', insertProfileError.message || insertProfileError)
        }
      }
    }

    // Send a branded welcome email using resend helper (non-sensitive)
    const subject = 'Welcome to ARCBUILD PRO — Portal access granted'
    const html = `
      <div style="font-family: sans-serif; max-width:600px; margin:0 auto;">
        <div style="background:#F59E0B;padding:18px;border-radius:8px 8px 0 0;color:#111;font-weight:700;">ARCBUILD PRO</div>
        <div style="background:#0F1724;padding:20px;color:#F8FAFC;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 12px 0;">Hello ${name || 'there'},</p>
          <p style="margin:0 0 12px 0;">You have been invited to access the ARCBUILD PRO client portal. Use the link in the invitation email to set your password and complete account setup. If you don't see the invitation, check your spam folder.</p>
          <p style="margin:0 0 12px 0;">If you have any questions, reply to this message.</p>
          <p style="color:#94A3B8;font-size:13px;margin-top:12px;">This email confirms the portal access request for <strong>${email}</strong>.</p>
        </div>
      </div>
    `

    try {
      await sendEmail({ to: email, subject, html })
    } catch (e) {
      console.warn('resend error:', e instanceof Error ? e.message : String(e))
      // Non-fatal — we still return success because Supabase already sent the invite email
    }

    return new Response(JSON.stringify({ success: true, user: { id: userId, email } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('invite-user error:', message)
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
