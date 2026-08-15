import type { OutplacementRole } from '@prisma/client'

// Plain labels — deliberately NOT server-only, so client components (e.g.
// InviteOrgUserForm, the team-invite form) can import them without pulling
// in outplacement-org-users.ts's server-only DB/email logic. Same split as
// src/lib/constants/plan-catalog.ts vs. src/lib/admin/plan-catalog.ts.
export const ORG_ROLE_LABEL: Record<OutplacementRole, string> = {
  ADMIN: 'an admin (enrollment, billing, all reporting)',
  VIEWER: 'a viewer (reporting only)',
  LEGAL: 'legal (compliance pack only)',
  FINANCE: 'finance (invoices only)',
}
