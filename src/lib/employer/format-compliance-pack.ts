// Pure formatting — deliberately NOT server-only, so the compliance page
// (a Client Component, for the "Download as text file" button) can format
// the SAME pack data the server already returned without re-fetching or
// duplicating the shape. The actual DB read stays in
// outplacement-compliance.ts (server-only, employer_legal-gated); this file
// only turns already-authorized data into text.
export interface CompliancePack {
  orgName: string
  programBrandName: string | null
  cohortLabel: string | null
  tier: string
  invitedEmail: string
  invitedName: string | null
  enrollmentMethod: string
  status: string
  enrolledAt: Date
  activatedAt: Date | null
  deactivatedAt: Date | null
  placedAt: Date | null
  termStartAt: Date
  termEndAt: Date
  poReference: string | null
  invoiceReference: string | null
  generatedAt: Date
  generatedByEmail: string
}

export function formatCompliancePackText(pack: CompliancePack): string {
  const fmt = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—')
  return [
    'NEXTCHAPTER OUTPLACEMENT — COMPLIANCE RECORD',
    '='.repeat(48),
    '',
    `Employer:            ${pack.orgName}${pack.programBrandName ? ` (${pack.programBrandName})` : ''}`,
    `Cohort:              ${pack.cohortLabel ?? '—'}`,
    `Tier:                ${pack.tier}`,
    '',
    `Individual:          ${pack.invitedName ?? '(name not on file)'}`,
    `Email:               ${pack.invitedEmail}`,
    `Enrollment method:   ${pack.enrollmentMethod}`,
    '',
    `Contract term:       ${fmt(pack.termStartAt)} to ${fmt(pack.termEndAt)}`,
    `PO reference:        ${pack.poReference ?? '—'}`,
    `Invoice reference:   ${pack.invoiceReference ?? '—'}`,
    '',
    `Enrollment date:     ${fmt(pack.enrolledAt)}`,
    `Activation date:     ${fmt(pack.activatedAt)}`,
    `Deactivation date:   ${fmt(pack.deactivatedAt)}`,
    `Placement recorded:  ${fmt(pack.placedAt)}`,
    `Current status:      ${pack.status}`,
    '',
    '-'.repeat(48),
    'This record confirms the outplacement benefit described above was',
    'made available and, where dated, activated/placed for this individual.',
    'It contains no job-search activity, assessment, or engagement detail —',
    'those are never shared outside the individual and their coach.',
    '',
    `Generated: ${new Date(pack.generatedAt).toISOString()}`,
  ].join('\n')
}
