// Who can get an AI review of a work sample. Off for everyone but the owner until it is switched on:
//   AI_SAMPLE_REVIEW=on             every member
//   AI_SAMPLE_REVIEW_EMAILS=a@b.c   a comma-separated list of members
// The review costs money per use (ai-sample-review.ts caps it), so it is opt-in, like the redesign.
import { OWNER_EMAILS } from '@/lib/redesign/flag'

export function isAiReviewOn(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if ((env.AI_SAMPLE_REVIEW ?? '').trim().toLowerCase() === 'on') return true
  if (!email) return false
  const allow = [...OWNER_EMAILS, ...(env.AI_SAMPLE_REVIEW_EMAILS ?? '').split(',')].map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allow.includes(email.trim().toLowerCase())
}
