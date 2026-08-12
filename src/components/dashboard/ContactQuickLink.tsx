'use client'

import { Mail, Link2 } from 'lucide-react'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { cn } from '@/lib/utils'
import { contactLinkType } from '@/lib/dashboard/contact-link-type'

// A contact's name, made actionable when we have a way to reach them:
// opens Gmail compose if they have an email on file, falls back to their
// LinkedIn profile, or just renders as plain text if we have neither. Email
// and LinkedIn links get distinct colors + icons (not just one generic
// "blue link" look) so a list of names sorts visually by how reachable each
// person actually is — see contactLinkType/CONTACT_LINK_ORDER in
// lib/dashboard/contact-link-type.ts (kept out of this 'use client' file so
// server code can sort by them without a client-boundary crash).

export function ContactQuickLink({
  name,
  email,
  linkedinUrl,
  className,
}: {
  name: string
  email?: string | null
  linkedinUrl?: string | null
  className?: string
}) {
  const type = contactLinkType({ email, linkedinUrl })

  if (type === 'none') {
    return <span className={cn('font-medium text-foreground', className)}>{name}</span>
  }

  const href = type === 'email' ? gmailComposeHref(email!, '') : linkedinUrl!
  const Icon = type === 'email' ? Mail : Link2
  const colorClass = type === 'email' ? 'text-brand' : 'text-light-blue'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 font-medium hover:underline', colorClass, className)}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {name}
    </a>
  )
}
