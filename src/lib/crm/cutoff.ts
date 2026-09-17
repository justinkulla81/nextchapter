/**
 * Nothing before NextChapter existed counts as a CRM interaction.
 *
 * The Gmail sweep and the per-person backfill both read a real mailbox that
 * predates the company by a decade — a 2016 dinner thread with someone who
 * is now an advisor is not outreach, and letting it into the activity log
 * poisons every derived number built on top of it: touch counts, "last
 * contacted", awaiting-reply, priority scoring. Direct instruction: the CRM
 * starts on 1 June 2026.
 *
 * Expressed in Pacific time, because that is the timezone the decision was
 * made in — a UTC midnight would silently admit the evening of 31 May.
 *
 * Enforced in three places, on purpose: the Gmail query (so old mail is
 * never fetched at all), the activity write (so a widened window or a new
 * caller can't slip past it), and refreshTouchFields (so any row already in
 * the table can't resurrect an old touch count).
 */
export const CRM_ACTIVITY_CUTOFF = new Date('2026-06-01T00:00:00-07:00')

export function isAfterCrmCutoff(when: Date): boolean {
  return when.getTime() >= CRM_ACTIVITY_CUTOFF.getTime()
}
