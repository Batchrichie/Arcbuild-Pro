import { assertEquals, assertMatch, assertNotEquals } from 'https://deno.land/std@0.214.0/testing/asserts.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.test('generate_employee_number returns valid EMP-0001 style strings', async () => {
  const { data, error } = await supabase.rpc('generate_employee_number')
  assertEquals(error, null)
  assertMatch(data as string, /^EMP-\d{4}$/)
})

Deno.test('generate_employee_number returns distinct values for sequential calls', async () => {
  const { data: first, error: firstError } = await supabase.rpc('generate_employee_number')
  const { data: second, error: secondError } = await supabase.rpc('generate_employee_number')
  assertEquals(firstError, null)
  assertEquals(secondError, null)
  assertMatch(first as string, /^EMP-\d{4}$/)
  assertMatch(second as string, /^EMP-\d{4}$/)
  assertNotEquals(first, second)
})
