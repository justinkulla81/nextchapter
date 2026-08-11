import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getProfileChecklistItems, type ProfileChecklistActionType } from '@/lib/weekly/profile-checklist'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'My Profile' }

interface SectionDef {
  href: string
  title: string
  description: string
  actionTypes: ProfileChecklistActionType[]
}

// The three sub-pages this hub links to, and which profile-checklist items
// count toward each one's "X of Y points" summary below. Not every field
// on a sub-page carries points (e.g. Education and demographic self-ID are
// unscored) — this only reflects the scored items, same as everywhere else
// in the app.
const SECTIONS: SectionDef[] = [
  {
    href: '/dashboard/profile/personal',
    title: 'My Personal Information',
    description: 'Basics, education, industry, function & experience, salary, LinkedIn, and photo.',
    actionTypes: [
      'PROFILE_CONFIRM',
      'INDUSTRY_CONFIRM',
      'FUNCTION_CONFIRM',
      'SALARY_CONFIRM',
      'PROFILE_PICTURE_UPLOADED',
      'LINKEDIN_PROFILE_ADDED',
    ],
  },
  {
    href: '/dashboard/profile/screening',
    title: 'Screening Questions',
    description: 'Work authorization, drug test/background check willingness, deal-breakers, and demographics.',
    actionTypes: ['WORK_AUTHORIZATION', 'RED_FLAGS_CONFIRMED'],
  },
  {
    href: '/dashboard/profile/search-goals',
    title: 'Search Goals',
    description: 'Minimum comp and the benefits that matter to you.',
    actionTypes: ['BENEFITS_PRIORITIES_CONFIRMED'],
  },
]

// Landing/index page for the three sub-pages below — not a form itself.
// Each card's points summary is its own consolidated total (see
// SuccessSprintCard.tsx's consolidateProfileDataRows for the matching
// per-page rows on the Success Dashboard).
export default async function ProfileHubPage() {
  const profile = await getDashboardData()
  const items = await getProfileChecklistItems(profile.id)
  const pointsByType = new Map(items.map((i) => [i.actionType, i]))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Everything about you lives in one of the three sections below.
        </p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const sectionItems = section.actionTypes.map((t) => pointsByType.get(t)).filter((i) => i !== undefined)
          const totalPoints = sectionItems.reduce((sum, i) => sum + i.points, 0)
          const earnedPoints = sectionItems.filter((i) => i.complete).reduce((sum, i) => sum + i.points, 0)
          const allDone = sectionItems.length > 0 && sectionItems.every((i) => i.complete)

          return (
            <Link key={section.href} href={section.href}>
              <Card className="transition-colors hover:border-brand/40">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-medium text-foreground">{section.title}</CardTitle>
                    {totalPoints > 0 && (
                      <span
                        className={
                          allDone
                            ? 'shrink-0 text-xs font-medium text-success'
                            : 'shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand'
                        }
                      >
                        {allDone ? '✓ Complete' : `${earnedPoints} of ${totalPoints} pts`}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
