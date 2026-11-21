// The built HE-03 screens, keyed `${workspace}:${tab}`. Staff screens read
// candidate data ONLY through src/lib/higher-ed/views.ts (consent applied in
// SQL, role checked again there), never Prisma models directly. Tabs with no
// entry render a "coming in HE-xx" panel from COMING_DESCRIPTIONS.

import { suggestRelated } from '@/lib/org-claims/related-suggest'
import { suggestionLine } from '@/lib/org-claims/related-suggest-rules'
import { PortalNumbers } from '@/components/partners/PortalHome'
import { ConnectSections, ConsentHistory, MonthlyEmailPanel, StaffConnect } from './screens-connect'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { getJourney, getStage, type JourneyStage, type JourneyType } from '@/lib/journey/journey'
import Link from 'next/link'
import { listOrgKeys } from '@/lib/census/api-keys'
import { HubCompanies, HubHome, HubLayoffs, HubLocal, WorkforceOverview } from './screens-hub'
import { HubAttract, HubBenefits, HubGrants, HubJobs, HubLearning, HubPipeline, HubRapid, HubSkills, HubFunding, HubPublic, HubSystem, HubUpskill } from './screens-hub-program'
import { HubApplications, HubReport } from './screens-hub-flow'
import { HubSkillsGaps, HubTalent } from './screens-hub-skills'
import { HubNetwork } from './screens-hub-network'
import { PartnerOverview, PartnerShared } from './screens-partner'
import { HubEmployerJobs, HubGroupJobs, HubRegionJobs } from './screens-hub-jobs'
import { HubPartnerViews } from './screens-hub-partners'
import { HubEcosystem } from './screens-hub-ecosystem'
import { AcademicPeers, AcademicPrograms, AcademicState } from './screens-academic'
import { AcademicAtRisk, AcademicEmployers, AcademicRetraining, AcademicSkills } from './screens-academic-insights'
import { CompanyOverview, CompanySupport, CompanyGrants, CompanyTraining, CompanyColleges, CompanyWorkforce } from './screens-company'
import { readComms } from '@/lib/census/comms-settings'
import { CommsToggles, OrgKeysPanel } from '@/components/census/OrgKeysPanel'
import { makeCollegeKey, saveCollegeComms, turnOffCollegeKey } from '@/app/i/[slug]/(portal)/census-actions'
import type { ComponentType } from 'react'
import { ArrowRight, Lock, Users } from 'lucide-react'
import type { InstitutionMemberStatus, InstitutionUserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import {
  getAlumniHomeCounts,
  getJourneyMix,
  listCaseloadActivity,
  listMemberDirectory,
  listOpenTransitions,
} from '@/lib/higher-ed/views'
import { OFFICE_NAME_MAX, RENAMABLE_OFFICES, STAFF_ROLE_LABELS, labelFor, officeNamesOf, staffRoleLabel, TIER_LABELS, WORKSPACES, auditPortalOf, brandingEditPath, getWorkspace, orgKindOf, tierIncludes, type WorkspaceKey } from '@/lib/higher-ed/workspaces'
import { OrgHomeHero } from '@/components/partners/OrgHomeHero'
import { HiddenMembersNote } from '@/components/plans/HiddenMembersNote'
import { AdminRelatedOrgs } from './screens-related'
import { AdminUnits } from './screens-units'
import { AdminImpact } from './screens-impact'
import { FirstFiveYearsCard, isRecentGrad } from './FirstFiveYearsCard'
import { AdminConnections } from './screens-connections'
import { AdminPublicPage } from '@/components/public-page/screens-public-page'
import { listPartnerAudit } from '@/lib/partners/audit'
import { PartnerActivity } from '@/components/partners/PartnerActivity'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DoNotSolicitBadge } from './DoNotSolicitBadge'
import { StatTile } from './StatTile'
import { RegionScreen } from './RegionScreen'
import { OutcomesScreen } from './OutcomesScreen'
import { MentorsScreen } from './MentorsScreen'
import { ServicesPanel } from './ServicesPanel'
import { readProfile, type InstitutionProfile } from '@/lib/higher-ed/profile'
import { checkInMonthFrom, customServices, memberAudiences, memberCards, memberTraits, serviceSettingsFrom } from '@/lib/higher-ed/services'
import { rosterAutoJoinOptions } from '@/lib/higher-ed/major-groups'
import { latestCheckInAnswer } from '@/lib/higher-ed/checkins'
import { serviceUsage30d } from '@/lib/higher-ed/service-usage'
import { setAnnualCheckInMonth } from '@/app/i/[slug]/(portal)/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { AlumniJobForm } from '@/components/institution/AlumniJobForm'
import { TargetCompanyForm } from '@/components/institution/TargetCompanyForm'
import { CoreRecruiterForm, RecruitingDateForm, EarlyCareerRoleForm } from '@/components/institution/RecruitingForms'
import { listRecruitingDates, listEarlyCareerRoles } from '@/lib/higher-ed/recruiting'
import { RECRUITING_DATE_LABELS, EARLY_CAREER_LABELS, splitUpcoming, deadlinePassed, safeHttpUrl } from '@/lib/higher-ed/recruiting-rules'
import { StaffInviteForm } from './StaffInviteForm'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { EducationAssign, EducationCatalog, EducationGaps } from './screens-education'
import { HubCohorts } from './screens-cohorts'
import { PartnerReferrals, WfReferrals } from './screens-referrals'
import { PartnerFeed, PartnerGroups, WfFeed, WfGroups, WfPartners } from './screens-wfhub'
import { WfHome } from './screens-wfhome'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'
import { AlumniEngagement, AlumniLayoffs, AlumniOutreach, CareerCheckIns, WaitingForYou } from './screens-outreach'
import { AlumniData } from './screens-alumni-data'
import { DevelopmentGrants } from './screens-grants'
import { SkillsBridgeSection, StaffSkillsBridge } from './screens-bridge'
import { AlumniInNews, ResearchAndPatents, TeachingGroups } from './screens-campus'
import { VentureShareCard, VenturesFounders, YourVentureCard } from './screens-ventures'
import { InternshipsScreen } from './screens-internships'
import { AlumniMentors, CandidateJobs, CareerEmployers, CareerStudents, EmployerDossiersWithIntros, EmployerPage, IntroRequestsCard } from './screens-network'
import { counselors, searchRoster } from '@/lib/higher-ed/caseload'
import { careerDraftsFor } from '@/lib/staff-agents/career-services-run'
import { BriefCard } from './BriefCard'
import { removeFromCaseload } from '@/app/i/[slug]/(portal)/caseload-actions'
import { AssignControl } from './AssignControl'
import { ConfirmActionButton } from './ConfirmActionButton'
import { AdminBoard, AlumniEvents, CandidateNetwork, MilestonesFeed, StagePanel, WorkforceEtpl, WorkforceRapid } from './screens-lifecycle'
import { CandidatePrograms, ExecEdClients, ExecEdEnrollments, ExecEdPrograms, MyProgramCard, TeachingCapstones, TeachingCourses, WorkforceHome } from './screens-programs'
import { DevelopmentCrm, DevelopmentFund, DevelopmentRoi, DevelopmentSignals, PeerBenchmarkCard } from './screens-development'
import { BrandingForm } from './BrandingForm'
import { OfficeNamesForm } from './OfficeNamesForm'
import {
  AdminPrivacy,
  AlumniCommunity,
  AlumniVolunteers,
  CandidateGiveBack,
  FeaturesPanel,
  LearnSections,
  MentoringCohortsSection,
  NewsCard,
  PeopleSections,
  PrivacyExtras,
  ProjectsSection,
  StaffCohorts,
  TeachingAuditors,
  loadModules,
  type CommunityParams,
} from './screens-community'
import { CareerStatusCard } from './CareerStatusCard'
import { CandidateGroups } from './screens-groups'
import { WorkforcePreviewHome } from './WorkforcePreviewHome'
import { HubPeople } from './screens-people'
import { BusinessEmployers, BusinessHome, BusinessIncentives, BusinessLeads, BusinessPitch, BusinessSmall } from './screens-business'
import { PrivacyPanel } from './PrivacyPanel'
import { CrmUploadForm } from './CrmUploadForm'
import { InviteAlumniButton } from './InviteAlumniButton'
import { CollegeSettingsForm } from './CollegeSettingsForm'
import { listProfileViews } from '@/lib/higher-ed/audit'
import { countInvitable } from '@/lib/higher-ed/invites'
import { graceDaysFrom } from '@/lib/higher-ed/transition'
import { emailSettingsFrom } from '@/lib/higher-ed/outreach'
import { wioaOn } from '@/lib/higher-ed/programs'
import { collegeTimeZone } from '@/lib/higher-ed/time-zone'
import { activeFund, memberAward } from '@/lib/higher-ed/fund'
import { CheckCircle2, Circle } from 'lucide-react'
import { listTargetCompanies } from '@/lib/companies/institution-targets'
import { canAny } from '@/lib/institution/permissions'
import { removeStaff, resendStaffInvite } from '@/app/i/[slug]/(portal)/staff-actions'
import { ActionButton } from './CommunityForms'
import { addEarlyCareerRoleAction, addRecruitingDateAction, archiveEarlyCareerRoleAction, removeRecruitingDateAction, saveCoreRecruiter, archiveAlumniJob, addTargetCompany, inviteStaff, postAlumniJob, removeTargetCompany, saveBranding, saveCollegeSettings, saveOfficeNames, uploadCrmFile } from '@/app/i/[slug]/(portal)/staff-actions'

export type ScreenSearchParams = { field?: string; purpose?: string; q?: string; page?: string; status?: string; transition?: string; industry?: string; fn?: string; edit?: string; group?: string; company?: string; track?: string; need?: string } & CommunityParams
type ScreenProps = { ctx: WorkspaceContext; searchParams: ScreenSearchParams; base: string }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmtDate = (d: Date | null) => (d ? dateFmt.format(new Date(d)) : null)
const fullName = (r: { firstName: string | null; lastName: string | null }) =>
  [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Unnamed'

const STATUS_LABELS: Record<InstitutionMemberStatus, string> = {
  IMPORTED: 'Imported',
  INVITED: 'Invited',
  CLAIMED: 'Claimed',
  ACTIVE: 'Active',
  OPTED_OUT: 'Opted out',
}

function NotShared() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3" aria-hidden="true" />
      Not shared
    </span>
  )
}

