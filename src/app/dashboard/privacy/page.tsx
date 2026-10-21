import { SITUATION_FIELDS } from '@/lib/journey/situation'
import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { NotificationTierSelector } from '@/components/candidates/NotificationTierSelector'
import { EmailTopicToggles } from '@/components/candidates/EmailTopicToggles'
import { CommunitySettingsToggles } from '@/components/dashboard/CommunitySettingsToggles'
import { WhatTheySeeSection } from '@/components/dashboard/WhatTheySeeSection'
import { RecruiterDatabaseOptIn } from '@/components/dashboard/RecruiterDatabaseOptIn'
import { ResumeBookOptIn } from '@/components/dashboard/ResumeBookOptIn'
import { ConfidentialModeToggle } from '@/components/dashboard/ConfidentialModeToggle'
import { LeaderboardOptInSettings } from '@/components/dashboard/LeaderboardOptInSettings'
import { JourneySelector } from '@/components/dashboard/JourneySelector'
import { loadAffiliations } from '@/lib/affiliations/load'
import { AffiliationVisibilityCard } from '@/components/dashboard/AffiliationVisibilityCard'
import { effectiveJourney, effectiveStage, getJourney, moveDriverOf } from '@/lib/journey/journey'
import { CoachAccessSettings } from '@/components/dashboard/CoachAccessSettings'
import { DeleteAccountForm } from '@/components/dashboard/DeleteAccountForm'
import { DeleteGoogleDataForm } from '@/components/dashboard/DeleteGoogleDataForm'
import Link from 'next/link'
import { MyRecruitersSection } from '@/components/dashboard/MyRecruitersSection'
import { ConnectedAccountsSettings, type ConnectionState } from '@/components/dashboard/ConnectedAccountsSettings'
import { withOAuthReturnTo } from '@/lib/google/oauth-links'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { Callout } from '@/components/candidate/Callout'
import { ActionWindowField } from '@/components/dashboard/ActionWindowField'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Privacy Settings' }

// What a failed Google connect came back with (see google-connect/start and /callback).
const CONNECT_ERROR: Record<string, string> = {
  denied: 'Google sign-in was cancelled, so nothing was connected. Try again when you’re ready.',
  no_refresh_token: 'Google didn’t grant lasting access. Try again, and approve every permission Google asks about.',
  corporate_domain_blocked: 'That looks like a work account your employer controls. Connect a personal Google account instead.',
  not_a_tester: 'Google connection is in limited testing and isn’t open to your account yet. We’ll let you know when it is.',
  not_logged_in: 'Your session ended during sign-in. Log in again, then reconnect.',
  exchange_failed: 'Something went wrong finishing the connection. Try again in a minute.',
  not_configured: 'Google connection isn’t available right now. Try again later.',
}

const stamp = (d: Date | null) => d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : null

