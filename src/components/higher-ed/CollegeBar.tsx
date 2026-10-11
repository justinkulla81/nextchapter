import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readableTextOn } from '@/lib/higher-ed/branding'

// The college's brand on the existing candidate pages (spec §4, "Candidate
// pages inherit the theme"): a slim bar in the college's color with its
// program name and a way back to its portal. Shown only to a member who has
// joined; the most recently joined college wins if there are several.
export async function CollegeBar({ candidateId, className }: { candidateId: string; className?: string }) {
  const m = await prisma.institutionMember.findFirst({
    where: { candidateId, status: { in: ['CLAIMED', 'ACTIVE'] } },
    orderBy: { claimedAt: 'desc' },
    select: { institution: { select: { slug: true, name: true, programBrandName: true, accentColor: true } } },
  })
  if (!m) return null
  const { slug, name, programBrandName, accentColor } = m.institution
  const bg = accentColor ?? '#2e7d5b'
  return (
    <div className={className} style={{ backgroundColor: bg, color: readableTextOn(bg) }}>
      <div className="flex items-center justify-between gap-3 px-6 py-2 text-sm">
        <span className="font-medium">{programBrandName ?? name}</span>
        <Link href={`/i/${slug}/candidate`} className="font-medium underline underline-offset-4">
          Your {name} portal
        </Link>
      </div>
    </div>
  )
}
