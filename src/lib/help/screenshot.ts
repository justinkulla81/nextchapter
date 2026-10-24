import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { HELP_SCREENSHOT_BUCKET, HELP_SCREENSHOT_MAX_BYTES } from '@/lib/help/constants'

/**
 * Stores a problem screenshot in the private help-screenshots bucket, creating
 * the bucket the first time. `owner` is the folder: a candidate id, or
 * `portal-<PORTAL>` for partner portals. Returns the storage path.
 */
export async function storeHelpScreenshot(owner: string, file: File): Promise<string | 'too_big' | 'bad_type' | null> {
  if (file.size > HELP_SCREENSHOT_MAX_BYTES) return 'too_big'
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type]
  if (!ext) return 'bad_type'
  const admin = createAdminClient()
  const path = `${owner}/${crypto.randomUUID()}.${ext}`
  let { error } = await admin.storage.from(HELP_SCREENSHOT_BUCKET).upload(path, file, { contentType: file.type })
  if (error && /not found/i.test(error.message)) {
    await admin.storage.createBucket(HELP_SCREENSHOT_BUCKET, { public: false, fileSizeLimit: HELP_SCREENSHOT_MAX_BYTES })
    ;({ error } = await admin.storage.from(HELP_SCREENSHOT_BUCKET).upload(path, file, { contentType: file.type }))
  }
  if (error) {
    console.error('Help screenshot upload failed:', error)
    return null
  }
  return path
}
