import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Universities' }

export default async function UniversitiesIndexPage() {
  const profile = await getDashboardData()

  // The candidate's own school(s) — named explicitly, not a generic "your
  // university" label, and there can genuinely be more than one (undergrad
  // + grad school, etc).
  const ownSchools = await prisma.educationEntry.findMany({
    where: { candidateId: profile.id },
    orderBy: [{ isPrimary: 'desc' }, { graduationDate: 'desc' }],
    select: { schoolName: true, schoolNameNormalized: true, degree: true, fieldOfStudy: true, graduationDate: true },
  })

  // Dedupe to one row per school (a candidate can have multiple degrees
  // from the same school) — keep the first (most-primary/most-recent) one
  // for display.
  const seen = new Set<string>()
  const schools = ownSchools.filter((s) => {
    if (seen.has(s.schoolNameNormalized)) return false
    seen.add(s.schoolNameNormalized)
    return true
  })

  const alumniCounts = await Promise.all(
    schools.map((s) =>
      prisma.candidateProfile.count({
        where: {
          id: { not: profile.id },
          isSystemAccount: false,
          confidentialSearchMode: false,
          privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC'] },
          educationHistory: { some: { schoolNameNormalized: s.schoolNameNormalized } },
        },
      })
    )
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Universities</h1>
        <p className="text-muted-foreground">Fellow NextChapter members from your own school(s).</p>
      </div>

      {schools.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Add your education on{' '}
          <Link href="/dashboard/profile/personal" className="text-primary underline underline-offset-4">
            My Personal Information
          </Link>{' '}
          to see fellow alumni here.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {schools.map((school, i) => (
            <Link
              key={school.schoolNameNormalized}
              href={`/dashboard/universities/${encodeURIComponent(school.schoolNameNormalized)}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{school.schoolName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[school.degree, school.fieldOfStudy, school.graduationDate?.getFullYear()].filter(Boolean).join(' · ') ||
                    'No degree details on file'}
                </p>
              </div>
              <p className="shrink-0 text-sm text-muted-foreground">
                {alumniCounts[i]} alum{alumniCounts[i] === 1 ? '' : 'ni'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
