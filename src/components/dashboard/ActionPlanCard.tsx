import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ActionPlanItemType =
  | 'HELP_SCRIPT'
  | 'NETWORKING_LIST'
  | 'LINKEDIN_SETUP'
  | 'LINKEDIN_POST_IDEA'
  | 'INTERVIEW_PREP'
  | 'NEGOTIATION_ADVICE'
  | 'PROFILE_CONFIRM'
  | 'INDUSTRY_CONFIRM'
  | 'FUNCTION_CONFIRM'
  | 'SALARY_CONFIRM'
  | 'WORK_AUTHORIZATION'

interface ActionPlanItem {
  text: string
  actionType?: ActionPlanItemType
}

type RawActionPlanItem = string | ActionPlanItem

export interface ActionDay {
  day: number
  items: RawActionPlanItem[]
}

const ACTION_TYPE_LINK: Record<ActionPlanItemType, { href: string; label: string }> = {
  HELP_SCRIPT: { href: '/dashboard/network', label: 'Go to My Network' },
  NETWORKING_LIST: { href: '/dashboard/network', label: 'Go to My Network' },
  LINKEDIN_SETUP: { href: '/dashboard/linkedin', label: 'Go to LinkedIn' },
  LINKEDIN_POST_IDEA: { href: '/dashboard/thought-leadership', label: 'Go to Thought Leadership' },
  INTERVIEW_PREP: { href: '/dashboard/job-fit', label: 'Go to Job Fit' },
  NEGOTIATION_ADVICE: { href: '/dashboard/job-fit', label: 'Go to Job Fit' },
  PROFILE_CONFIRM: { href: '/dashboard/profile', label: 'Go to Profile' },
  INDUSTRY_CONFIRM: { href: '/dashboard/profile', label: 'Go to Profile' },
  FUNCTION_CONFIRM: { href: '/dashboard/profile', label: 'Go to Profile' },
  SALARY_CONFIRM: { href: '/dashboard/profile', label: 'Go to Profile' },
  WORK_AUTHORIZATION: { href: '/dashboard/profile', label: 'Go to Profile' },
}

function normalizeItem(item: RawActionPlanItem): ActionPlanItem {
  return typeof item === 'string' ? { text: item } : item
}

export function ActionPlanCard({
  actionPlan,
  networkingListDone,
  askedForHelpDone,
  profileConfirmDone,
  industryConfirmDone,
  functionConfirmDone,
  salaryAndWorkAuthDone,
  linkedInConfirmDone,
}: {
  actionPlan: ActionDay[]
  networkingListDone: boolean
  askedForHelpDone: boolean
  profileConfirmDone: boolean
  industryConfirmDone: boolean
  functionConfirmDone: boolean
  salaryAndWorkAuthDone: boolean
  linkedInConfirmDone: boolean
}) {
  const doneByType: Partial<Record<ActionPlanItemType, boolean>> = {
    HELP_SCRIPT: askedForHelpDone,
    NETWORKING_LIST: networkingListDone,
    PROFILE_CONFIRM: profileConfirmDone,
    INDUSTRY_CONFIRM: industryConfirmDone,
    FUNCTION_CONFIRM: functionConfirmDone,
    SALARY_CONFIRM: salaryAndWorkAuthDone,
    WORK_AUTHORIZATION: salaryAndWorkAuthDone,
    LINKEDIN_SETUP: linkedInConfirmDone,
  }

  return (
    <div className="space-y-4">
      {actionPlan
        .slice()
        .sort((a, b) => a.day - b.day)
        .map((day) => (
          <Card key={day.day}>
            <CardContent className="pt-6">
              <p className="font-medium">Day {day.day}</p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {day.items.map(normalizeItem).map((item, i) => {
                  const isDone = item.actionType ? doneByType[item.actionType] : undefined
                  const link = item.actionType ? ACTION_TYPE_LINK[item.actionType] : undefined

                  return (
                    <li key={i}>
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            'mt-1.5 h-1 w-1 shrink-0 rounded-full',
                            isDone ? 'bg-success' : 'bg-brand'
                          )}
                        />
                        <span>{item.text}</span>
                      </div>
                      {link && !isDone && (
                        <Link
                          href={link.href}
                          className="ml-3 mt-1 inline-block text-xs text-primary underline underline-offset-4"
                        >
                          {link.label} →
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
