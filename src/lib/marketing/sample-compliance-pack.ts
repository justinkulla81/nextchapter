// Synthetic compliance-pack text for the public /employers page — Partners
// Master Build Script §C3.3 ("a sample compliance pack"). This calls the
// REAL formatting function the employer portal uses
// (formatCompliancePackText in src/lib/employer/format-compliance-pack.ts,
// deliberately not server-only so it can be shared like this) against a
// fully invented contract/individual so the shape and wording shown here is
// exactly what a real employer_legal user sees — never real candidate data
// on a public page.
import { formatCompliancePackText, type CompliancePack } from '@/lib/employer/format-compliance-pack'

export const SAMPLE_COMPLIANCE_PACK: CompliancePack = {
  orgName: 'Meridian Health',
  programBrandName: 'Meridian Career Transition',
  cohortLabel: 'Q3 2026 RIF — Corporate',
  tier: 'PLUS',
  invitedEmail: 'sample.individual@example.com',
  invitedName: 'A. Sample',
  enrollmentMethod: 'Bulk CSV enrollment',
  status: 'PLACED',
  enrolledAt: new Date('2026-03-03'),
  activatedAt: new Date('2026-03-05'),
  deactivatedAt: null,
  placedAt: new Date('2026-06-18'),
  termStartAt: new Date('2026-03-01'),
  termEndAt: new Date('2026-09-01'),
  poReference: 'PO-48213',
  invoiceReference: 'INV-2026-0311',
  generatedAt: new Date('2026-08-14'),
  generatedByEmail: 'legal@meridianhealth.example',
}

export const SAMPLE_COMPLIANCE_PACK_TEXT = formatCompliancePackText(SAMPLE_COMPLIANCE_PACK)
