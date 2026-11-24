/**
 * Generic (role) mailboxes: info@, jobs@, hr@ and the like. They reach whoever reads the shared inbox, not a person, so the CRM never
 * keeps one (owner, 2026-11-24) and layoff outreach never emails one. Pure, so both the Prisma extension and the outreach rules use it.
 */
const ROLE_LOCALS = new Set([
  'info', 'information', 'contact', 'contactus', 'hello', 'hi', 'support', 'help', 'admin', 'administrator', 'office', 'team', 'jobs', 'job', 'careers',
  'career', 'hr', 'humanresources', 'recruiting', 'recruitment', 'recruiter', 'talent', 'sales', 'marketing', 'service', 'services', 'webmaster',
  'general', 'inquiries', 'enquiries', 'mail', 'noreply', 'no-reply', 'donotreply', 'reception', 'customerservice', 'feedback', 'press', 'media',
  'billing', 'accounts', 'payroll', 'benefits', 'events', 'news', 'communications', 'rapidresponse', 'workforce', 'employment',
])

export const localPart = (email: string) => email.trim().toLowerCase().split('@')[0] ?? ''
export const isRoleAddress = (email: string) => ROLE_LOCALS.has(localPart(email).replace(/[._-]/g, '')) || ROLE_LOCALS.has(localPart(email))
