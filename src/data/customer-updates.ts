// What we added or changed that employer, recruiter, coach and institution
// accounts would care about. The monthly "Product updates for customers" email
// is drafted from this list, then you approve it before anything sends.
//
// Add an entry in the same pull request as the change, in plain words about
// what the customer can now do. Skip internal work: refactors, admin-only
// tools, data fixes, anything a customer would never notice or use. Dates are
// when it went live. Newest first. See docs/mailing-lists.md.

export type CustomerAudience = 'employer' | 'recruiter' | 'coach' | 'institution'

export interface CustomerUpdate {
  /** YYYY-MM-DD, the day it went live. */
  date: string
  audiences: CustomerAudience[]
  /** Short, starts with a verb or the thing: "Get help from inside your portal". */
  title: string
  /** One or two plain sentences: what it is and why it matters to them. */
  summary: string
  /** Optional link to where they can use it, a full https URL. */
  href?: string
}

export const CUSTOMER_UPDATES: CustomerUpdate[] = [
  {
    date: '2026-10-25',
    audiences: ['employer', 'recruiter', 'coach', 'institution'],
    title: 'Reply to our emails and it lands in your conversation',
    summary: 'When we answer a question or problem you sent from your portal, just reply to that email. Your answer is added to the same conversation, so nothing gets lost in a separate inbox.',
  },
  {
    date: '2026-10-23',
    audiences: ['employer', 'recruiter', 'coach', 'institution'],
    title: 'Help & feedback, from inside your portal',
    summary: 'A Help & feedback button is now in every employer, recruiter, coach and institution portal. Ask a question, report a problem with a screenshot, or send us an idea, and we reply by email.',
  },
]
