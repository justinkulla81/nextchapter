// Plain data helpers shared between ContactQuickLink (a 'use client'
// component) and server code that sorts contact lists (find-my-job/page.tsx)
// before rendering them. Must live outside any 'use client' file — every
// export of a 'use client' module becomes a client reference, so a Server
// Component importing a plain function from one crashes at request time
// ("Attempted to call X() from the server but X is on the client").
export type ContactLinkType = 'email' | 'linkedin' | 'none'

export function contactLinkType(contact: { email?: string | null; linkedinUrl?: string | null }): ContactLinkType {
  if (contact.email) return 'email'
  if (contact.linkedinUrl) return 'linkedin'
  return 'none'
}

export const CONTACT_LINK_ORDER: Record<ContactLinkType, number> = { email: 0, linkedin: 1, none: 2 }
