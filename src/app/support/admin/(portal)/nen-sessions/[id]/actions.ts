'use server'

import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'

// Deliberately NOT reusing getCrucibleCandidateResumeSignedUrl (the
// employer-portal action) — that function assumes an authenticated
// CrucibleEmployerProfile, enforces the employer-facing 24h view cap, and
// logs a CrucibleEmployerResumeView row attributing the view to whichever
// employer is asking. An admin isn't an employer and shouldn't be capped or
// counted in the anti-scraping mechanism that view cap exists for — this is
// a separate, admin-only signed-URL fetch with its own audit event.
export async function getAdminCrucibleResumeSignedUrl(sessionId: string): Promise<{ url: string } | { error: string }> {
  const admin = await requireAdmin()

  const session = await prisma.crucibleSession.findUnique({
    where: { id: sessionId },
    select: { resumeFilePath: true },
  })
  if (!session?.resumeFilePath) {
    return { error: 'No resume on file for this session.' }
  }

  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin.storage
    .from('crucible-resumes')
    .createSignedUrl(session.resumeFilePath, 60 * 10)
  if (error || !data) return { error: "Couldn't generate a download link — please try again." }

  captureServerEvent(admin.email ?? 'admin', 'admin_viewed_nen_resume', { sessionId })
  return { url: data.signedUrl }
}
