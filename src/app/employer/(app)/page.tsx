import { prisma } from '@/lib/prisma'
import { getCurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { getSeatUtilization } from '@/lib/employer/outplacement-reporting'
import { PROGRAM_TYPE_LABEL, PROGRAM_TYPE_HOME } from '@/lib/employer/program-type'
import { PRIVACY_NOTE } from '@/lib/employer/program-wording'
import { firstName, PortalHomeHeader, PortalHomeMore, PortalLinks, PortalNeeds, PortalTable, type NeedsItem } from '@/components/partners/PortalHome'
import { OrgHomeHero } from '@/components/partners/OrgHomeHero'
import { brandOwnerKey, readEmployerBrand } from '@/lib/employer/brand'
import { readProgramSettings } from '@/lib/employer/program-settings'

const TIER_LABEL: Record<string, string> = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' }
const ROLE_LINE: Record<string, string> = {
  ADMIN: 'You can enroll people, see billing and read the reports.',
  VIEWER: 'You can read the reports.',
  LEGAL: 'You can look up compliance records.',
  FINANCE: 'You can see invoices.',
}

// The employer Home (the portal Home pattern, src/components/partners/PortalHome.tsx). Two small reads added for the splash:
// the org's company link and program logo, and its EmployerBrand row.
// Counts only, with small groups suppressed (getSeatUtilization), as on the reporting page.
export default async function EmployerOverviewPage() {
  const orgUser = await getCurrentOutplacementOrgUser()
  const name = firstName(orgUser.fullName)
  const title = name ? `Welcome back, ${name}` : 'Welcome back'

  if (orgUser.role === 'LEGAL' || orgUser.role === 'FINANCE') {
    const legal = orgUser.role === 'LEGAL'
    return (
      <div className="space-y-8">
        <PortalHomeHeader
          portal="employer"
          eyebrow={orgUser.orgName}
          title={title}
          intro={ROLE_LINE[orgUser.role]}
          action={legal ? { href: '/employer/compliance', label: 'Look up a compliance record' } : { href: '/employer/invoices', label: 'View invoices' }}
        />
      </div>
    )
  }

  const contracts = await prisma.outplacementContract.findMany({
    where: { orgId: orgUser.orgId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  const [utilizations, org] = await Promise.all([
    Promise.all(contracts.map((c) => getSeatUtilization(orgUser, c.id))),
    prisma.outplacementEmployerOrg.findUnique({ where: { id: orgUser.orgId }, select: { companyId: true, programSettings: true } }),
  ])
  const brand = await readEmployerBrand(brandOwnerKey({ companyId: org?.companyId ?? null, outplacementOrgId: orgUser.orgId })!)
  const programLogo = readProgramSettings(org?.programSettings).brand.logoUrl ?? null
  const isAdmin = orgUser.role === 'ADMIN'
  const rows = contracts.map((c, i) => ({ c, util: utilizations[i] }))
  const reportable = rows.filter((r) => r.util && !r.util.suppressed && r.util.totalSeats !== null && r.util.activatedSeats !== null)
  const totalSeats = reportable.reduce((s, r) => s + (r.util!.totalSeats ?? 0), 0)
  const activated = reportable.reduce((s, r) => s + (r.util!.activatedSeats ?? 0), 0)
  const label = (c: (typeof contracts)[number]) => c.cohortLabel ?? `${PROGRAM_TYPE_LABEL[c.programType]}, ${TIER_LABEL[c.tier]}`

  const needs: NeedsItem[] = [
    ...(contracts.length === 0
      ? [{ key: 'no_contract', title: 'No active contract yet', why: 'Your NextChapter contact sets it up. Once it is in place you can enroll people here.', href: 'mailto:support@launchyournextchapter.com', action: 'Email NextChapter' }]
      : []),
    ...reportable
      .filter((r) => (r.util!.activatedSeats ?? 0) < (r.util!.totalSeats ?? 0))
      .map((r) => {
        const waiting = (r.util!.totalSeats ?? 0) - (r.util!.activatedSeats ?? 0)
        return {
          key: 'seats_not_activated',
          title: `${label(r.c)}: ${waiting} ${waiting === 1 ? 'person has' : 'people have'} not activated their seat`,
          why: isAdmin ? 'Check their email addresses on the roster, or send the invitation again.' : 'Your admin can check the roster and resend invitations.',
          href: isAdmin ? '/employer/roster' : '/employer/reporting',
          action: isAdmin ? 'Open the roster' : 'Open reporting',
        }
      }),
  ]

  return (
    <div className="space-y-8">
      <PortalHomeHeader
        portal="employer"
        eyebrow={orgUser.orgName}
        title={title}
        intro={
          totalSeats > 0
            ? `${activated} of ${totalSeats} people have activated their seat. ${needs.length === 0 ? 'Nothing needs you right now.' : ''}`.trim()
            : ROLE_LINE[orgUser.role]
        }
        action={isAdmin && contracts.length > 0 ? { href: '/employer/enroll', label: 'Enroll people' } : { href: '/employer/reporting', label: 'Open reporting' }}
      />

      {/* The company's splash (owner decision 2026-11-17): its office, logo and product, with the three seat numbers that used
          to sit in their own row. Admins edit it on the Program page. */}
      <div className="space-y-2">
        <OrgHomeHero
          name={orgUser.orgName}
          line={brand?.productName ? `${orgUser.orgName} · ${brand.productName}` : orgUser.orgName}
          tagline={brand?.tagline ?? null}
          imageUrl={brand?.officeImageUrl ?? null}
          logoUrl={brand?.logoUrl ?? programLogo}
          inset={brand?.productImageUrl ? { url: brand.productImageUrl, label: brand.productName ?? 'Our product' } : null}
          placeholder="office"
          edit={isAdmin ? { brandingHref: '/employer/program#home-picture', readOnly: false } : null}
          stats={[
            { value: totalSeats > 0 ? String(totalSeats) : '—', label: 'Seats', note: totalSeats > 0 ? `Across ${contracts.length === 1 ? 'your contract' : `${contracts.length} contracts`}` : 'Shown once a contract has enough seats to report' },
            { value: totalSeats > 0 ? String(activated) : '—', label: 'Activated', note: 'People who signed in and started' },
            { value: totalSeats > 0 ? `${Math.round((activated / totalSeats) * 100)}%` : '—', label: 'Activation rate', note: 'Activated seats of all seats' },
          ]}
        />
        <p className="max-w-2xl text-xs text-muted-foreground">{PRIVACY_NOTE}</p>
      </div>

      <PortalNeeds portal="employer" items={needs} empty="Nothing needs you right now. Everyone with a seat has activated it." />

      <PortalTable
        title="Your contracts"
        link={{ href: '/employer/reporting', label: 'Full reporting' }}
        columns={['Contract', 'Program', 'Seats', 'Activated']}
        rows={rows.map(({ c, util }) => ({
          key: c.id,
          href: c.programType !== 'OUTPLACEMENT' ? PROGRAM_TYPE_HOME[c.programType] : undefined,
          cells: [
            label(c),
            `${PROGRAM_TYPE_LABEL[c.programType]} · ${TIER_LABEL[c.tier]}`,
            String(c.seatCount),
            util && !util.suppressed ? `${util.activatedSeats ?? '—'} of ${util.totalSeats}${util.scope.granularity === 'quarterly' ? ' (reported quarterly)' : ''}` : 'Too few to report',
          ],
        }))}
        empty="No active contract yet."
      />

      {isAdmin && (
        <PortalHomeMore label="More for your program">
          <PortalLinks
            links={[
              { href: '/employer/program', label: 'What your program offers', line: 'Set up the services your people get.' },
              { href: '/employer/roster', label: 'Roster', line: 'Everyone enrolled, by cohort.' },
              { href: '/employer/team', label: 'Team', line: 'Who at your company can sign in here.' },
              { href: '/employer/invoices', label: 'Invoices', line: 'Contract totals and invoice references.' },
            ]}
          />
        </PortalHomeMore>
      )}
    </div>
  )
}
