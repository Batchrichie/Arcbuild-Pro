// Role invite options for caller-side dropdowns.
// Keep these values in sync with PERMISSION_MATRIX in supabase/functions/invite-user/index.ts
// The backend is the source of truth for actual permission enforcement.
export const ROLE_INVITE_OPTIONS = {
  ceo: ['admin', 'ceo', 'accountant', 'project_manager', 'hr_manager', 'client'],
  admin: ['accountant', 'project_manager', 'hr_manager', 'client'],
}

export const ROLE_LABELS = {
  admin: 'Admin',
  ceo: 'CEO',
  accountant: 'Accountant',
  project_manager: 'Project Manager',
  hr_manager: 'HR Manager',
  client: 'Client',
}