function detailText(details: unknown, key: string): string {
  const v = (details as Record<string, unknown> | null)?.[key]
  return typeof v === 'string' || typeof v === 'number' ? String(v) : ''
}

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ gmailConnected?: string; gmailError?: string }> }) {
  const profile = await getDashboardProfile()
  const [affiliations, params, emailConn, calendarConn, dossierStatus, coach, intakeConnections] = await Promise.all([
    loadAffiliations(profile.id),
    searchParams,
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id }, orderBy: { connectedAt: 'desc' }, select: { connectedEmail: true, connectedAt: true, lastSyncAt: true, disconnectedAt: true, needsReconnectAt: true } }),
    prisma.calendarConnection.findUnique({ where: { candidateId: profile.id }, select: { connectedAt: true, lastSyncAt: true, disconnectedAt: true, needsReconnectAt: true } }),
    isDossierUnlocked(profile.id),
    profile.coachId
      ? prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
      : Promise.resolve(null),
    // NextChapter Talent: firms this candidate is connected to through a
    // recruiter's Inbound page or forwarded resume.
    prisma.intakeConnection.findMany({
      where: { disconnectedAt: null, intakeCandidate: { candidateId: profile.id } },
      include: { firm: { select: { name: true } }, recruiter: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const stateOf = (c: { disconnectedAt: Date | null; needsReconnectAt: Date | null; lastSyncAt: Date | null } | null, account: string | null): ConnectionState =>
    !c || c.disconnectedAt ? { status: 'not_connected', account: null, lastChecked: null }
      : { status: c.needsReconnectAt ? 'expired' : 'connected', account, lastChecked: stamp(c.lastSyncAt) }
  // One Google sign-in creates both connections, so the calendar belongs to
  // the same account as Gmail when they were connected together.
  const calendarAccount = emailConn && calendarConn && Math.abs(emailConn.connectedAt.getTime() - calendarConn.connectedAt.getTime()) < 5 * 60 * 1000
    ? emailConn.connectedEmail : null
  const gmailState = stateOf(emailConn, emailConn?.connectedEmail ?? null)
  const calendarState = stateOf(calendarConn, calendarAccount)
  const connectError = params.gmailError ? CONNECT_ERROR[params.gmailError] ?? CONNECT_ERROR.exchange_failed : null
  const SOURCE_LABEL = { PAGE: 'You sent your resume', NOT_FIT_LINK: 'You sent your resume', FORWARD: 'Your resume was forwarded' } as const

  // Account and privacy in the redesign (docs/redesign-old-card-audit-network-account.md): who can see your search and
  // what we read come first, each control says what is true now and what changing it does. Every other control is
  // still here, one fold down. No status pills, no bordered cards, and no 5-way button row.
  const block = (id: string, title: string, intro: string | null, children: React.ReactNode, tone?: 'danger') => (
    <section key={id} id={id} aria-labelledby={`${id}-h`} className="scroll-mt-4 space-y-3">
      <h2 id={`${id}-h`} className={cn('font-display text-xl font-semibold', tone === 'danger' ? 'text-destructive' : 'text-ink')}>{title}</h2>
      {intro && <p className="max-w-xl text-base text-muted-foreground">{intro}</p>}
      {children}
    </section>
  )
  const quietLink = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'
  return (
    <div className="space-y-8">
      <PageHeader title="Account and privacy" intro="You decide who can see your search and what we can read. Each choice says what it changes, and you can change it any time." />

      <Section id="who-can-see" title="Who can see your search">
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-ink">Confidential Search Mode</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              This decides whether anyone outside NextChapter can see your search at all: the community, LinkedIn, outreach, email, Gmail and recruiter sharing.
            </p>
            {!profile.confidentialSearchMode && effectiveJourney(profile) && getJourney(effectiveJourney(profile)!).employed && (
              <Callout>Your situation is one where you have a job, and Confidential Search Mode is off, so other members and your colleges could see your search. Turn it on if you do not want anyone at work to find out.</Callout>
            )}
            <ConfidentialModeToggle enabled={profile.confidentialSearchMode} />
          </div>
          <PrivacyTierSelector currentTier={profile.privacyTier} alreadyAwarded={!!profile.privacyOpenedUpBonusAt} />
          <div id="recruiter-matching" className="scroll-mt-4 space-y-2">
            <h3 className="text-base font-semibold text-ink">Employers and recruiters</h3>
            <p className="max-w-xl text-sm text-muted-foreground">Whether employers using NextChapter&apos;s hiring tools can match you against open roles at all. It is separate from the visibility above.</p>
            <RecruiterDatabaseOptIn optedIn={profile.recruiterDatabaseOptIn} dossierUnlocked={dossierStatus.unlocked} dossierReason={dossierStatus.reason} confidentialSearchMode={profile.confidentialSearchMode} />
          </div>
        </div>
      </Section>

      <section id="connected-accounts" aria-labelledby="connected-accounts-h" className="scroll-mt-4 space-y-3">
        <h2 id="connected-accounts-h" className="font-display text-xl font-semibold text-ink">What we can read</h2>
        <p className="max-w-xl text-base text-muted-foreground">Choose what NextChapter reads to count your search activity for you.</p>
        {params.gmailConnected && !connectError && <Callout>Gmail and Calendar connected. Your activity will start counting automatically.</Callout>}
        {connectError && <Callout tone="problem">{connectError}</Callout>}
        <ConnectedAccountsSettings gmail={gmailState} calendar={calendarState} connectHref={withOAuthReturnTo('/api/auth/google-connect/start', '/dashboard/privacy')} />
      </section>

      <MoreDetails summary="Show more: your situation, email, coach access, your data and your account">
        <div className="space-y-8">
          {block('situation', 'Your situation', 'Why you are moving (or growing where you are) and how close you are to applying. Your plan and check-ins follow these. Changing them does not change Confidential Search Mode on its own.',
            <JourneySelector
              journey={effectiveJourney(profile)}
              stage={effectiveStage(profile)}
              moveDriver={moveDriverOf(profile.journeyDetails)}
              intensity={profile.searchIntensity}
              details={{
                returnDate: detailText(profile.journeyDetails, 'returnDate'),
                offering: detailText(profile.journeyDetails, 'offering'),
                openDays: detailText(profile.journeyDetails, 'openDays'),
                engagementEnds: detailText(profile.journeyDetails, 'engagementEnds'),
                venture: detailText(profile.journeyDetails, 'venture'),
                situation: Object.fromEntries(SITUATION_FIELDS.map((f) => [f.key, detailText(profile.journeyDetails, f.key)])),
              }}
            />)}
          <AffiliationVisibilityCard affiliations={affiliations} />
          <p className="text-base">
            <Link href="/dashboard/recruiter-requests" className="font-medium text-brand underline underline-offset-4">See recruiter requests waiting on your answer</Link>
          </p>
          {intakeConnections.length > 0 &&
            block('my-recruiters', 'My recruiters', 'Search firms you are connected to through NextChapter. You choose what each one sees, and you can disconnect any time. You are never charged anything because of a recruiter connection.',
              <MyRecruitersSection
                connections={intakeConnections.map((c) => ({
                  id: c.id,
                  firmName: c.firm.name,
                  recruiterName: c.recruiter?.fullName ?? null,
                  source: SOURCE_LABEL[c.source],
                  scopes: c.consentScopes,
                }))}
              />)}
          {block('resume-book', 'Résumé Book', 'On by default, and switched on the first time you upload a résumé. It does not depend on your dossier. Turn it off any time.', <ResumeBookOptIn optedIn={profile.resumeBookOptIn} />)}
          <LeaderboardOptInSettings optedIn={profile.leaderboardOptIn} displayMode={profile.leaderboardDisplayMode} confidentialSearchMode={profile.confidentialSearchMode} />
          {block('email', 'Email', 'How often you hear from us, and which emails. Members who have not visited in a few weeks automatically get fewer. Your Market Reality Report and any reminder emails always send.',
            <div className="space-y-8">
              <NotificationTierSelector currentTier={profile.notificationTier} />
              <EmailTopicToggles
                optedOut={{
                  weeklyReportOptedOut: profile.weeklyReportOptedOut,
                  marketDigestOptedOut: profile.marketDigestOptedOut,
                  dailyEmailOptedOut: profile.dailyEmailOptedOut,
                  jobSearchDailyOptedOut: profile.jobSearchDailyOptedOut,
                }}
              />
              <ActionWindowField current={profile.actionWindow} />
            </div>)}
          {block('support-network', 'Community settings', null, <CommunitySettingsToggles weeklySprintTargetOptOut={profile.weeklySprintTargetOptOut} encouragementGivingOptIn={profile.encouragementGivingOptIn} />)}
          <WhatTheySeeSection candidateId={profile.id} />
          {coach && block('coach-access', 'Coach access', null, <CoachAccessSettings coachName={coach.fullName} hasConsented={profile.coachDossierConsentedAt !== null} />)}
          {block('money-help', 'Money help', 'Choose whether NextChapter helps with money. It is off until you turn it on, and you can delete the pay and savings numbers you gave us.', <Link href="/dashboard/money-help" className={quietLink}>Change money help</Link>)}
          {block('account', 'Your login', null, <Link href="/auth/forgot-password" className={quietLink}>Change my password</Link>)}
          {block('your-data', 'Your data', 'Download everything we hold about you (your profile, references, résumés, reports and activity) as a single file, any time you want it.', <a href="/api/export-data" download className={quietLink}>Download my data</a>)}
          {block('google-data', 'Your Google data', 'Delete everything we stored from your Gmail and Calendar, and remove our access to your Google account.', <DeleteGoogleDataForm hasGoogleData={!!emailConn || !!calendarConn} />)}
          {block('danger', 'Danger zone', 'Deactivate your account to make it unusable without deleting anything. For a real, permanent deletion, email support instead.', <DeleteAccountForm />, 'danger')}
        </div>
      </MoreDetails>
    </div>
  )
}
