import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { NotificationTierSelector } from '@/components/candidates/NotificationTierSelector'
import { ActionWindowSelector } from '@/components/dashboard/ActionWindowSelector'
import { CommunitySettingsToggles } from '@/components/dashboard/CommunitySettingsToggles'
import { WhatTheySeeSection } from '@/components/dashboard/WhatTheySeeSection'
import { RecruiterDatabaseOptIn } from '@/components/dashboard/RecruiterDatabaseOptIn'
import { ResumeBookOptIn } from '@/components/dashboard/ResumeBookOptIn'
import { ConfidentialModeToggle } from '@/components/dashboard/ConfidentialModeToggle'
import { LeaderboardOptInSettings } from '@/components/dashboard/LeaderboardOptInSettings'
import { CurrentJobStatusSelector } from '@/components/dashboard/CurrentJobStatusSelector'
import { CoachAccessSettings } from '@/components/dashboard/CoachAccessSettings'
import { DeleteAccountForm } from '@/components/dashboard/DeleteAccountForm'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { MyRecruitersSection } from '@/components/dashboard/MyRecruitersSection'
import { ConnectedAccountsSettings, type ConnectionState } from '@/components/dashboard/ConnectedAccountsSettings'
import { withOAuthReturnTo } from '@/lib/google/oauth-links'

export const metadata: Metadata = { title: 'Privacy Settings' }


// What a failed Google connect came back with (see google-connect/callback).
const CONNECT_ERROR: Record<string, string> = {
  denied: 'Google sign-in was cancelled, so nothing was connected. Try again when you’re ready.',
  no_refresh_token: 'Google didn’t grant lasting access. Try again, and approve every permission Google asks about.',
  corporate_domain_blocked: 'That looks like a work account your employer controls. Connect a personal Google account instead.',
  not_a_tester: 'Google connection is in limited testing and isn’t open to your account yet. We’ll let you know when it is.',
  not_logged_in: 'Your session ended during sign-in. Log in again, then reconnect.',
  exchange_failed: 'Something went wrong finishing the connection. Try again in a minute.',
}

const stamp = (d: Date | null) => d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : null

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ gmailConnected?: string; gmailError?: string }> }) {
  const profile = await getDashboardData()
  const params = await searchParams
  const [emailConn, calendarConn] = await Promise.all([
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id }, orderBy: { connectedAt: 'desc' }, select: { connectedEmail: true, connectedAt: true, lastSyncAt: true, disconnectedAt: true, needsReconnectAt: true } }),
    prisma.calendarConnection.findUnique({ where: { candidateId: profile.id }, select: { connectedAt: true, lastSyncAt: true, disconnectedAt: true, needsReconnectAt: true } }),
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
  const [dossierStatus, coach, intakeConnections] = await Promise.all([
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
  const SOURCE_LABEL = { PAGE: 'You sent your resume', NOT_FIT_LINK: 'You sent your resume', FORWARD: 'Your resume was forwarded' } as const

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <PageHeaderBoxes pageKey="privacy" candidateId={profile.id} />
      </div>

      <section id="connected-accounts" aria-labelledby="connected-accounts-h" className="space-y-3">
        <div>
          <h2 id="connected-accounts-h" className="text-lg font-semibold">Connected accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose what NextChapter can read to count your search activity for you.</p>
        </div>
        {params.gmailConnected && !connectError && (
          <p role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">Gmail and Calendar connected. Your activity will start counting automatically.</p>
        )}
        {connectError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{connectError}</p>}
        <ConnectedAccountsSettings
          gmail={gmailState}
          calendar={calendarState}
          connectHref={withOAuthReturnTo('/api/auth/google-connect/start', '/dashboard/privacy')}
        />
      </section>
      <PrivacyTierSelector currentTier={profile.privacyTier} alreadyAwarded={!!profile.privacyOpenedUpBonusAt} />

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Your situation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What best describes you today. Update this any time it changes — it won&apos;t change your
            Confidential Search Mode setting below on its own.
          </p>
        </div>
        <CurrentJobStatusSelector current={profile.currentJobStatus} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Confidential Search Mode</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A separate control from your privacy tier above — this governs whether your search is
            visible to anyone outside NextChapter at all, everywhere: Community, LinkedIn, outreach,
            email, Gmail, and recruiter sharing.
          </p>
        </div>
        <ConfidentialModeToggle enabled={profile.confidentialSearchMode} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Employer &amp; recruiter matching</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Separate from your privacy tier above — this controls whether employers using
            NextChapter&apos;s hiring tools can match you against open roles at all.
          </p>
        </div>
        <RecruiterDatabaseOptIn
          optedIn={profile.recruiterDatabaseOptIn}
          dossierUnlocked={dossierStatus.unlocked}
          dossierReason={dossierStatus.reason}
          confidentialSearchMode={profile.confidentialSearchMode}
        />
      </div>

      {intakeConnections.length > 0 && (
        <div id="my-recruiters" className="space-y-3 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">My recruiters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search firms you&apos;re connected to through NextChapter. You choose what each one sees, and you can
              disconnect anytime. You&apos;re never charged anything because of a recruiter connection.
            </p>
          </div>
          <MyRecruitersSection
            connections={intakeConnections.map((c) => ({
              id: c.id,
              firmName: c.firm.name,
              recruiterName: c.recruiter?.fullName ?? null,
              source: SOURCE_LABEL[c.source],
              scopes: c.consentScopes,
            }))}
          />
        </div>
      )}

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Resume Book</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            On by default — checked automatically the first time you upload a resume. Independent of
            your Dossier unlock status above; turn it off any time.
          </p>
        </div>
        <ResumeBookOptIn optedIn={profile.resumeBookOptIn} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <LeaderboardOptInSettings
          optedIn={profile.leaderboardOptIn}
          displayMode={profile.leaderboardDisplayMode}
          confidentialSearchMode={profile.confidentialSearchMode}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Email options</h2>
        <p className="text-sm text-muted-foreground">
          How often you hear from us. Your Market Reality Report and any reminder emails always send
          regardless of this setting.
        </p>
        <NotificationTierSelector currentTier={profile.notificationTier} />
        <ActionWindowSelector current={profile.actionWindow} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Support Network</h2>
        <CommunitySettingsToggles
          weeklySprintTargetOptOut={profile.weeklySprintTargetOptOut}
          encouragementGivingOptIn={profile.encouragementGivingOptIn}
        />
      </div>

      <WhatTheySeeSection candidateId={profile.id} />

      {coach && (
        <div className="space-y-3 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">Coach access</h2>
          <CoachAccessSettings coachName={coach.fullName} hasConsented={profile.coachDossierConsentedAt !== null} />
        </div>
      )}

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your login.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/auth/forgot-password" />} variant="outline">
          Change my password
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Your data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Download everything we hold about you — your profile, references, resumes, reports,
            and activity — as a single file, any time you want it.
          </p>
        </div>
        <Button nativeButton={false} render={<a href="/api/export-data" download />} variant="outline">
          Download my data
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deactivate your account — makes it unusable without deleting anything. For a real,
            permanent deletion, email support instead.
          </p>
        </div>
        <DeleteAccountForm />
      </div>
    </div>
  )
}
