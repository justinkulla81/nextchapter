import type { ReactNode } from 'react'
import Link from 'next/link'

// Minimal markdown-style `[label](/dashboard/...)` link support for plain-
// language copy that sometimes needs a real link (e.g. isDossierUnlocked's
// "Need: 2 more completed references" pointing at /dashboard/references) —
// the only formatting this supports, kept deliberately minimal. Originally
// DailyMessageBox's own renderBulletText; shared here since dossierStatus.
// reason is rendered as plain text in several places (LockedFeatureNotice,
// RecruiterDatabaseOptIn, the dashboard and Portfolio pages directly).
export function renderMarkdownLinks(text: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = linkPattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(
      <Link key={key++} href={match[2]} className="font-medium text-primary underline underline-offset-4 hover:no-underline">
        {match[1]}
      </Link>,
    )
    lastIndex = linkPattern.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