function Table({ head, children, caption }: { head: string[]; children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

async function loadInstitutionData(institutionId: string) {
  const i = await prisma.institution.findUnique({ where: { id: institutionId }, select: { profile: true, enabledFeatures: true } })
  return { profile: readProfile(i?.profile), enabledFeatures: i?.enabledFeatures ?? {} }
}

function PhotoStrip({ profile, limit = 4 }: { profile: InstitutionProfile; limit?: number }) {
  const photos = (profile.photos ?? []).slice(0, limit)
  if (!photos.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {photos.map((p) => (
        <figure key={p.url} className="overflow-hidden rounded-lg border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote college/Wikimedia photo */}
          <img src={p.url} alt={p.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          {p.credit && (
            <figcaption className="px-2 py-1 text-[10px] text-muted-foreground">
              {p.pageUrl ? (
                <a href={p.pageUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {p.credit}
                </a>
              ) : (
                p.credit
              )}
              {p.license ? ` · ${p.license}` : ''}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

// ── Candidate ───────────────────────────────────────────────────────────────

const CANDIDATE_TOOLS = [
  { label: 'Market Reality Grade', href: '/dashboard/market-reality', what: 'Where your search stands against the market. A new report comes when you have done new work.' },
  { label: 'Search Action Plan', href: '/dashboard', what: 'The next moves that will change your grade.' },
  { label: 'Weekly Search Sprint', href: '/dashboard/sprint', what: "This week's committed actions." },
  { label: 'Dossier', href: '/dashboard/recruiter-report', what: 'Your verified, reference-backed profile for employers.' },
  { label: 'Support Network', href: '/dashboard/network', what: 'The people who can help, organized.' },
]

async function CandidateHome({ ctx, base }: ScreenProps) {
  // A workforce program's staff preview: the candidate-site Home (src/components/higher-ed/WorkforcePreviewHome.tsx).
  if (orgKindOf(ctx.institution.orgType) === 'workforce' && ctx.workspaces.includes('hub')) return <WorkforcePreviewHome ctx={ctx} base={base} />
  const member = ctx.memberId
    ? await prisma.institutionMember.findUnique({
        where: { id: ctx.memberId },
        select: {
          firstName: true,
          affiliation: true,
          classYear: true,
          major: true,
          school: true,
          department: true,
          // City and journey for targeted cards: the member's own NextChapter profile.
          candidate: { select: { metroArea: true, currentCity: true, journey: true } },
        },
      })
    : null
  const brand = ctx.institution.programBrandName ?? ctx.institution.name
  const { profile, enabledFeatures } = await loadInstitutionData(ctx.institution.id)
  // The college's switched-on services for this member's audiences (a
  // preview with no member record sees them all). Each card counts its opens.
  const openFlag = ctx.memberId
    ? await prisma.transitionFlag.findUnique({ where: { openFlagMemberId: ctx.memberId }, select: { state: true } })
    : null
  const kind = orgKindOf(ctx.institution.orgType)
  const inTransition = !!openFlag && openFlag.state !== 'CLEARED'
  const traits = member
    ? memberTraits({
        ...member,
        metroArea: member.candidate?.metroArea,
        currentCity: member.candidate?.currentCity,
        journey: member.candidate?.journey,
        inTransition,
        checkInAnswer: await latestCheckInAnswer(ctx.memberId!),
      })
    : null
  const allCards = memberCards(serviceSettingsFrom(enabledFeatures, kind), member ? memberAudiences(member, new Date(), inTransition) : null, kind, { traits, enabledFeatures })
  // A demo's "Start with" one office or two: only those offices' cards show, and the rest wait for their office to join.
  const startPartial = !!ctx.demoStart && ctx.demoStart !== 'all'
  const onWs = new Set<string>(ctx.workspaces)
  const services = startPartial ? allCards.filter((s) => !s.workspace || onWs.has(s.workspace)) : allCards
  const officeNames = officeNamesOf(enabledFeatures)
  const waiting = startPartial
    ? [...new Set(allCards.filter((s) => s.workspace && !onWs.has(s.workspace)).map((s) => s.workspace!))].map((w) => ({
        office: officeNames[w] ?? getWorkspace(w)?.label ?? w,
        adds: allCards.filter((s) => s.workspace === w).map((s) => s.name),
      }))
    : []
  const hero = profile.heroImageUrl ? { url: profile.heroImageUrl, alt: `${ctx.institution.name} campus`, credit: null } : profile.photos?.[0]
  const career = profile.college?.careerCenter
  // "Give back" only for a joined alum who isn't between jobs or in their
  // quiet period, and only when the college has a giving page.
  const giving = await prisma.institution.findUnique({ where: { id: ctx.institution.id }, select: { givingUrl: true } })
  const fund = giving?.givingUrl ? await activeFund(ctx.institution.id) : null
  const showGiveBack = !!ctx.memberId && !!giving?.givingUrl && (!openFlag || openFlag.state === 'CLEARED')
  return (
    <div className="space-y-6">
      {hero && (
        <figure className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote college/Wikimedia photo */}
          <img src={hero.url} alt={hero.alt} className="h-44 w-full object-cover sm:h-56" />
          {hero.credit && <figcaption className="absolute right-2 bottom-1 rounded bg-black/50 px-1.5 text-[10px] text-white">{hero.credit}</figcaption>}
        </figure>
      )}
      <div>
        {/* In a workforce program's participant preview (drawn in the candidate site's frame), the headline is the candidate site's and
            the program reads as one of the participant's groups, linking to Network › Alumni and groups. */}
        {kind === 'workforce' && ctx.workspaces.includes('hub') ? (
          <>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{member?.firstName ? `Welcome back, ${member.firstName}` : `Welcome to ${brand}`}</h2>
            <p className="mt-2">
              <Link href={`${base}/groups`} className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success hover:underline">
                <Users className="size-3.5" aria-hidden="true" />
                Member of {brand}
              </Link>
            </p>
          </>
        ) : (
          <h2 className="text-lg font-semibold">{member?.firstName ? `Welcome back, ${member.firstName}` : `Welcome to ${brand}`}</h2>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {kind === 'workforce' ? (
            <>
              {ctx.institution.name} is covering your search: a clear read on your job market, a plan for this week, coaching, and local employers first. Your
              search stays yours; {ctx.institution.name} sees only what you choose to share.
            </>
          ) : (
            <>
              {ctx.institution.name} has your back: a clear read on your job market, a plan for this week, coaching and alumni who&apos;ll take your call. Your
              search stays yours; the college sees only what you choose to share.
            </>
          )}
        </p>
        {!ctx.memberId && ctx.isNcAdmin && (
          <p className="mt-2 text-sm text-amber-900">You&apos;re previewing as {kind === 'workforce' ? 'a participant' : 'an alum'}. There&apos;s no member record behind this preview.</p>
        )}
      </div>
      <CareerStatusCard slug={ctx.institution.slug} collegeName={ctx.institution.name} flag={openFlag?.state === 'CLEARED' ? null : (openFlag?.state ?? null)} />
      <IntroRequestsCard ctx={ctx} />
      {kind === 'college' && <VentureShareCard ctx={ctx} base={base} />}
      {kind === 'college' && <YourVentureCard ctx={ctx} base={base} />}
      <MyProgramCard ctx={ctx} />
      <NewsCard ctx={ctx} />
      {/* A graduate of the last five years sees their five-year timeline in place of the stage panel (owner, 2026-11-21). */}
      {kind === 'college' && isRecentGrad(member) ? <FirstFiveYearsCard ctx={ctx} classYear={member.classYear} /> : <StagePanel ctx={ctx} />}
      <ul className="grid gap-3 sm:grid-cols-2">
        {CANDIDATE_TOOLS.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="group flex h-full flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
              <span className="flex items-center justify-between text-sm font-semibold">
                {t.label}
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{t.what}</span>
            </Link>
          </li>
        ))}
      </ul>
      {services.length > 0 && (
        <section aria-labelledby="college-services" className="space-y-2">
          <h2 id="college-services" className="text-base font-semibold">
            From {ctx.institution.name}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {services.map((sv) => (
              <li key={sv.key}>
                <Link
                  href={`/i/${ctx.institution.slug}/go/${sv.key}`}
                  className="group flex h-full flex-col rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary"
                >
                  <span className="flex items-center justify-between text-sm font-medium">
                    {sv.name}
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                  </span>
                  <span className="text-xs text-muted-foreground">{sv.pitch}</span>
                  {sv.partnerName && <span className="mt-1 text-xs text-muted-foreground">From {sv.partnerName}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {waiting.length > 0 && (
        <section aria-labelledby="when-join" className="space-y-2 rounded-lg border border-dashed border-border p-4">
          <h2 id="when-join" className="text-base font-semibold">
            When more offices join
          </h2>
          <p className="text-sm text-muted-foreground">This demo starts with some offices. Each office that joins adds to the same page for every alum:</p>
          <ul className="space-y-1.5">
            {waiting.map((w) => (
              <li key={w.office} className="text-sm">
                <span className="font-medium">{w.office}:</span> <span className="text-muted-foreground">{w.adds.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {showGiveBack && (
        <section aria-labelledby="give-back" className="rounded-lg border border-border bg-card p-4">
          <h2 id="give-back" className="text-base font-semibold">
            Give back
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fund ? `${fund.name}: ${fund.description ?? 'coaching for alumni between jobs'}.` : `Help the next ${ctx.institution.name} alum through a hard stretch.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <a href={`/i/${ctx.institution.slug}/give`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Make a gift
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <Link href={`/i/${ctx.institution.slug}/candidate/mentors`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Take a call from an alum
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
      {career && (
        <p className="text-sm text-muted-foreground">
          Questions? {career.name}
          {career.email ? ` · ${career.email}` : ''}
          {career.phone ? ` · ${career.phone}` : ''}
        </p>
      )}
    </div>
  )
}

// ── Alumni Relations ────────────────────────────────────────────────────────

async function AlumniHome({ ctx, base }: ScreenProps) {
  const [c, { mix, total }, { profile }] = await Promise.all([getAlumniHomeCounts(ctx), getJourneyMix(ctx), loadInstitutionData(ctx.institution.id)])
  // The college's splash (owner decision 2026-11-17, like the workforce Home): its own campus picture, or the first sourced
  // photo, with three numbers up front. It replaces the row of four tiles; the Active seats count is dropped from this Home.
  const photo = profile.heroImageUrl ? { url: profile.heroImageUrl, credit: null, pageUrl: null } : (profile.photos?.[0] ?? null)
  const place = [profile.college?.city, profile.college?.state].filter(Boolean).join(', ')
  const joinedShare = c.members ? Math.round((c.claimed / c.members) * 100) : null
  return (
    <div className="space-y-6">
      <OrgHomeHero
        name={ctx.institution.name}
        line={place || (profile.region?.name ?? ctx.institution.name)}
        tagline={profile.tagline ?? ctx.institution.name}
        imageUrl={photo?.url ?? null}
        credit={photo?.credit ?? null}
        creditUrl={photo?.pageUrl ?? null}
        logoUrl={ctx.institution.logoUrl}
        placeholder="campus"
        edit={brandingEditPath(ctx) ? { brandingHref: brandingEditPath(ctx)!, readOnly: ctx.readOnly } : null}
        stats={[
          { label: 'Alumni on your roster', value: c.members.toLocaleString(), note: 'From your roster upload' },
          { label: 'Joined NextChapter', value: c.claimed.toLocaleString(), note: joinedShare === null ? 'Invite alumni from Admin › Roster' : `${joinedShare}% of your roster` },
          { label: 'In transition', value: c.inTransition.toLocaleString(), note: 'Alumni flagged as between jobs' },
        ]}
      />
      <WaitingForYou ctx={ctx} office="alumni" base={base} />
      <BriefCard institutionId={ctx.institution.id} agent="alumni_services" />
      <MilestonesFeed ctx={ctx} />
      <p className="text-sm">
        <Link href={`${base}/members?transition=1`} className="font-medium text-primary hover:underline">See who is in transition</Link>
      </p>
      <section aria-labelledby="journey-mix" className="space-y-2">
        <h2 id="journey-mix" className="text-base font-semibold">
          Where your alumni are
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Why joined alumni are using {ctx.institution.programBrandName ?? ctx.institution.name}: not only job loss. Counts only, from {total.toLocaleString()} who
          share their engagement; groups under {MIN_CELL_SIZE} aren&apos;t shown.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {mix.map((m) => (
            <StatTile key={m.journey} label={getJourney(m.journey).label} value={m.count === null ? `<${MIN_CELL_SIZE}` : m.count.toLocaleString()} />
          ))}
        </div>
      </section>

    </div>
  )
}

async function AlumniMembers({ ctx, searchParams, base }: ScreenProps) {
  if (searchParams.transition === '1') {
    const rows = await listOpenTransitions(ctx)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} members in transition.{' '}
          <Link href={`${base}/members`} className="font-medium text-primary hover:underline">
            Show all members
          </Link>
        </p>
        <TransitionTable rows={rows} />
      </div>
    )
  }

  const status = searchParams.status && searchParams.status in STATUS_LABELS ? (searchParams.status as InstitutionMemberStatus) : undefined
  const page = Number(searchParams.page) || 1
  const { rows, total, pageSize } = await listMemberDirectory(ctx, { q: searchParams.q, status, page })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const qs = (p: number) => {
    const s = new URLSearchParams()
    if (searchParams.q) s.set('q', searchParams.q)
    if (status) s.set('status', status)
    if (p > 1) s.set('page', String(p))
    const str = s.toString()
    return `${base}/members${str ? `?${str}` : ''}`
  }

  return (
    <div className="space-y-4">
      <HiddenMembersNote ctx={ctx} noun="alumni" />
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="member-q">Search by name</Label>
          <Input id="member-q" name="q" defaultValue={searchParams.q ?? ''} placeholder="e.g. Jordan" className="w-56" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-status">Status</Label>
          <select id="member-status" name="status" defaultValue={status ?? ''} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filter members
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No members match" description="Try a different name or status, or import a roster in Admin › Roster." />
      ) : (
        <Table caption="Members" head={['Name', 'Class', 'Status', 'Employer', 'Title', 'Engagement (12 mo)']}>
          {rows.map((r) => (
            <tr key={r.memberId}>
              <td className="px-4 py-2 font-medium">{fullName(r)}</td>
              <td className="px-4 py-2 tabular-nums">{r.classYear ?? '—'}</td>
              <td className="px-4 py-2">{STATUS_LABELS[r.status]}</td>
              <td className="px-4 py-2">{r.shareOutcome ? (r.employer ?? '—') : <NotShared />}</td>
              <td className="px-4 py-2">{r.shareOutcome ? (r.title ?? '—') : <NotShared />}</td>
              <td className="px-4 py-2 tabular-nums">{r.shareEngagement ? `${r.engagementTier ?? 'Low'} · ${r.engagementPoints12mo ?? 0} pts` : <NotShared />}</td>
            </tr>
          ))}
        </Table>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString()} members · page {Math.min(page, pages)} of {pages}
        </span>
        <span className="flex gap-3">
          {page > 1 && (
            <Link href={qs(page - 1)} className="font-medium text-primary hover:underline">
              Previous page
            </Link>
          )}
          {page < pages && (
            <Link href={qs(page + 1)} className="font-medium text-primary hover:underline">
              Next page
            </Link>
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Employer, title and engagement show only for members who share them. No job-search details are ever shown here.
      </p>
    </div>
  )
}

function TransitionTable({ rows }: { rows: Awaited<ReturnType<typeof listOpenTransitions>> }) {
  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No one is in transition" description="Open flags appear here, without reasons or search details." />
  }
  return (
    <Table caption="Members in transition" head={['Name', 'Class', 'Since', 'Solicitation']}>
      {rows.map((r) => (
        <tr key={r.flagId}>
          <td className="px-4 py-2 font-medium">{fullName(r)}</td>
          <td className="px-4 py-2 tabular-nums">{r.classYear ?? '—'}</td>
          <td className="px-4 py-2">{fmtDate(r.since)}</td>
          <td className="px-4 py-2">{r.doNotSolicit ? <DoNotSolicitBadge /> : 'OK to solicit'}</td>
        </tr>
      ))}
    </Table>
  )
}

// ── Development ─────────────────────────────────────────────────────────────

async function DevelopmentTransition({ ctx }: ScreenProps) {
  const rows = await listOpenTransitions(ctx)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Members with an open transition flag: no fundraising asks until it clears. Reasons, sources and search details are never shown here.
      </p>
      <a href={`/i/${ctx.institution.slug}/export/suppression`} download className="inline-block text-sm font-medium text-primary hover:underline">
        Download the do-not-solicit list (CSV)
      </a>
      <TransitionTable rows={rows} />
    </div>
  )
}

// ── Career Services ─────────────────────────────────────────────────────────

// A note the career-services agent wrote for this person. Already in place; the counselor edits it and sends it from their own email.
function CheckInDraft({ draft }: { draft: { subject: string; body: string; email: string | null } }) {
  return (
    <details className="mt-1 font-normal">
      <summary className="cursor-pointer text-xs font-medium text-primary">Check-in note ready</summary>
      <div className="mt-2 max-w-md space-y-2 rounded-lg border border-border p-3 text-sm">
        <p className="font-semibold">{draft.subject}</p>
        <p className="whitespace-pre-wrap">{draft.body}</p>
        {draft.email && (
          <a className="text-primary underline" href={`mailto:${draft.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>
            Open in your email
          </a>
        )}
      </div>
    </details>
  )
}

async function CareerCaseload({ ctx, base, searchParams }: ScreenProps) {
  const [rows, team] = await Promise.all([listCaseloadActivity(ctx), counselors(ctx.institution.id)])
  // Check-in notes the career-services agent wrote (none exist unless this college switched it on); the counselor sends them from their own email.
  const drafts = await careerDraftsFor(ctx.institution.id, rows.map((r) => r.memberId))
  const canEdit = !ctx.readOnly && ['CAREER_SERVICES', 'COACH', 'INSTITUTION_ADMIN'].some((r) => ctx.tokens.has(r as 'COACH'))
  // Directors see everyone's caseload, so they need to know whose is whose.
  const showCounselor = team.length > 1 && new Set(rows.map((r) => r.counselorId)).size > 1
  const nameOf = new Map(team.map((t) => [t.id, t.name]))
  const q = searchParams.q?.trim() ?? ''
  const found = canEdit && q ? await searchRoster(ctx.institution.id, q) : []
  const waiting = ctx.readOnly ? null : <WaitingForYou ctx={ctx} office="career" base={base} />
  // The portal Home's three numbers, from the caseload rows already read: no new query.
  const nowMs = new Date().getTime()
  const sharing = rows.filter((r) => r.shareSearchDetail).length
  const activeRecently = rows.filter((r) => r.shareSearchDetail && r.lastActivityAt && nowMs - new Date(r.lastActivityAt).getTime() <= 14 * 86_400_000).length
  const checkInsDue = rows.filter((r) => r.nextCheckInAt && new Date(r.nextCheckInAt).getTime() - nowMs <= 7 * 86_400_000).length
  return (
    <div className="space-y-6">
      {ctx.ownTokens.has('COACH') && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm">
          You also have a NextChapter coach portal for sessions, notes and messages with your clients.{' '}
          <a href="/support/coach" className="font-medium text-primary underline">
            Open your coach portal
          </a>
        </p>
      )}
      {waiting}
      {rows.length > 0 && (
        <PortalNumbers
          items={[
            { value: rows.length.toLocaleString(), label: 'On the caseload', source: showCounselor ? 'Across career services' : 'Assigned to you' },
            {
              value: activeRecently.toLocaleString(),
              label: 'Active in the last 14 days',
              source: `Of ${sharing.toLocaleString()} who share their search with career services`,
              highlight: true,
            },
            { value: checkInsDue.toLocaleString(), label: 'Check-ins in the next 7 days', source: 'Scheduled on the caseload' },
          ]}
        />
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No one on this caseload" description="Add someone below. Alumni who tell a check-in they're looking or laid off are added automatically." />
      ) : (
        <div className="space-y-2">
          <Table caption="Caseload" head={['Name', 'Class', ...(showCounselor ? ['With'] : []), 'Situation', 'Last activity', 'Weekly Search Sprint', 'Next check-in', ...(canEdit ? [''] : [])]}>
            {rows.map((r) => (
              <tr key={r.assignmentId}>
                <td className="px-4 py-2 font-medium">
                  {fullName(r)}
                  {drafts.get(r.memberId) && <CheckInDraft draft={drafts.get(r.memberId)!} />}
                </td>
                <td className="px-4 py-2 tabular-nums">{r.classYear ?? '—'}</td>
                {showCounselor && <td className="px-4 py-2">{nameOf.get(r.counselorId) ?? '—'}</td>}
                <td className="px-4 py-2">
                  {!r.shareSearchDetail ? (
                    <NotShared />
                  ) : r.journey ? (
                    `${getJourney(r.journey as JourneyType).label}${r.journeyStage ? ` · ${getStage(r.journeyStage as JourneyStage).label}` : ''}`
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">{r.shareSearchDetail ? (fmtDate(r.lastActivityAt) ?? 'No activity yet') : <NotShared />}</td>
                <td className="px-4 py-2">
                  {!r.shareSearchDetail ? <NotShared /> : r.sprintActionsTotal === null ? 'No sprint yet' : `${r.sprintActionsDone} of ${r.sprintActionsTotal} done`}
                </td>
                <td className="px-4 py-2">{r.nextCheckInAt ? `${r.nextCheckInKind} · ${fmtDate(r.nextCheckInAt)}` : '—'}</td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <ConfirmActionButton
                      label="Remove"
                      variant="outline"
                      confirm={`Take ${fullName(r)} off the caseload? Their record and history stay.`}
                      confirmLabel="Remove"
                      run={removeFromCaseload.bind(null, ctx.institution.slug, r.assignmentId)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </Table>
          <p className="text-xs text-muted-foreground">Search details show only for members who share them with Career Services.</p>
        </div>
      )}
      {canEdit && (
        <section aria-labelledby="add-to-caseload" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="add-to-caseload" className="text-base font-semibold">
            Add someone
          </h2>
          <form action={base} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="caseload-q">Name or email</Label>
              <Input id="caseload-q" name="q" defaultValue={q} placeholder="e.g. Jordan Hollister" className="w-64" />
            </div>
            <SubmitButton variant="outline" pendingLabel="Searching…">
              Search the roster
            </SubmitButton>
          </form>
          {q && !found.length && <p className="text-sm text-muted-foreground">No one on the roster matches &ldquo;{q}&rdquo;.</p>}
          {found.length > 0 && (
            <ul className="divide-y divide-border">
              {found.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm">
                    {fullName(m)}
                    {m.classYear ? <span className="text-muted-foreground"> · {m.classYear}</span> : null}
                  </span>
                  <AssignControl slug={ctx.institution.slug} memberId={m.id} counselors={team} source="search" current={m.caseloadAssignments[0]?.counselor.fullName ?? null} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

// ── Employer ────────────────────────────────────────────────────────────────

// ── Local market (Alumni Relations, Development, Career Services) ───────────

async function Region({ ctx }: ScreenProps) {
  const { profile } = await loadInstitutionData(ctx.institution.id)
  return <RegionScreen profile={profile} />
}


// ── Alumni jobs (Alumni Relations, Career Services) and target companies ────
// Moved from the first /institution portal (commit 2f6bda08); permissions
// are its capability map (src/lib/institution/permissions.ts).

const JOB_STATUS: Record<string, string> = { pending: 'Awaiting review', approved: 'Live for alumni', rejected: 'Not approved' }

async function AlumniJobs({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const canPost = canAny(ctx.tokens, 'post_jobs') && !ctx.readOnly
  const jobs = await prisma.exclusiveJobPosting.findMany({
    where: { institutionScopeId: ctx.institution.id, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, title: true, companyName: true, location: true, status: true },
  })
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Roles only {ctx.institution.name} alumni on NextChapter can see. They never appear on the open job board.
      </p>
      {canPost && <AlumniJobForm postAction={postAlumniJob.bind(null, slug, ctx.workspace)} />}
      {jobs.length === 0 ? (
        <EmptyState icon={Users} title="No alumni jobs yet" description="Post a role above; a NextChapter admin reviews it before alumni see it." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{j.title}</p>
                <p className="text-sm text-muted-foreground">{[j.companyName, j.location, JOB_STATUS[j.status] ?? j.status].filter(Boolean).join(' · ')}</p>
              </div>
              {canPost && (
                <form action={archiveAlumniJob.bind(null, slug, ctx.workspace, j.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Removing…" savedLabel="Removed">
                    Remove posting
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

async function TargetCompanies({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const canManage = canAny(ctx.tokens, 'manage_target_companies') && !ctx.readOnly
  const [targets, dates, roles] = await Promise.all([
    listTargetCompanies(ctx.institution.id),
    listRecruitingDates(ctx.institution.id),
    listEarlyCareerRoles(ctx.institution.id),
  ])
  const upcoming = splitUpcoming(dates).upcoming
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Employers you want to place students and alumni with. Mark the ones that recruit here every year as core recruiters. Only your team sees this list.
      </p>
      {canManage && <TargetCompanyForm addAction={addTargetCompany.bind(null, slug)} />}
      {targets.length === 0 ? (
        <EmptyState icon={Users} title="No target companies yet" description="Add the employers you want students and alumni at." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {targets.map((t) => {
            const nextDate = upcoming.find((d) => d.companyId === t.companyId)
            const openRoles = roles.filter((r) => r.companyId === t.companyId).length
            return (
              <li key={t.companyId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {t.name}
                      {t.coreRecruiter && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">Core recruiter</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">{[t.industry, t.note].filter(Boolean).join(' · ')}</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        t.recruiterContactName || t.recruiterContactEmail ? `Recruiter: ${[t.recruiterContactName, t.recruiterContactEmail].filter(Boolean).join(', ')}` : null,
                        nextDate ? `Next: ${nextDate.title}, ${fmtDate(nextDate.startsAt)}` : null,
                        openRoles ? `${openRoles} open ${openRoles === 1 ? 'role' : 'roles'} for students` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {canManage && (
                    <form action={removeTargetCompany.bind(null, slug, t.companyId)}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Removing…" savedLabel="Removed">
                        Remove company
                      </SubmitButton>
                    </form>
                  )}
                </div>
                {canManage && (
                  <CoreRecruiterForm
                    saveAction={saveCoreRecruiter.bind(null, slug, t.companyId)}
                    core={t.coreRecruiter}
                    contactName={t.recruiterContactName}
                    contactEmail={t.recruiterContactEmail}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

async function RecruitingScreen({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const canManage = canAny(ctx.tokens, 'manage_target_companies') && !ctx.readOnly
  const [dates, roles] = await Promise.all([listRecruitingDates(ctx.institution.id), listEarlyCareerRoles(ctx.institution.id)])
  const { upcoming, past } = splitUpcoming(dates)
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Recruiting calendar</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">When employers are on campus or hiring from your students: career fairs, info sessions, interviews and application deadlines.</p>
        </div>
        {canManage && <RecruitingDateForm addAction={addRecruitingDateAction.bind(null, slug)} />}
        {dates.length === 0 ? (
          <EmptyState icon={Users} title="No recruiting dates yet" description="Add a career fair, info session or deadline to start the calendar." />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {upcoming.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing coming up. Add the next date above.</li>}
              {[...upcoming, ...past].map((d, i) => (
                <li key={d.id} className={`flex items-center justify-between gap-4 px-4 py-3 ${i >= upcoming.length ? 'opacity-60' : ''}`}>
                  <div>
                    <p className="font-medium">{d.company}: {d.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[RECRUITING_DATE_LABELS[d.kind] ?? d.kind, dateTimeFmt.format(d.startsAt), d.location, d.note].filter(Boolean).join(' · ')}
                      {safeHttpUrl(d.url) && <> · <a href={safeHttpUrl(d.url)!} target="_blank" rel="noreferrer" className="underline">Details</a></>}
                    </p>
                  </div>
                  {canManage && (
                    <form action={removeRecruitingDateAction.bind(null, slug, d.id)}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Removing…" savedLabel="Removed">Remove date</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Internships and graduate jobs</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">Roles employers have for your students and new graduates. Only your team enters and edits this list.</p>
        </div>
        {canManage && <EarlyCareerRoleForm addAction={addEarlyCareerRoleAction.bind(null, slug)} />}
        {roles.length === 0 ? (
          <EmptyState icon={Users} title="No internships or graduate jobs yet" description="Add the roles employers have shared with you." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {roles.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">{r.title} <span className="font-normal text-muted-foreground">at {r.company}</span></p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      EARLY_CAREER_LABELS[r.kind] ?? r.kind, r.location, r.classYears ? `Class of ${r.classYears}` : null,
                      r.deadline ? `${deadlinePassed(r.deadline) ? 'Closed' : 'Apply by'} ${fmtDate(r.deadline)}` : null, r.note,
                    ].filter(Boolean).join(' · ')}
                    {safeHttpUrl(r.applyUrl) && <> · <a href={safeHttpUrl(r.applyUrl)!} target="_blank" rel="noreferrer" className="underline">Apply link</a></>}
                  </p>
                </div>
                {canManage && (
                  <form action={archiveEarlyCareerRoleAction.bind(null, slug, r.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Archiving…" savedLabel="Archived">Archive role</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Coaching ────────────────────────────────────────────────────────────────

async function StaffRoster({ ctx, roles, empty }: { ctx: WorkspaceContext; roles: ('COACH' | 'CAREER_SERVICES' | 'FACULTY' | 'EXEC_ED')[]; empty: string }) {
  const staff = await prisma.institutionUser.findMany({
    where: { institutionId: ctx.institution.id, role: { in: roles }, revokedAt: null },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    select: { id: true, fullName: true, invitedEmail: true, role: true, acceptedAt: true },
  })
  if (staff.length === 0) return <EmptyState icon={Users} title="No one here yet" description={empty} />
  return (
    <Table caption="Staff" head={['Name', 'Role', 'Status']}>
      {staff.map((s) => (
        <tr key={s.id}>
          <td className="px-4 py-2 font-medium">{s.fullName ?? s.invitedEmail}</td>
          <td className="px-4 py-2">{STAFF_ROLE_LABELS[s.role]}</td>
          <td className="px-4 py-2">{s.acceptedAt ? 'Active' : 'Invited'}</td>
        </tr>
      ))}
    </Table>
  )
}

// Sessions attributed to this college (CoachSession.institutionId). Dates
// and durations only: coaching notes are never shown to college staff.
async function CoachingSessions({ ctx }: ScreenProps) {
  const sessions = await prisma.coachSession.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: { occurredAt: 'desc' },
    take: 50,
    select: {
      id: true,
      occurredAt: true,
      durationMinutes: true,
      sessionType: true,
      coach: { select: { fullName: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
  })
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        One-to-one coaching for {ctx.institution.name} alumni and students, by your counselors and NextChapter coaches. Dates only; session
        notes stay between the coach and the member.
      </p>
      {sessions.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No coaching sessions yet"
          description="Sessions appear here once members book them. Resilience Fund awards show as prepaid."
        />
      ) : (
        <Table caption="Coaching sessions" head={['Date', 'Member', 'Coach', 'Length']}>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2">{fmtDate(s.occurredAt)}</td>
              <td className="px-4 py-2 font-medium">{fullName(s.candidate)}</td>
              <td className="px-4 py-2">{s.coach.fullName}</td>
              <td className="px-4 py-2">{s.durationMinutes ? `${s.durationMinutes} min` : '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

// The college's own coaches: Coach rows linked to it. They work in the
// NextChapter coach portal; members see them first when choosing a coach.
async function CollegeCoaches({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const coaches = await prisma.coach.findMany({
    where: { institutionId },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, focus: true, industries: true, _count: { select: { clients: true } } },
  })
  return (
    <section aria-labelledby="college-coaches" className="space-y-2">
      <h2 id="college-coaches" className="text-base font-semibold">
        {institutionName} coaches
      </h2>
      {coaches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None yet. Invite a coach from Admin › Staff with the Coach role: they get the NextChapter coach portal, tied to {institutionName}.
          Members can also choose NextChapter&apos;s coaches.
        </p>
      ) : (
        <Table caption="College coaches" head={['Coach', 'Focus', 'Clients']}>
          {coaches.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 font-medium">{c.fullName}</td>
              <td className="px-4 py-2">{[c.focus.toLowerCase(), ...c.industries.slice(0, 2)].join(' · ')}</td>
              <td className="px-4 py-2 tabular-nums">{c._count.clients}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

async function CareerCoaching(props: ScreenProps) {
  return (
    <div className="space-y-8">
      <CoachingSessions {...props} />
      <CollegeCoaches institutionId={props.ctx.institution.id} institutionName={props.ctx.institution.name} />
    </div>
  )
}

// Candidate › Coaching: members choose and book coaches in the NextChapter
// candidate portal; this points them there and shows their college's coaches.
async function CandidateCoaching({ ctx }: ScreenProps) {
  const award = ctx.memberId ? await memberAward(ctx.memberId) : null
  const coaches = await prisma.coach.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, focus: true, industries: true },
  })
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        One-to-one coaching from {ctx.institution.name}&apos;s own coaches and NextChapter&apos;s. Answer a few questions and we&apos;ll suggest
        the best fit, with {ctx.institution.name}&apos;s coaches first.
      </p>
      {award?.status === 'AWARDED' && (
        <p className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm" role="status">
          Prepaid: your {award.awardType === 'COACHING_PACKAGE' ? 'coaching package' : 'premium seat'} is covered by {award.fund.name}, from{' '}
          {ctx.institution.name} donors.
        </p>
      )}
      <Button nativeButton={false} render={<Link href="/dashboard/coaching-match" />}>
        Choose a coach
      </Button>
      {coaches.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {coaches.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium">{c.fullName}</p>
              <p className="text-xs text-muted-foreground">{[`${ctx.institution.name} coach`, ...c.industries.slice(0, 2)].join(' · ')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Teaching and Exec Ed ────────────────────────────────────────────────────
// Connected: Exec Ed programs are taught by the faculty in Teaching, and
// Teaching shows the programs its faculty deliver. Both read the programs in
// the Services catalog; courses, cohorts and enrollment are V2 (spec §13).

async function TeachingFaculty({ ctx }: ScreenProps) {
  return <StaffRoster ctx={ctx} roles={['FACULTY', 'EXEC_ED']} empty="Invite faculty and Exec Ed staff from Admin › Staff." />
}

// ── Candidate › Privacy & sharing ───────────────────────────────────────────

const CONSENT_COPY: Record<string, { label: (c: string) => string; help: string }> = {
  SHARE_OUTCOME: { label: (c) => `Tell ${c} when I land a job`, help: 'Your new employer and title. Nothing about your search.' },
  SHARE_SEARCH_DETAIL_WITH_CAREER: { label: () => 'Let Career Services see my progress', help: 'Weekly progress and activity, so a counselor can help. Never assessments or messages.' },
  SHARE_ENGAGEMENT: { label: (c) => `Count my activity toward ${c}'s alumni engagement`, help: 'That you used the tools and took calls, as totals. Never what you did in them.' },
  SHARE_DOSSIER_WITH_EMPLOYERS: { label: (c) => `Show my Dossier to employers ${c} approves`, help: 'Employers that hire through your college can see your Dossier and ask for an introduction. You say yes or no each time.' },
  // Workforce programs only: they match people to benefits (Program › People, src/lib/workforce/people-crm.ts).
  // Colleges only: the entrepreneurship center (src/lib/higher-ed/ventures.ts). Off by default; a launched venture is shared as an outcome.
  SHARE_VENTURE: { label: (c) => `Share my company with ${c}`, help: 'Its name, stage, kind, customers, team, funding and any exit. The entrepreneurship center sees it to offer office hours, programs, investors and alumni customers, and so do the offices that work with founders: Alumni Relations, Advancement, Career Services, lifelong learning and faculty. Never runway, hours or personal money.' },
  SHARE_NEEDS: { label: (c) => `Let ${c} see why I joined and the help I need`, help: 'Whether you are moving here, changing fields or starting out, and the money pressures and barriers you told NextChapter about, like childcare, rent or health coverage, so they can match you to local programs. Never amounts or messages.' },
}

// A workforce program has no career services office, alumni or college: the same settings in its own words.
const WORKFORCE_CONSENT_COPY: Record<string, { label: (c: string) => string; help: string }> = {
  SHARE_SEARCH_DETAIL_WITH_CAREER: { label: (c) => `Let ${c}'s career staff see my progress`, help: 'Weekly progress and activity, so a coach or counselor can help. Never assessments or messages.' },
  SHARE_ENGAGEMENT: { label: (c) => `Count my activity in ${c}'s program totals`, help: 'That you used the tools and took calls, as totals. Never what you did in them.' },
  SHARE_DOSSIER_WITH_EMPLOYERS: { label: (c) => `Show my Dossier to employers ${c} approves`, help: 'Member companies that are hiring can see your Dossier and ask for an introduction. You say yes or no each time.' },
}

async function CandidatePrivacy({ ctx }: ScreenProps) {
  if (!ctx.memberId) {
    return <p className="text-sm text-muted-foreground">This is a preview: there&apos;s no member record, so there are no settings to show.</p>
  }
  const [consent] = await prisma.$queryRaw<{ shareEngagement: boolean; shareOutcome: boolean; shareSearchDetail: boolean; shareDossier: boolean }[]>`
    select "shareEngagement", "shareOutcome", "shareSearchDetail", "shareDossier" from private.v_member_consent where "memberId" = ${ctx.memberId}`
  const granted: Record<string, boolean> = {
    SHARE_OUTCOME: consent?.shareOutcome ?? true,
    SHARE_SEARCH_DETAIL_WITH_CAREER: consent?.shareSearchDetail ?? false,
    SHARE_ENGAGEMENT: consent?.shareEngagement ?? true,
    SHARE_DOSSIER_WITH_EMPLOYERS: consent?.shareDossier ?? false,
  }
  const workforce = orgKindOf(ctx.institution.orgType) === 'workforce'
  if (workforce) {
    const needs = await prisma.institutionConsent.findFirst({ where: { memberId: ctx.memberId, scope: 'SHARE_NEEDS' }, orderBy: { changedAt: 'desc' }, select: { granted: true } })
    granted.SHARE_NEEDS = needs?.granted ?? false
  } else {
    const venture = await prisma.institutionConsent.findFirst({ where: { memberId: ctx.memberId, scope: 'SHARE_VENTURE' }, orderBy: { changedAt: 'desc' }, select: { granted: true } })
    granted.SHARE_VENTURE = venture?.granted ?? false
  }
  const views = await listProfileViews(ctx.memberId)
  const rows = Object.entries(CONSENT_COPY)
    .filter(([scope]) => (workforce ? scope !== 'SHARE_VENTURE' : scope !== 'SHARE_NEEDS'))
    .map(([scope, c]) => (workforce && WORKFORCE_CONSENT_COPY[scope] ? [scope, WORKFORCE_CONSENT_COPY[scope]] as const : [scope, c] as const))
    .map(([scope, c]) => ({ scope, label: c.label(ctx.institution.name), help: c.help, granted: granted[scope] }))
  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Your job search belongs to you. {ctx.institution.name} sees only what you switch on here, and never your assessments, coaching notes or
        messages.
      </p>
      <PrivacyPanel slug={ctx.institution.slug} rows={rows} />
      <section aria-labelledby="who-viewed" className="space-y-2">
        <h2 id="who-viewed" className="text-base font-semibold">
          Who viewed my profile
        </h2>
        {views.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one at {ctx.institution.name} has opened your record.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {views.map((v, i) => (
              <li key={i} className="flex justify-between px-4 py-2">
                <span>{v.workspace.replace(/^\w/, (c) => c.toUpperCase())} office</span>
                <span className="text-muted-foreground">{fmtDate(v.viewedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Admin ───────────────────────────────────────────────────────────────────

const ROSTER_COLUMNS = 'external_id, email, first_name, last_name, affiliation, class_year, degree, major, school, department, employer, title, do_not_contact'
const GIFT_COLUMNS = 'external_id, gift_date, amount, fund, appeal'

async function AdminRoster({ ctx }: ScreenProps) {
  const slug = ctx.institution.slug
  const workforce = orgKindOf(ctx.institution.orgType) === 'workforce'
  const [members, joined, invitable, runs, outbox, keys, inst] = await Promise.all([
    prisma.institutionMember.count({ where: { institutionId: ctx.institution.id } }),
    prisma.institutionMember.count({ where: { institutionId: ctx.institution.id, status: { in: ['CLAIMED', 'ACTIVE'] } } }),
    countInvitable(ctx.institution.id),
    prisma.crmExchangeRun.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { id: true, direction: true, fileName: true, rowCount: true, errorCount: true, status: true, startedAt: true },
    }),
    // Demo colleges never email: the recorded invitations, with their links.
    ctx.institution.isDemo
      ? prisma.outreachSend.findMany({
          where: { campaign: { institutionId: ctx.institution.id, type: 'WELCOME' } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, email: true, claimToken: true, claimedAt: true },
        })
      : Promise.resolve([]),
    listOrgKeys('institution', ctx.institution.id),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } }),
  ])
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://launchyournextchapter.com'
  const example = `curl -X POST ${base}/api/v1/census \\
  -H "Authorization: Bearer nck_…" \\
  -H "Content-Type: application/json" \\
  -d '{ "people": [ { "external_id": "100234", "email": "pat@example.edu", "first_name": "Pat", "last_name": "Lee",
                     "affiliation": "${workforce ? 'PARTICIPANT' : 'ALUM'}", "class_year": 2012 } ] }'

The same columns as the roster file. Matched on external_id, then email. To put learners in a program cohort:
  -d '{ "cohortId": "<cohort id>", "learners": [ { "email": "…", "first_name": "…", "last_name": "…", "payer": "WIOA_VOUCHER" } ] }'
GET the same address to read your roster back (join status only).`
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="On the roster" value={members.toLocaleString()} />
        <StatTile label="Joined" value={joined.toLocaleString()} />
        <StatTile label="Not invited yet" value={invitable.toLocaleString()} />
      </div>
      <section aria-labelledby="invite" className="space-y-2">
        <h2 id="invite" className="text-base font-semibold">
          {workforce ? 'Invite participants' : 'Invite alumni'}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {workforce ? 'Each person' : 'Each alum'} gets a short email from {ctx.institution.name} with a one-click link: no password, two privacy choices, then their job
          market. Do-not-contact {workforce ? 'people are' : 'alumni are'} never emailed.
        </p>
        <InviteAlumniButton slug={slug} count={invitable} isDemo={ctx.institution.isDemo} collegeName={ctx.institution.name} people={workforce ? 'participants' : 'alumni'} />
        {ctx.institution.isDemo && outbox.length > 0 && (
          <details className="rounded-lg border border-border bg-card p-3 text-sm">
            <summary className="cursor-pointer font-medium">Demo outbox: {outbox.length} most recent invitations (not emailed)</summary>
            <ul className="mt-2 space-y-1">
              {outbox.map((o) => (
                <li key={o.id} className="flex flex-wrap justify-between gap-2">
                  <span>{o.email}</span>
                  {o.claimedAt ? (
                    <span className="text-muted-foreground">Joined</span>
                  ) : (
                    <Link href={`/i/${slug}/join?t=${o.claimToken}`} className="font-medium text-primary hover:underline">
                      Open join page
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section aria-labelledby="upload" className="space-y-3">
        <h2 id="upload" className="text-base font-semibold">
          Upload from your CRM
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Export from Raiser&apos;s Edge, Salesforce or a spreadsheet. Uploading the same file again changes nothing; an updated file updates the people in it.
          Or send the file to NextChapter and we&apos;ll load it.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <CrmUploadForm id="roster" title={workforce ? 'Participant roster (affiliation PARTICIPANT)' : 'Alumni roster'} columns={ROSTER_COLUMNS} action={uploadCrmFile.bind(null, slug, 'roster')} />
          <CrmUploadForm id="gifts" title="Gifts" columns={GIFT_COLUMNS} action={uploadCrmFile.bind(null, slug, 'gifts')} />
        </div>
      </section>
      <section aria-labelledby="connect" className="space-y-3">
        <h2 id="connect" className="text-base font-semibold">
          Connect your CRM
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">Send roster changes automatically instead of uploading files. Each call shows up in the upload history below.</p>
        <OrgKeysPanel
          keys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null }))}
          makeKey={makeCollegeKey.bind(null, slug)}
          turnOff={turnOffCollegeKey.bind(null, slug)}
          example={example}
        />
      </section>
      <section aria-labelledby="reminders" className="space-y-2">
        <h2 id="reminders" className="text-base font-semibold">
          Invitation reminders
        </h2>
        <CommsToggles value={readComms(inst.enabledFeatures)} save={saveCollegeComms.bind(null, slug)} showAccessNotice={false} />
      </section>
      {runs.length > 0 && (
        <Table caption="Upload history" head={['When', 'File', 'Rows', 'Problems', 'Result']}>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2">{fmtDate(r.startedAt)}</td>
              <td className="px-4 py-2">{r.fileName ?? (r.direction === 'IMPORT_GIFTS' ? 'Gifts' : 'Roster')}</td>
              <td className="px-4 py-2 tabular-nums">{r.rowCount}</td>
              <td className="px-4 py-2 tabular-nums">{r.errorCount}</td>
              <td className="px-4 py-2">{r.status === 'SUCCEEDED' ? 'Imported' : r.status === 'PARTIAL' ? 'Imported, some rows skipped' : r.status === 'FAILED' ? 'Not imported' : 'Running'}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}

// What each license tier buys (product design, Packaging), in the buyer's terms.
const TIER_VALUE: Record<string, string> = {
  CAREER: 'Every alum and student gets the full NextChapter toolkit, with Career Services and Alumni Relations workspaces and a light employer portal.',
  ADVANCEMENT: 'Everything in Career, plus Development: the do-not-solicit flag, gratitude asks, CRM sync, the Resilience Fund and an ROI dashboard that shows the license paying for itself.',
  INSTITUTION: 'Everything in Advancement, plus Exec Ed and Teaching: programs, cohorts and credentials in the same portal, with WIOA funding as an option.',
}

// Admin home: the few steps from contract to a live portal, each with where
// to do it. Done steps are ticked from real data, not a stored checklist.
async function LaunchChecklist({ ctx }: { ctx: WorkspaceContext }) {
  const id = ctx.institution.id
  const base = `/i/${ctx.institution.slug}`
  const [inst, staff, members, coaches, jobs, relatedLinked] = await Promise.all([
    prisma.institution.findUnique({ where: { id }, select: { logoUrl: true, accentColor: true, enabledFeatures: true, tier: true } }),
    prisma.institutionUser.findMany({ where: { institutionId: id, revokedAt: null }, select: { role: true } }),
    prisma.institutionMember.count({ where: { institutionId: id } }),
    prisma.coach.count({ where: { institutionId: id } }),
    prisma.exclusiveJobPosting.count({ where: { institutionScopeId: id, archivedAt: null } }),
    // Organizations this one has linked: each link is an invitation to claim a free page.
    prisma.ecosystemPartner.count({ where: { institutionId: id, crmOrganizationId: { not: null } } }).catch(() => 0),
  ])
  // Until the first link, the first thing to do is choose who to invite (cached for 30 minutes, shared with the Related organizations screen).
  const suggestions = relatedLinked === 0 ? await suggestRelated(id).catch(() => []) : []
  const roles = new Set(staff.map((s) => s.role))
  const wanted: InstitutionUserRole[] = ['CAREER_SERVICES', 'ALUMNI_RELATIONS', ...(inst?.tier === 'CAREER' ? [] : (['DEVELOPMENT'] as const))]
  const officesNeeded = wanted.filter((r) => !roles.has(r))
  const steps: { done: boolean; label: string; detail: string; href?: string }[] = [
    {
      done: relatedLinked > 0,
      label: 'Invite the people you work with',
      detail: relatedLinked > 0 ? `${relatedLinked} linked. Each one gets an invite to claim a free page of its own.` : suggestions.length ? suggestionLine(suggestions.length) : 'Link the employers, colleges and boards you work with; each gets an invite to claim a free page.',
      href: `${base}/admin/related`,
    },
    { done: !!(inst?.logoUrl && inst.accentColor), label: 'Add your brand', detail: 'Logo, color and a campus photo.', href: `${base}/admin/branding` },
    {
      done: officesNeeded.length === 0,
      label: 'Invite your team',
      detail: officesNeeded.length ? `Still needed: ${officesNeeded.map((r) => STAFF_ROLE_LABELS[r]).join(', ')}.` : 'Each office has someone.',
      href: `${base}/admin/users`,
    },
    {
      done: !!(inst?.enabledFeatures as { services?: unknown } | null)?.services,
      label: 'Choose your services',
      detail: 'Switch on what you offer; each becomes a card for alumni.',
      href: `${base}/admin/services`,
    },
    {
      done: members > 0,
      label: 'Load your alumni',
      detail: members ? `${members.toLocaleString()} on the roster.` : 'Upload your roster CSV, or send it to NextChapter and we’ll load it.',
      href: `${base}/admin/roster`,
    },
    { done: coaches > 0, label: 'Add your coaches (optional)', detail: 'Invite them with the Coach role; they get the NextChapter coach portal.', href: `${base}/admin/users` },
    { done: jobs > 0, label: 'Post an alumni job', detail: 'Roles only your alumni see.', href: `${base}/career/jobs` },
  ]
  const done = steps.filter((st) => st.done).length
  return (
    <section aria-labelledby="launch" className="space-y-3">
      <div>
        <h2 id="launch" className="text-base font-semibold">
          Launch checklist · {done} of {steps.length}
        </h2>
        {inst && <p className="max-w-2xl text-sm text-muted-foreground">{TIER_VALUE[inst.tier]}</p>}
      </div>
      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {steps.map((st) => (
          <li key={st.label} className="flex items-start gap-3 px-4 py-3">
            {st.done ? (
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-700" aria-label="Done" />
            ) : (
              <Circle className="mt-0.5 size-4 text-muted-foreground" aria-label="To do" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{st.label}</p>
              <p className="text-xs text-muted-foreground">{st.detail}</p>
            </div>
            {st.href && !st.done && (
              <Link href={st.href} className="text-sm font-medium text-primary hover:underline">
                Do this
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

async function AdminBranding({ ctx }: ScreenProps) {
  const i = await prisma.institution.findUnique({
    where: { id: ctx.institution.id },
    select: { programBrandName: true, accentColor: true, logoUrl: true, profile: true, enabledFeatures: true },
  })
  const profile = readProfile(i?.profile)
  // Offices this college can open (or a higher tier would add), each with our name and theirs.
  const kind = orgKindOf(ctx.institution.orgType)
  const names = officeNamesOf(i?.enabledFeatures)
  const offices = WORKSPACES.filter((w) => (RENAMABLE_OFFICES as readonly string[]).includes(w.key) && (!w.orgKind || w.orgKind === kind)).map((w) => ({
    key: w.key,
    standard: labelFor(w, kind),
    current: names[w.key] ?? null,
  }))
  return (
    <div className="space-y-6">
    <BrandingForm
      saveAction={saveBranding.bind(null, ctx.institution.slug)}
      defaults={{
        programBrandName: i?.programBrandName ?? null,
        accentColor: i?.accentColor ?? null,
        tagline: profile.tagline ?? null,
        logoUrl: i?.logoUrl ?? null,
        heroImageUrl: profile.heroImageUrl ?? null,
      }}
    />
    {ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly && <OfficeNamesForm saveAction={saveOfficeNames.bind(null, ctx.institution.slug)} offices={offices} max={OFFICE_NAME_MAX} />}
    </div>
  )
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))))

async function SettingsServices({ ctx }: ScreenProps) {
  const kind = orgKindOf(ctx.institution.orgType)
  const { enabledFeatures } = await loadInstitutionData(ctx.institution.id)
  const canEdit = ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly
  const annualMonth = checkInMonthFrom(enabledFeatures)
  const [usage, rosterOptions] = await Promise.all([serviceUsage30d(ctx.institution.id), canEdit ? rosterAutoJoinOptions(ctx.institution.id) : Promise.resolve(undefined)])
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Choose what {ctx.institution.name} offers. Switch a service on and its card appears on the Candidate home for the audiences you pick;
        each card shows how many {kind === 'workforce' ? 'people' : 'members'} opened it.
      </p>
      {kind === 'college' && (
      <form action={setAnnualCheckInMonth.bind(null, ctx.institution.slug)} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="annual-month">Annual career check-in goes out in</Label>
          <select
            id="annual-month"
            name="annualMonth"
            defaultValue={annualMonth}
            disabled={!canEdit}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <SubmitButton variant="outline" pendingLabel="Saving…">
            Save month
          </SubmitButton>
        ) : (
          <p className="text-xs text-muted-foreground">Only an institution admin can change this.</p>
        )}
        <p className="w-full text-xs text-muted-foreground">
          New-grad check-ins go out 6, 18 and 24 months after graduation (May, unless a member&apos;s date is known).
        </p>
      </form>
      )}
      <ServicesPanel
        slug={ctx.institution.slug}
        initial={serviceSettingsFrom(enabledFeatures, kind)}
        custom={customServices(enabledFeatures)}
        rosterOptions={rosterOptions}
        usage={usage}
        canEdit={canEdit}
        kind={kind}
        plan={ctx.institution.plan}
        pitch={ctx.institution.isDemo && kind === 'college'}
      />
    </div>
  )
}

async function SettingsOverview({ ctx, ...rest }: ScreenProps) {
  if (orgKindOf(ctx.institution.orgType) === 'workforce') return <WorkforceOverview ctx={ctx} searchParams={rest.searchParams} base={rest.base} />
  const i = await prisma.institution.findUnique({
    where: { id: ctx.institution.id },
    select: {
      name: true,
      programBrandName: true,
      slug: true,
      tier: true,
      alumniCount: true,
      includedSeats: true,
      licenseStartAt: true,
      licenseEndAt: true,
      enabledFeatures: true,
      givingUrl: true,
      profile: true,
    },
  })
  if (!i) return null
  const features = (i.enabledFeatures ?? {}) as { graceDays?: number; fiscalYearStartMonth?: number }
  const checklist = <LaunchChecklist ctx={ctx} />
  const sender = emailSettingsFrom(i.enabledFeatures, i)
  const facts: [string, string][] = [
    ['Name', i.name],
    ['Program name', i.programBrandName ?? '—'],
    ['Portal address', `/i/${i.slug}`],
    ['Tier', TIER_LABELS[i.tier]],
    ['Alumni', i.alumniCount?.toLocaleString() ?? '—'],
    ['Included seats', i.includedSeats.toLocaleString()],
    ['License', [fmtDate(i.licenseStartAt), fmtDate(i.licenseEndAt)].filter(Boolean).join(' – ') || '—'],
  ]
  return (
    <div className="space-y-6">
      {checklist}
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium break-words">{v}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-muted-foreground">Public alumni page (link it from your website)</dt>
          <dd className="text-sm font-medium break-words">
            <Link href={`/i/${i.slug}/for-alumni`} target="_blank" className="text-primary hover:underline">
              /i/{i.slug}/for-alumni
            </Link>
          </dd>
        </div>
      </dl>
      <PeerBenchmarkCard ctx={ctx} />
      <CollegeSettingsForm
        action={saveCollegeSettings.bind(null, i.slug)}
        canEdit={ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly}
        defaults={{
          graceDays: graceDaysFrom(i.enabledFeatures),
          fiscalYearStartMonth: features.fiscalYearStartMonth ?? 7,
          givingUrl: i.givingUrl,
          fromName: sender.fromName,
          replyTo: sender.replyTo ?? '',
          wioa: wioaOn(i.enabledFeatures),
          timeZone: collegeTimeZone(i.enabledFeatures, i.profile),
        }}
      />
      <CollegeProfile profile={readProfile(i.profile)} />
    </div>
  )
}

function CollegeProfile({ profile }: { profile: InstitutionProfile }) {
  const c = profile.college
  if (!c && !profile.photos?.length) return null
  return (
    <section aria-labelledby="college-profile" className="space-y-3 pt-4">
      <h2 id="college-profile" className="text-base font-semibold">
        College profile
      </h2>
      <PhotoStrip profile={profile} />
      {c?.facts?.length ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.facts.map((f) => (
            <div key={f.label} className="rounded-lg border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm font-semibold">{f.value}</dd>
              <dd className="mt-1 text-[11px] text-muted-foreground">
                {f.sourceUrl ? (
                  <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {f.source}
                  </a>
                ) : (
                  f.source
                )}
                {f.asOf ? ` · ${f.asOf}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {c?.careerCenter && (
        <p className="text-sm">
          <span className="font-medium">{c.careerCenter.name}</span>
          {c.careerCenter.url && (
            <a href={c.careerCenter.url} target="_blank" rel="noreferrer" className="ml-2 text-primary hover:underline">
              Website
            </a>
          )}
        </p>
      )}
    </section>
  )
}

// Admin > Activity: the exports this organization can run and a plain record of who did what (team changes, branding,
// downloads). The same page every other partner portal has (src/components/partners/PartnerActivity.tsx).
async function AdminActivity({ ctx }: ScreenProps) {
  const events = await listPartnerAudit(auditPortalOf(ctx.institution.orgType), ctx.institution.id)
  const out = `/i/${ctx.institution.slug}/export`
  const has = (w: WorkspaceKey) => ctx.workspaces.includes(w)
  const downloads = [
    ...(has('development')
      ? [
          { label: 'CRM updates file', href: `${out}/updates`, note: 'Approved updates for your CRM. Downloading marks those signals as exported.' },
          { label: 'Do-not-solicit list', href: `${out}/suppression`, note: 'People who asked not to be contacted, to load into your CRM.' },
        ]
      : []),
    ...(has('workforce')
      ? [{ label: 'Training program results', href: `${out}/etpl`, note: 'Enrollment, completion, credential and placement rates for each program.' }]
      : []),
  ]
  return <PartnerActivity downloads={downloads} events={events.map((e) => ({ id: e.id, action: e.action, actor: e.actorLabel, at: e.createdAt }))} />
}

async function SettingsStaff({ ctx }: ScreenProps) {
  // Staff of a school or department see and manage only their unit's team (owner decision 2026-11-18).
  const unitIds = ctx.units?.map((u) => u.id) ?? null
  const [staff, units] = await Promise.all([
    prisma.institutionUser.findMany({
      where: { institutionId: ctx.institution.id, ...(unitIds ? { unitId: { in: unitIds } } : {}) },
      orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { fullName: 'asc' }],
      select: { id: true, fullName: true, invitedEmail: true, role: true, workspace: true, acceptedAt: true, revokedAt: true, unitId: true, unit: { select: { name: true } } },
    }),
    unitIds ? Promise.resolve([]) : prisma.institutionUnit.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const canManage = ctx.tokens.has('INSTITUTION_ADMIN') && !ctx.readOnly && !ctx.institution.isDemo
  // The free plan has one administrator (owner decision 2026-11-17), so the invite form goes once that place is taken: the
  // institution's own administrator, or a unit's for a unit's staff.
  const adminLimit = institutionEntitlements({ plan: ctx.institution.plan }).adminLimit
  const adminSeatTaken = adminLimit !== null && staff.filter((s) => s.role === 'INSTITUTION_ADMIN' && !s.revokedAt && (unitIds ? true : !s.unitId)).length >= adminLimit
  // A role is "locked" when every workspace it would open needs a higher tier.
  // The tier this person works under: a paid school or department opens Development even on a Career-tier university.
  const tier = ctx.institution.tier
  const lockedRoles: Record<string, string> = {}
  for (const role of Object.keys(STAFF_ROLE_LABELS)) {
    const opens = WORKSPACES.filter((w) => w.release === 'V1' && w.key !== 'candidate' && w.key !== 'employer' && w.requiredRoles.includes(role as never))
    const blocked = opens.filter((w) => !tierIncludes(tier, w))
    if (opens.length && blocked.length === opens.length) lockedRoles[role] = TIER_LABELS[blocked[0].minTier!]
  }
  return (
    <div className="space-y-3">
      <Table caption="Staff" head={['Name', 'Email', 'Role', 'Status', '']}>
        {staff.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-2 font-medium">{s.fullName ?? '—'}</td>
            <td className="px-4 py-2">{s.invitedEmail}</td>
            <td className="px-4 py-2">
              {staffRoleLabel(s.role, orgKindOf(ctx.institution.orgType))}
              {s.workspace ? ` (${getWorkspace(s.workspace)?.label ?? s.workspace}, read-only)` : ''}
              {s.unit && <span className="block text-xs text-muted-foreground">{s.unit.name}</span>}
            </td>
            <td className="px-4 py-2">{s.revokedAt ? 'Removed' : s.acceptedAt ? 'Active' : 'Invited'}</td>
            <td className="px-4 py-2">
              {canManage && (
                <span className="flex flex-wrap justify-end gap-2">
                  {(!s.acceptedAt || s.revokedAt) && (
                    <ActionButton label={s.revokedAt ? 'Invite again' : 'Resend invite'} done="Sent." run={resendStaffInvite.bind(null, ctx.institution.slug, s.id)} />
                  )}
                  {!s.revokedAt && (
                    <ConfirmActionButton variant="outline" label="Remove" confirm={`Remove ${s.fullName ?? s.invitedEmail} as ${staffRoleLabel(s.role, orgKindOf(ctx.institution.orgType))}? They lose access right away.`} confirmLabel="Remove" run={removeStaff.bind(null, ctx.institution.slug, s.id)} />
                  )}
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-muted-foreground">To change someone’s role, invite them with the new role, then remove the old one.</p>
      {ctx.institution.isDemo ? (
        <p className="text-xs text-muted-foreground">Invites are off on demo colleges: their staff are fictional.</p>
      ) : adminSeatTaken ? (
        <p className="text-sm text-muted-foreground">The free plan has one administrator, and that place is taken.</p>
      ) : (
        <StaffInviteForm inviteAction={inviteStaff.bind(null, ctx.institution.slug)} lockedRoles={lockedRoles} adminOnly={!institutionEntitlements({ plan: ctx.institution.plan }).staffRoles} kind={orgKindOf(ctx.institution.orgType)} units={ctx.units?.length ? ctx.units.map((u) => ({ id: u.id, name: u.name })) : units} unitRequired={!!ctx.units?.length} />
      )}
      {!institutionEntitlements({ plan: ctx.institution.plan }).staffRoles && <LockedFeature feature="staffRoles" slug={ctx.institution.slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} compact />}
    </div>
  )
}

// What each not-yet-built tab will do, for its placeholder.
export const COMING_DESCRIPTIONS: Record<string, string> = {
  'candidate:privacy': 'Four plain-language sharing toggles and "Who viewed my profile."',
  'candidate:mentors': 'Browse alumni mentors by industry and function, and request a call.',
  'alumni:layoffs': 'Layoff notices matched to alumni employers, with one-click outreach.',
  'alumni:outreach': 'Campaigns, a merge-field template editor, and a send log with opens, clicks and claims.',
  'alumni:mentors': 'The mentor roster, invitations and request activity.',
  'alumni:engagement': 'Engagement score distribution and CASE breakdown by class decade.',
  'alumni:data': 'Where alumni work: function, seniority, industry, employer size, region and founders.',
  'development:signals': 'Promotion, new-employer and gratitude signals to approve, dismiss or export.',
  'development:fund': 'Resilience Fund settings, awards and the donor report.',
  'development:crm': 'Roster and gift CSV uploads, the updates export, and run history.',
  'career:checkins': 'Automatic M6, M18 and M24 check-ins with responses.',
  'career:students': 'Invite students and recent grads.',
  'career:employers': 'Approve employers and set package tier and featured dates.',
  'employer:page': "The employer's branded page and roles posted only to this college's members.",
  'admin:roster': 'Roster import and the CRM exchange.',
  'teaching:capstones': 'Employers sponsor capstone projects your students and Exec Ed cohorts deliver.',
  'execed:enrollments': 'Cohorts, enrollment, attendance and credentials.',
  'execed:clients': 'Employers who buy seats or custom programs for their teams.',
}

// Tabs built from several sections, each hidden when its feature is off.
async function CandidateWork(props: ScreenProps) {
  const mods = await loadModules(props.ctx.institution.id)
  return (
    <div className="space-y-10">
      {mods.alumniJobs && <CandidateJobs {...props} />}
      <ProjectsSection {...props} />
    </div>
  )
}
async function AlumniCommunityAll(props: ScreenProps) {
  return (
    <div className="space-y-10">
      <AlumniCommunity {...props} />
      <AlumniInNews {...props} />
    </div>
  )
}
async function CandidatePeople(props: ScreenProps) {
  return (
    <div className="space-y-10">
      <PeopleSections {...props} />
      <ConnectSections ctx={props.ctx} />
      <CandidateNetwork {...props} />
      <AlumniInNews {...props} />
    </div>
  )
}
async function CandidateMentoring(props: ScreenProps) {
  const mods = await loadModules(props.ctx.institution.id)
  return (
    <div className="space-y-10">
      <MentoringCohortsSection {...props} />
      {mods.mentors && <MentorsScreen {...props} />}
    </div>
  )
}
async function CandidateLearn(props: ScreenProps) {
  const mods = await loadModules(props.ctx.institution.id)
  return (
    <div className="space-y-10">
      <SkillsBridgeSection {...props} />
      <ResearchAndPatents {...props} />
      <LearnSections {...props} />
      {mods.programs && <CandidatePrograms {...props} />}
    </div>
  )
}
async function CandidatePrivacyAll(props: ScreenProps) {
  return (
    <div className="space-y-10">
      <CandidatePrivacy {...props} />
      <PrivacyExtras ctx={props.ctx} />
    </div>
  )
}
async function AlumniMentorsAll(props: ScreenProps) {
  return (
    <div className="space-y-10">
      <AlumniMentors {...props} />
      <StaffCohorts ctx={props.ctx} />
    </div>
  )
}
async function AdminServicesAll(props: ScreenProps) {
  if (orgKindOf(props.ctx.institution.orgType) === 'workforce') return <SettingsServices {...props} />
  return (
    <div className="space-y-10">
      <FeaturesPanel ctx={props.ctx} />
      <MonthlyEmailPanel ctx={props.ctx} />
      <SettingsServices {...props} />
    </div>
  )
}

async function AdminPrivacyAll(props: ScreenProps) {
  return (
    <div className="space-y-10">
      <AdminPrivacy {...props} />
      <ConsentHistory ctx={props.ctx} />
    </div>
  )
}
async function StaffConnectScreen(props: ScreenProps) {
  return <StaffConnect ctx={props.ctx} />
}

export const WORKSPACE_SCREENS: Record<string, ComponentType<ScreenProps>> = {
  'candidate:home': CandidateHome,
  'academic:home': AcademicAtRisk,
  'academic:skills': AcademicSkills,
  'academic:employers': AcademicEmployers,
  'academic:retraining': AcademicRetraining,
  'academic:programs': AcademicPrograms,
  'academic:state': AcademicState,
  'academic:peers': AcademicPeers,
  'candidate:groups': CandidateGroups,
  'candidate:mentors': CandidateMentoring,
  'alumni:home': AlumniHome,
  'alumni:mentors': AlumniMentorsAll,
  'alumni:community': AlumniCommunityAll,
  'alumni:volunteers': AlumniVolunteers,
  'teaching:auditors': TeachingAuditors,
  'teaching:groups': TeachingGroups,
  'admin:privacy': AdminPrivacyAll,
  'alumni:connect': StaffConnectScreen,
  'career:circles': StaffConnectScreen,
  'candidate:giveback': CandidateGiveBack,
  'alumni:members': AlumniMembers,
  'development:home': DevelopmentRoi,
  'development:signals': DevelopmentSignals,
  'development:fund': DevelopmentFund,
  'development:crm': DevelopmentCrm,
  'development:transition': DevelopmentTransition,
  'career:home': CareerCaseload,
  'career:outcomes': OutcomesScreen,
  'employer:home': EmployerDossiersWithIntros,
  'employer:page': EmployerPage,
  'candidate:jobs': CandidateWork,
  'candidate:internships': InternshipsScreen,
  'career:internships': InternshipsScreen,
  'career:employers': CareerEmployers,
  'career:students': CareerStudents,
  'alumni:region': Region,
  'career:region': Region,
  'alumni:jobs': AlumniJobs,
  'career:jobs': AlumniJobs,
  'career:companies': TargetCompanies,
  'career:recruiting': RecruitingScreen,
  'candidate:coaching': CandidateCoaching,
  'career:coaching': CareerCoaching,
  'ventures:home': VenturesFounders,
  'teaching:home': TeachingCourses,
  'teaching:faculty': TeachingFaculty,
  'execed:home': ExecEdPrograms,
  'execed:enrollments': ExecEdEnrollments,
  'execed:clients': ExecEdClients,
  'teaching:capstones': TeachingCapstones,
  'candidate:programs': CandidateLearn,
  'workforce:home': WorkforceHome,
  'workforce:rapid': WorkforceRapid,
  'workforce:etpl': WorkforceEtpl,
  'candidate:network': CandidatePeople,
  'alumni:events': AlumniEvents,
  'admin:board': AdminBoard,
  'admin:impact': AdminImpact,
  'admin:home': SettingsOverview,
  'admin:branding': AdminBranding,
  'admin:roster': AdminRoster,
  'candidate:privacy': CandidatePrivacyAll,
  'admin:services': AdminServicesAll,
  'admin:users': SettingsStaff,
  'admin:activity': AdminActivity,
  'alumni:layoffs': AlumniLayoffs,
  'alumni:outreach': AlumniOutreach,
  'alumni:engagement': AlumniEngagement,
  'alumni:data': AlumniData,
  'development:grants': DevelopmentGrants,
  'admin:grants': DevelopmentGrants,
  'admin:related': AdminRelatedOrgs,
  'admin:units': AdminUnits,
  'admin:connections': AdminConnections,
  'admin:publicpage': AdminPublicPage,
  // A workforce organization's Admin pages that moved (owner, 2026-11-18); a college keeps them in Admin.
  'wfhub:publicpage': AdminPublicPage,
  'wfhub:branding': AdminBranding,
  'wfhub:board': AdminBoard,
  'partnerhub:related': AdminRelatedOrgs,
  'execed:bridge': StaffSkillsBridge,
  'career:bridge': StaffSkillsBridge,
  'career:checkins': CareerCheckIns,
  'hub:home': HubHome,
  'hub:companies': HubCompanies,
  'hub:layoffs': HubLayoffs,
  'hub:participants': HubPeople,
  'hub:cohorts': HubCohorts,
  'hub:local': HubLocal,
  'hub:pipeline': HubPipeline,
  'hub:jobs': HubJobs,
  'education:learning': HubLearning,
  'hub:upskill': HubUpskill,
  'hub:skills': HubSkills,
  'hub:rapid': HubRapid,
  'hub:benefits': HubBenefits,
  'hub:attract': HubAttract,
  'wfhub:grants': HubGrants,
  'education:programs': ExecEdPrograms,
  'education:enrollments': ExecEdEnrollments,
  'hub:clients': ExecEdClients,
  'hub:wioa': WorkforceHome,
  'education:etpl': WorkforceEtpl,
  'hub:responses': WorkforceRapid,
  'partnerhub:system': HubSystem,
  'wfhub:opportunities': HubFunding,
  'wfhub:public': HubPublic,
  'business:home': BusinessHome,
  'business:leads': BusinessLeads,
  'business:pitch': BusinessPitch,
  'business:incentives': BusinessIncentives,
  'business:employers': BusinessEmployers,
  'business:small': BusinessSmall,
  'wfhub:applications': HubApplications,
  'hub:report': HubReport,
  'hub:skillsgap': HubSkillsGaps,
  'wfhub:home': WfHome,
  'partnerhub:partners': WfPartners,
  'partnerhub:groups': WfGroups,
  'partnerhub:referrals': WfReferrals,
  'partnerhub:feed': WfFeed,
  'partnerview:groups': PartnerGroups,
  'partnerview:feed': PartnerFeed,
  'education:catalog': EducationCatalog,
  'education:assign': EducationAssign,
  'education:gaps': EducationGaps,
  'wfhub:grantlist': DevelopmentGrants,
  'hub:talent': HubTalent,
  'hub:regionjobs': HubRegionJobs,
  'hub:groupjobs': HubGroupJobs,
  'hub:employerjobs': HubEmployerJobs,
  'partnerhub:views': HubPartnerViews,
  'partnerhub:ecosystem': HubEcosystem,
  'partnerhub:network': HubNetwork,
  'partnerview:overview': PartnerOverview,
  'partnerview:shared': PartnerShared,
  'hub:region': Region,
  'employer:overview': CompanyOverview,
  'employer:support': CompanySupport,
  'employer:training': CompanyTraining,
  'employer:grants': CompanyGrants,
  'employer:workforce': CompanyWorkforce,
  'employer:colleges': CompanyColleges,
}
