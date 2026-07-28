import Link from 'next/link'
import { getCoachByToken } from '@/lib/coach/access'
import { CoachBrandingForm } from '@/components/coach/CoachBrandingForm'
import { OnboardingTemplateEditor } from '@/components/coach/OnboardingTemplateEditor'
import { getCoachTemplate } from '@/lib/coach/onboarding-form'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { uploadMyProfilePicture, removeMyProfilePicture, toggleMyProfilePictureVisible } from './actions'

export default async function CoachSettingsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const coach = await getCoachByToken(token)

  if (!coach) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-muted-foreground">Double check the link you were sent.</p>
      </div>
    )
  }

  const onboardingTemplate = await getCoachTemplate(coach.id)

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link
        href={`/support/coach/clients/${token}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Back to clients
      </Link>

      <div className="mt-4 mb-6 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Practice settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-muted-foreground">
          Your name, logo, and accent color — used as we build out your branded practice tools.
        </p>
      </div>

      <CoachBrandingForm token={token} coach={coach} />

      <div className="mt-8 space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Your photo</h2>
          <p className="text-sm text-muted-foreground">
            Shown to clients in messaging — separate from your firm logo above.
          </p>
        </div>
        <AvatarUploadForm
          displayName={coach.fullName}
          currentUrl={coach.profilePictureUrl}
          visible={coach.profilePictureVisible}
          uploadAction={uploadMyProfilePicture.bind(null, token)}
          removeAction={removeMyProfilePicture.bind(null, token)}
          toggleVisibilityAction={toggleMyProfilePictureVisible.bind(null, token)}
        />
      </div>

      <div className="mt-10 mb-6 space-y-1 border-t border-border pt-8">
        <p className="text-sm font-medium text-muted-foreground">Client kickoff</p>
        <h2 className="text-2xl font-semibold tracking-tight">Coaching Onboarding Form</h2>
        <p className="text-muted-foreground">
          The self-serve questions a new client answers on their own, right after they agree to
          share their Dossier and Coaching Notes with you. Goal-setting and working-relationship
          logistics only — never a place for sensitive topics, which stay a live, verbal
          conversation between the two of you. Toggle, reorder, or add your own; this becomes the
          standing template applied to every new client automatically.
        </p>
      </div>

      <OnboardingTemplateEditor token={token} focus={coach.focus} initialTemplate={onboardingTemplate} />
    </div>
  )
}
