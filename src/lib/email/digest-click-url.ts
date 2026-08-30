import 'server-only'

export type DigestAudienceSlug = 'candidate' | 'coach' | 'recruiter' | 'employer'

// Same polymorphic audience+id addressing the unsubscribe route already
// uses (src/app/api/unsubscribe/audience/[audience]/[id]/route.ts) — every
// digest send email builds its nugget link through this instead of the raw
// article URL, so a click can be attributed to exactly who clicked it.
export function digestClickUrl(audience: DigestAudienceSlug, recipientId: string, itemId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/digest-click/${audience}/${recipientId}/${itemId}`
}
