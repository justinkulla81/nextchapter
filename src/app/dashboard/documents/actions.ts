'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { candidateDocumentUrl, uploadRequestedDocument } from '@/lib/documents/requests'

export type DocumentActionState = { error?: string; message?: string } | undefined

async function currentCandidate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? getOrCreateCandidateProfile(user.id) : null
}

export async function uploadDocument(_prev: DocumentActionState, formData: FormData): Promise<DocumentActionState> {
  const profile = await currentCandidate()
  if (!profile) return { error: 'You need to be logged in to do this. Sign in and try again.' }
  const requestId = String(formData.get('requestId') ?? '')
  const file = formData.get('file')
  const result = await uploadRequestedDocument(profile.id, requestId, file instanceof File ? file : null)
  if (!result.ok) return { error: result.error }
  captureServerEvent(profile.id, 'document_uploaded', {
    candidateId: profile.id,
    requestId,
    replaced: result.replaced,
    sizeBytes: result.sizeBytes,
    contentType: result.contentType,
  })
  revalidatePath('/dashboard/documents')
  return { message: result.replaced ? 'Replaced. They will see the new file.' : 'Uploaded. The person who asked can see it now.' }
}

export async function getMyDocumentUrl(requestId: string): Promise<string | null> {
  const profile = await currentCandidate()
  if (!profile) return null
  const url = await candidateDocumentUrl(profile.id, requestId)
  if (url) captureServerEvent(profile.id, 'document_opened', { candidateId: profile.id, requestId, by: 'candidate' })
  return url
}
