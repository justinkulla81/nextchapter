import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade, type CandidateWithGradeRelations } from '@/lib/scoring/hireability-grade'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { NotificationTierSelector } from '@/components/candidates/NotificationTierSelector'
import { SmsConsentForm } from '@/components/candidates/SmsConsentForm'
import { ActionWindowSelector } from '@/components/dashboard/ActionWindowSelector'
import { CommunitySettingsToggles } from '@/components/dashboard/CommunitySettingsToggles'
import { WhatTheySeeSection } from '@/components/dashboard/WhatTheySeeSection'
import { RecruiterDatabaseOptIn } from '@/components/dashboard/RecruiterDatabaseOptIn'
import { CoachAccessSettings } from '@/components/dashboard/CoachAccessSettings'
import { DeleteAccountForm } from '@/components/dashboard/DeleteAccountForm'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { uploadMyProfilePicture, removeMyProfilePicture, toggleMyProfilePictureVisible } from './actions'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function PrivacyPage() {
  const profile = await getDashboardData()
  const grade = await computeHireabilityGrade(profile as unknown as CandidateWithGradeRelations)
  const coach = profile.coachId
    ? await prisma.coach.findUnique({ where: { id: profile.coachId }, select: { fullName: true } })
    : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-1 text-muted-foreground">
          Control exactly what employers can see about you, and when.
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Profile picture</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown to your coach and recruiter/employer contacts in messaging, and in weekly
            recognition (A-List, badges). Never shown on your resume, dossier, or to hiring managers
            reviewing your report.
          </p>
        </div>
        <AvatarUploadForm
          displayName={profile.displayName || 'You'}
          currentUrl={profile.profilePictureUrl}
          visible={profile.profilePictureVisible}
          uploadAction={uploadMyProfilePicture}
          removeAction={removeMyProfilePicture}
          toggleVisibilityAction={toggleMyProfilePictureVisible}
        />
      </div>

      <PrivacyTierSelector currentTier={profile.privacyTier} />

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Talent &amp; recruiter matching</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Separate from your privacy tier above — this controls whether employers using
            NextChapter&apos;s Talent tools can match you against open roles at all.
          </p>
        </div>
        <RecruiterDatabaseOptIn optedIn={profile.recruiterDatabaseOptIn} currentGrade={grade.grade} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          How often you hear from us. Your Hireability Report and any reminder emails always send
          regardless of this setting.
        </p>
        <NotificationTierSelector currentTier={profile.notificationTier} />
        <ActionWindowSelector current={profile.actionWindow} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Text messages</h2>
        </div>
        <SmsConsentForm smsPhone={profile.smsPhone} smsConsented={!!profile.smsConsentedAt} />
      </div>

      <div className="space-y-3 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Support Network</h2>
        <CommunitySettingsToggles
          aListOptOut={profile.aListOptOut}
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
            Permanently delete your account and all associated data.
          </p>
        </div>
        <DeleteAccountForm />
      </div>
    </div>
  )
}
