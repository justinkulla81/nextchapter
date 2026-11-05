import 'server-only'
import { handwritingUrl } from '@/lib/email/handwriting'

/** The note as the email component wants it: the signed image URL (null when signing is off) plus its text. */
export function marginNoteFor(appUrl: string, text: string): { src: string | null; text: string } {
  return { src: handwritingUrl(appUrl, text), text }
}
