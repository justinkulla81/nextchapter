import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateUpload } from '@/lib/uploads/validate-upload'

const MAX_LOGO_BYTES = 3 * 1024 * 1024

// An organization's logo goes in the same public logo bucket colleges, coaches
// and employers use, under organizations/<folder>/. SVG is refused by
// validateUpload because SVG can carry script.
export async function uploadOrganizationLogo(folder: string, file: File | null): Promise<string | null | { error: string }> {
  if (!file || file.size === 0) return null
  const check = await validateUpload(file, 'image', MAX_LOGO_BYTES)
  if (!check.ok) return { error: check.error }
  const admin = createAdminClient()
  const path = `organizations/${folder}/logo-${crypto.randomUUID()}.${check.ext}`
  const { error } = await admin.storage.from('coach-logos').upload(path, file, { contentType: check.contentType })
  if (error) return { error: 'The logo could not be uploaded. Try again.' }
  return admin.storage.from('coach-logos').getPublicUrl(path).data.publicUrl
}
