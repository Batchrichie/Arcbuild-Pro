import { readFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const envText = await readFile('.env', 'utf8')
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => line.split('=', 2)))
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } })

const { data, error } = await supabase
  .from('journal_entries')
  .select('id,entry_number,entry_date,status,source_type')
  .order('created_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('Query failed:', error)
  process.exit(1)
}
console.log('Journal entries sample:')
console.dir(data, { depth: null })
