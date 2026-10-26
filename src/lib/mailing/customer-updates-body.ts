import type { CustomerAudience, CustomerUpdate } from '@/data/customer-updates'
import { escapeHtml } from './render'

// Pure pieces of the customer product-updates email, kept apart from the
// database code so they can be tested on their own.

export const CUSTOMER_UPDATES_LIST_KEY = 'customer_updates'

const AUDIENCE_LABEL: Record<CustomerAudience, string> = {
  employer: 'employers', recruiter: 'recruiters', coach: 'coaches', institution: 'colleges and workforce boards',
}

/** Entries from `since` on, newest first. Pure, so it can be tested. */
export function updatesSince(entries: CustomerUpdate[], since: Date): CustomerUpdate[] {
  const cutoff = since.toISOString().slice(0, 10)
  return entries.filter((e) => e.date > cutoff).sort((a, b) => b.date.localeCompare(a.date))
}

const joinNames = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`)

/** The email body: a greeting, one bullet per change, and markers that stop sending until you have finished it. */
export function customerUpdatesBody(entries: CustomerUpdate[], periodLabel: string | null): string {
  const intro = periodLabel
    ? `Here is what we added or changed for you at NextChapter, for ${escapeHtml(periodLabel)}.`
    : 'Here is what we added or changed for you at NextChapter.'
  const items = entries.length
    ? `<ul>${entries.map((e) => {
        const who = e.audiences.length === 4 ? '' : ` <i>(for ${joinNames(e.audiences.map((a) => AUDIENCE_LABEL[a]))})</i>`
        const title = e.href ? `<a href="${escapeHtml(e.href)}"><b>${escapeHtml(e.title)}</b></a>` : `<b>${escapeHtml(e.title)}</b>`
        return `<li>${title}${who}. ${escapeHtml(e.summary)}</li>`
      }).join('')}</ul>`
    : '<p>[[Write: what we added or changed since the last update]]</p>'
  return `<p>Hi {{firstName}},</p><p>${intro}</p>${items}<p>[[Write: anything else important this month, or delete this line]]</p><p>Reply to this email any time with a question or an idea. It comes straight to me.</p><p>Justin</p>`
}

