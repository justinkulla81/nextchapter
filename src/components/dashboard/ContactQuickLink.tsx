'use client'

import { Mail } from 'lucide-react'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { cn } from '@/lib/utils'

// A contact's name, made actionable when we have a way to reach them:
// opens Gmail compose if they have an email on file, falls back to their
// LinkedIn profile, or just renders as plain text if we have neither. The
// Mail icon is the visible cue that clicking the name opens an email —
// without it the link looked identical to any other blue text.
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
  const href = email ? gmailComposeHref(email, '') : (linkedinUrl ?? null)
  if (!href) {
    return <span className={cn('font-medium text-foreground', className)}>{name}</span>
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 font-medium text-brand hover:underline', className)}
    >
      {email && <Mail className="size-3.5 shrink-0" aria-hidden />}
      {name}
    </a>
  )
}
