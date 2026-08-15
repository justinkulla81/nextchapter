'use server'

import { lookupCompliancePack, type CompliancePackResult } from '@/lib/employer/outplacement-compliance'

export async function lookupCompliancePackAction(
  _prevState: CompliancePackResult | undefined,
  formData: FormData
): Promise<CompliancePackResult> {
  const email = (formData.get('email') as string | null) ?? ''
  const reason = (formData.get('reason') as string | null) ?? ''
  return lookupCompliancePack(email, reason)
}
