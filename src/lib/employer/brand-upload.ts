import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUpload } from '@/lib/uploads/validate-upload'

const MAX_LOGO_BYTES = 3 * 1024 * 1024

// A company's logo goes in the same public logo bucket coaches and colleges use, under its own
// folder. Public because it is shown to the company's people and on their invite emails. SVG is
// refused by validateUpload, since SVG can carry script.
export async function uploadEmployerLogo(orgId: string, file: File | null): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null
  const check = await validateUpload(file, 'image', MAX_LOGO_BYTES)
  if (!check.ok) return { error: check.error }
  const admin = createAdminClient()
  const path = `employer-orgs/${orgId}/logo-${crypto.randomUUID()}.${check.ext}`
  const { error } = await admin.storage.from('coach-logos').upload(path, file, { contentType: check.contentType })
  if (error) return { error: 'The logo could not be uploaded. Try again.' }
  return admin.storage.from('coach-logos').getPublicUrl(path).data.publicUrl
}
