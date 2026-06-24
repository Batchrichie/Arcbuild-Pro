/**
 * Extract a human-readable message from Supabase / PostgreSQL errors.
 * Prefers DB trigger RAISE messages over raw PostgREST payloads.
 */
export function parseDbError(err, rpcData = null) {
  if (rpcData && rpcData.success === false && rpcData.error) {
    return String(rpcData.error)
  }

  if (!err) return 'An unexpected error occurred.'
  if (typeof err === 'string') return err

  const raw = err.message || err.error_description || err.details || err.hint || ''

  if (!raw) return 'An unexpected error occurred.'

  // Closed-period trigger messages (e.g. PERIOD_CLOSED or readable prose)
  if (/PERIOD_CLOSED|closed period|period is closed|accounting period.*closed/i.test(raw)) {
    const cleaned = raw
      .replace(/^.*?(PERIOD_CLOSED:\s*)/i, '')
      .replace(/^ERROR:\s*/i, '')
      .replace(/^new row violates row-level security policy for table.*$/i, '')
      .trim()
    if (cleaned && cleaned.length > 10) return cleaned
  }

  // Standard PostgreSQL RAISE EXCEPTION format
  const raiseMatch = raw.match(/ERROR:\s*(.+?)(?:\nCONTEXT:|$)/i)
  if (raiseMatch?.[1]) {
    return raiseMatch[1].trim()
  }

  return raw
}
