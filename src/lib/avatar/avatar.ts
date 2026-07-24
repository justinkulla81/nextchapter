import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface AvatarUploadResult {
  url?: string
  error?: string
}

export async function uploadAvatarFile(ownerId: string, file: File): Promise<AvatarUploadResult> {
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return { error: 'Please upload a PNG, JPEG, or WebP image.' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image must be under 5MB.' }
  }

  const admin = createAdminClient()
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage.from('avatars').upload(path, file, { contentType: file.type })
  if (uploadError) {
    return { error: 'Something went wrong uploading your photo. Please try again.' }
  }

  const url = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl
  return { url }
}
