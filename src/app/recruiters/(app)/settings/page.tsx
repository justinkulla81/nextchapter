import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { RecruiterSettingsForm } from '@/components/recruiter/RecruiterSettingsForm'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { uploadMyProfilePicture, removeMyProfilePicture, uploadMyFirmLogo, removeMyFirmLogo } from './actions'

export default async function RecruiterSettingsPage() {
  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recruiters/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const firm = recruiter.recruiterFirmId
    ? await prisma.recruiterFirm.findUnique({ where: { id: recruiter.recruiterFirmId } })
    : null

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link href="/recruiters/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to dashboard
      </Link>

      <div className="mt-4 mb-6 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your name, firm, and specialty — shown on every listing you submit.</p>
      </div>

      <RecruiterSettingsForm recruiter={recruiter} />

      <div className="mt-8 space-y-3 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">Your photo</h2>
          <p className="text-sm text-muted-foreground">Shown to candidates once they sign up through you.</p>
        </div>
        <AvatarUploadForm
          displayName={recruiter.fullName}
          currentUrl={recruiter.profilePictureUrl}
          uploadAction={uploadMyProfilePicture}
          removeAction={removeMyProfilePicture}
        />
      </div>

      {firm && (
        <div className="mt-8 space-y-3 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold">Firm logo</h2>
            <p className="text-sm text-muted-foreground">
              Used to brand submission packets you generate for {firm.name} — never shown to candidates.
            </p>
          </div>
          <AvatarUploadForm
            displayName={firm.name}
            currentUrl={firm.logoUrl}
            uploadAction={uploadMyFirmLogo}
            removeAction={removeMyFirmLogo}
          />
        </div>
      )}
    </div>
  )
}
