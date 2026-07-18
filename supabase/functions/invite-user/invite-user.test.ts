import { assertEquals, assertMatch } from 'https://deno.land/std@0.214.0/testing/asserts.ts'
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts'

// A small utility to load the invite-user function handler. This file assumes it is named index.ts.
const module = await import('./index.ts')
const handler = module.default || module
const sanitizeInviteUserPayload = module.sanitizeInviteUserPayload

function makeRequest(role: string, body: Record<string, unknown>) {
  const token = `Bearer test-${role}`
  return new Request('http://localhost', {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

Deno.test('HR manager cannot create admin account', async () => {
  const response = await handler(makeRequest('hr_manager', { email: 'hr-admin@example.com', role: 'admin', name: 'HR Admin' }))
  assertEquals(response.status, 403)
  const body = JSON.parse(await response.text())
  assertMatch(body.error, /You do not have permission to create an account with role: admin/)
})

Deno.test('HR manager can create employee account', async () => {
  const response = await handler(makeRequest('hr_manager', { email: 'hr-employee@example.com', role: 'employee', name: 'HR Employee' }))
  assertEquals(response.status, 200)
})

Deno.test('Admin cannot create CEO account', async () => {
  const response = await handler(makeRequest('admin', { email: 'admin-ceo@example.com', role: 'ceo', name: 'Admin CEO' }))
  assertEquals(response.status, 403)
  const body = JSON.parse(await response.text())
  assertMatch(body.error, /You do not have permission to create an account with role: ceo/)
})

Deno.test('Admin can create hr_manager account', async () => {
  const response = await handler(makeRequest('admin', { email: 'admin-hr@example.com', role: 'hr_manager', name: 'Admin HR' }))
  assertEquals(response.status, 200)
})

Deno.test('CEO can create any role', async () => {
  const response = await handler(makeRequest('ceo', { email: 'ceo-admin@example.com', role: 'admin', name: 'CEO Admin' }))
  assertEquals(response.status, 200)
})

Deno.test('Accountant cannot create any account', async () => {
  const response = await handler(makeRequest('accountant', { email: 'acct-employee@example.com', role: 'employee', name: 'Acct Employee' }))
  assertEquals(response.status, 403)
  const body = JSON.parse(await response.text())
  assertMatch(body.error, /You do not have permission to create an account with role: employee/)
})

Deno.test('HR manager cannot override employee_number when inviting an employee', async () => {
  const response = await handler(makeRequest('hr_manager', {
    email: 'hr-override@example.com',
    role: 'employee',
    name: 'HR Override',
    employee_number: 'EMP-9999',
  }))
  assertEquals(response.status, 200)
  const body = JSON.parse(await response.text())
  assertEquals(body.success, true)
  assertEquals(body.user?.role, 'employee')
})

Deno.test('Admin can override employee_number when inviting an employee', async () => {
  const response = await handler(makeRequest('admin', {
    email: 'admin-override@example.com',
    role: 'employee',
    name: 'Admin Override',
    employee_number: 'EMP-1234',
  }))
  assertEquals(response.status, 200)
  const body = JSON.parse(await response.text())
  assertEquals(body.success, true)
  assertEquals(body.user?.role, 'employee')
})

Deno.test('sanitizeInviteUserPayload strips employee_number for HR manager payloads', () => {
  const payload = sanitizeInviteUserPayload({ employee_number: 'EMP-9999' }, 'hr_manager')
  assertEquals(payload.employee_number, null)
})

Deno.test('sanitizeInviteUserPayload allows employee_number for admin payloads', () => {
  const payload = sanitizeInviteUserPayload({ employee_number: 'EMP-1234' }, 'admin')
  assertEquals(payload.employee_number, 'EMP-1234')
})
