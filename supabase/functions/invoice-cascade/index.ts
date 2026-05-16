import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYSTEM_ACTOR_ID = Deno.env.get('SYSTEM_ACTOR_ID')!

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    const oldRecord = payload.old_record

    if (!record || record.status !== 'approved' || oldRecord?.status === 'approved') {
      return new Response(JSON.stringify({ message: 'Not an approval event, skipping' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const invoiceId = record.id
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: journalResult, error: journalError } = await supabase.rpc('post_invoice_journal', {
      invoice_uuid: invoiceId,
      actor_uuid: SYSTEM_ACTOR_ID,
    })

    if (journalError || !journalResult?.success) {
      const errMsg = journalError?.message || journalResult?.error || 'Unknown journal posting error'
      console.error('Journal posting failed:', errMsg)
      return new Response(JSON.stringify({ success: false, error: errMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: transitionResult, error: transitionError } = await supabase.rpc('transition_invoice_status', {
      invoice_uuid: invoiceId,
      new_status: 'sent',
      acting_user_id: SYSTEM_ACTOR_ID,
      rejection_reason: null,
    })

    if (transitionError || !transitionResult?.success) {
      const errMsg = transitionError?.message || transitionResult?.error || 'Unknown transition error'
      console.error('Status transition to SENT failed:', errMsg)
      return new Response(JSON.stringify({ success: false, error: errMsg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('PDF generation: stubbed — will be implemented in Phase 5')
    console.log('Email dispatch: stubbed — will be implemented in Phase 5')

    return new Response(JSON.stringify({
      success: true,
      journal_entry_id: journalResult.journal_entry_id,
      total_posted_ghs: journalResult.total_posted_ghs,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Cascade Edge Function error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
