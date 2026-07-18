import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const PERMISSION_MATRIX = {
  ceo: ['admin', 'ceo', 'accountant', 'project_manager', 'hr_manager', 'employee', 'client'],
  admin: ['accountant', 'project_manager', 'hr_manager', 'employee', 'client'],
  hr_manager: ['employee', 'client'],
  accountant: [],
  project_manager: [],
  employee: [],
  client: [],
}

const ALLOWED_CALLER_ROLES = Object.keys(PERMISSION_MATRIX)

const REDIRECT_TO = 'https://arcbuildpro.vercel.app/auth/callback'

// Rows that exist in `roles` but are never valid invite targets (service/test rows)
const NON_INVITABLE_ROLES = ['system', 'security_test_role']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function validateEmail(email: any) {
  return typeof email === 'string' && email.includes('@')
}

export function sanitizeInviteUserPayload(body: any, callerRole: string) {
  const employeeNumber = typeof body.employee_number === 'string' ? body.employee_number.trim() : ''

  return {
    ...body,
    employee_number: (callerRole === 'admin' || callerRole === 'ceo')
      ? (employeeNumber || null)
      : null,
  }
}

export async function inviteUserHandler(req: Request) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- Caller authorization check ---
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: callerData, error: callerError } = await supabase.auth.getUser(token)
    if (callerError || !callerData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', callerData.user.id)
      .maybeSingle()

    if (callerProfileError || !callerProfile || !ALLOWED_CALLER_ROLES.includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions to invite users' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // --- End authorization check ---

    const body = await req.json().catch(() => ({}))
    const sanitizedBody = sanitizeInviteUserPayload(body, callerProfile.role)
    const email = (sanitizedBody.email || '').toString().trim().toLowerCase()
    const name = (sanitizedBody.name || '').toString().trim()
    // Default to 'client' when role is omitted — preserves existing caller behavior exactly
    const role = (sanitizedBody.role || 'client').toString().trim().toLowerCase()
    const client_id = sanitizedBody.client_id || null
    const employee_id = sanitizedBody.employee_id || null

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- Validate role against the live `roles` table (profiles.role has a FK to roles.name) ---
    const { data: roleRows, error: rolesError } = await supabase.from('roles').select('name')
    if (rolesError) {
      return new Response(JSON.stringify({ error: 'Failed to validate role: ' + rolesError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const validRoleNames = (roleRows ?? []).map((r: any) => r.name)
    if (!validRoleNames.includes(role) || NON_INVITABLE_ROLES.includes(role)) {
      return new Response(JSON.stringify({
        error: `Invalid role '${role}'. Must be one of: ${validRoleNames.filter((r: string) => !NON_INVITABLE_ROLES.includes(r)).join(', ')}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!PERMISSION_MATRIX[callerProfile.role]?.includes(role)) {
      return new Response(JSON.stringify({
        error: `You do not have permission to create an account with role: ${role}`,
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // --- End role validation ---

    // Prepare metadata for profile trigger — client path keeps client_id, staff path keeps employee_id.
    // NOTE: neither client_id nor employee_id is read by the DB triggers themselves — actual linking
    // happens via email match inside link_profile_to_record(). These ride along for visibility only.
    const userMeta = role === 'client'
      ? { role: 'client', client_id, full_name: name }
      : { role, employee_id, full_name: name }

    // Invite the user via Supabase Admin invite API
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: userMeta,
      redirectTo: REDIRECT_TO,
    })

    if (inviteError) {
      // DIAGNOSTIC (v8, kept as-is): surface the raw GoTrue error directly instead of rewriting it.
      console.error('invite-user: raw inviteUserByEmail error', {
        message: inviteError.message,
        status: inviteError.status,
        name: inviteError.name,
        code: (inviteError as any).code ?? null,
      })

      return new Response(JSON.stringify({
        diagnostic: true,
        error: inviteError.message,
        status: inviteError.status,
        code: (inviteError as any).code ?? null,
        name: inviteError.name ?? null,
      }), { status: inviteError.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        // Use the actual requested role, not a hardcoded 'client' — generalized for the employee path
        const { error: insertProfileError } = await supabase.from('profiles').insert({ user_id: userId, role, full_name: name })
        if (insertProfileError) {
          console.warn('Failed to create profile for invited user:', insertProfileError.message || insertProfileError)
        }
      }
    }

    // Send a branded welcome email using resend helper (non-sensitive)
    const subject = role === 'client'
      ? 'Welcome to ARCBUILD PRO — Portal access granted'
      : 'Welcome to ARCBUILD PRO — Staff account created'
    const html = `
      <div style="font-family: sans-serif; max-width:600px; margin:0 auto;">
        <div style="background:#F59E0B;padding:18px;border-radius:8px 8px 0 0;color:#111;font-weight:700;">ARCBUILD PRO</div>
        <div style="background:#0F1724;padding:20px;color:#F8FAFC;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 12px 0;">Hello ${name || 'there'},</p>
          <p style="margin:0 0 12px 0;">You have been invited to access the ARCBUILD PRO ${role === 'client' ? 'client portal' : 'staff system'}. Use the link in the invitation email to set your password and complete account setup. If you don't see the invitation, check your spam folder.</p>
          <p style="margin:0 0 12px 0;">If you have any questions, reply to this message.</p>
          <p style="color:#94A3B8;font-size:13px;margin-top:12px;">This email confirms the access request for <strong>${email}</strong>.</p>
        </div>
      </div>
    `

    try {
      await sendEmail({ to: email, subject, html })
    } catch (e) {
      console.warn('resend error:', e instanceof Error ? e.message : String(e))
      // Non-fatal — we still return success because Supabase already sent the invite email
    }

    return new Response(JSON.stringify({ success: true, user: { id: userId, email, role } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('invite-user error:', message)
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
}

if (import.meta.main) {
  Deno.serve(inviteUserHandler)
}
