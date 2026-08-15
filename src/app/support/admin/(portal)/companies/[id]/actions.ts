'use server'

import { requireAdmin } from '@/lib/admin/auth'
import { logAdminAccess, validateAdminAccessReason } from '@/lib/admin/access-log'
import { getNervousEmployeeDisplay, type NervousEmployeeDisplay } from '@/lib/companies/nervous-employee-panel'
import { captureServerEvent } from '@/lib/posthog/server'

// The only sanctioned way to read the nervous-employee panel's data
// (Part C Prompt 7, guardrail 3: "Every view of this panel is logged... with
// a required reason"). The panel component never calls
// getNervousEmployeeDisplay directly — only through this Server Action, so
// there is exactly one code path that can produce a real view, and it's the
// one that always logs first.
export interface ViewNervousEmployeePanelResult {
  ok: boolean
  error?: string
  data?: NervousEmployeeDisplay
}

export async function viewNervousEmployeePanel(companyId: string, reason: string): Promise<ViewNervousEmployeePanelResult> {
  const admin = await requireAdmin()

  const validReason = validateAdminAccessReason(reason)
  if (!validReason) {
    return { ok: false, error: 'A reason is required to view this data.' }
  }

  // Logged BEFORE the data is read, not after — a failed/aborted read after
  // this point still leaves an honest record that the admin asked to see it.
  await logAdminAccess({
    adminEmail: admin.email!,
    viewedCompanyId: companyId,
    surface: 'admin/companies/[id]/nervous-employee-panel',
    reason: validReason,
  })

  captureServerEvent(admin.email ?? 'admin', 'admin_nervous_employee_panel_viewed', { companyId })

  const data = await getNervousEmployeeDisplay(companyId)
  return { ok: true, data }
}
