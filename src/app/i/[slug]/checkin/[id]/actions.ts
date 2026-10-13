'use server'

import { answerCheckIn, findCheckInForAnswer, isCheckInAnswer } from '@/lib/higher-ed/checkins'

// "Send my answer" on the check-in page. The email's token proves who's
// answering; the answer is recorded only on this click, never on page load.
export async function submitCheckInAnswer(slug: string, checkInId: string, token: string, answer: string): Promise<{ ok?: true; error?: string }> {
  if (!isCheckInAnswer(answer)) return { error: 'Pick one of the answers.' }
  const c = await findCheckInForAnswer(slug, checkInId, token)
  if (!c) return { error: 'This check-in link isn’t valid any more. Your alumni office can send a new one.' }
  await answerCheckIn({ checkInId, memberId: c.member.id, answer })
  return { ok: true }
}
