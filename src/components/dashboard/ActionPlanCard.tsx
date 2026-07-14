'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { markNetworkingListSubmitted, markAskedForHelp } from '@/app/dashboard/actions'
import { ProfileConfirmForm } from './ProfileConfirmForm'
import { IndustryConfirmForm } from './IndustryConfirmForm'
import { FunctionConfirmForm } from './FunctionConfirmForm'
import { SalaryAuthorizationConfirmForm } from './SalaryAuthorizationConfirmForm'
import { LinkedInConfirmForm } from './LinkedInConfirmForm'

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

export interface CandidateDraft {
  firstName: string | null
  lastName: string | null
  phone: string | null
  streetAddress: string | null
  currentCity: string | null
  currentState: string | null
  industryContext: string | null
  primaryFunction: string | null
  resumeLatestJobTitle: string | null
  yearsExperience: number | null
  highestLevelReached: string | null
  lastSalary: number | null
  workAuthorization: string | null
}

function normalizeItem(item: RawActionPlanItem): ActionPlanItem {
  return typeof item === 'string' ? { text: item } : item
}

export function ActionPlanCard({
  actionPlan,
  helpScript,
  networkingListDone,
  askedForHelpDone,
  profileConfirmDone,
  industryConfirmDone,
  functionConfirmDone,
  salaryAndWorkAuthDone,
  linkedInConfirmDone,
  candidateDraft,
}: {
  actionPlan: ActionDay[]
  helpScript: string
  networkingListDone: boolean
  askedForHelpDone: boolean
  profileConfirmDone: boolean
  industryConfirmDone: boolean
  functionConfirmDone: boolean
  salaryAndWorkAuthDone: boolean
  linkedInConfirmDone: boolean
  candidateDraft: CandidateDraft
}) {
  const [expandedHelpScript, setExpandedHelpScript] = useState(false)

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
                  const isDone = item.actionType ? doneByType[item.actionType] : undefined

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

                    {item.actionType === 'HELP_SCRIPT' && !askedForHelpDone && (
                      <div className="ml-3 mt-1.5 space-y-2 rounded-md border border-border p-3">
                        <button
                          type="button"
                          onClick={() => setExpandedHelpScript((v) => !v)}
                          className="text-xs font-medium text-primary underline underline-offset-4"
                        >
                          {expandedHelpScript ? 'Hide message template' : 'View message template'}
                        </button>
                        {expandedHelpScript && (
                          <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                            {helpScript}
                          </pre>
                        )}
                        <form action={markAskedForHelp}>
                          <Button type="submit" size="sm" variant="outline">
                            Mark as done
                          </Button>
                        </form>
                      </div>
                    )}

                    {item.actionType === 'NETWORKING_LIST' && !networkingListDone && (
                      <div className="ml-3 mt-1.5">
                        <form action={markNetworkingListSubmitted}>
                          <Button type="submit" size="sm" variant="outline">
                            Mark complete
                          </Button>
                        </form>
                      </div>
                    )}

                    {item.actionType === 'LINKEDIN_SETUP' && !linkedInConfirmDone && (
                      <div className="ml-3 mt-1.5 max-w-sm rounded-md border border-border p-3">
                        <LinkedInConfirmForm />
                      </div>
                    )}

                    {(item.actionType === 'INTERVIEW_PREP' || item.actionType === 'NEGOTIATION_ADVICE') && (
                      <Link
                        href="/dashboard/job-fit"
                        className="ml-3 mt-1.5 inline-block text-xs text-primary underline underline-offset-4"
                      >
                        View on the Job Fit page
                      </Link>
                    )}

                    {item.actionType === 'PROFILE_CONFIRM' && !profileConfirmDone && (
                      <div className="ml-3 mt-1.5 max-w-sm rounded-md border border-border p-3">
                        <ProfileConfirmForm
                          firstName={candidateDraft.firstName}
                          lastName={candidateDraft.lastName}
                          phone={candidateDraft.phone}
                          streetAddress={candidateDraft.streetAddress}
                          currentCity={candidateDraft.currentCity}
                          currentState={candidateDraft.currentState}
                        />
                      </div>
                    )}

                    {item.actionType === 'INDUSTRY_CONFIRM' && !industryConfirmDone && (
                      <div className="ml-3 mt-1.5 max-w-sm rounded-md border border-border p-3">
                        <IndustryConfirmForm industryContext={candidateDraft.industryContext} />
                      </div>
                    )}

                    {item.actionType === 'FUNCTION_CONFIRM' && !functionConfirmDone && (
                      <div className="ml-3 mt-1.5 max-w-sm rounded-md border border-border p-3">
                        <FunctionConfirmForm
                          primaryFunction={candidateDraft.primaryFunction}
                          resumeLatestJobTitle={candidateDraft.resumeLatestJobTitle}
                          yearsExperience={candidateDraft.yearsExperience}
                          highestLevelReached={candidateDraft.highestLevelReached}
                        />
                      </div>
                    )}

                    {(item.actionType === 'SALARY_CONFIRM' || item.actionType === 'WORK_AUTHORIZATION') &&
                      !salaryAndWorkAuthDone && (
                        <div className="ml-3 mt-1.5 max-w-sm rounded-md border border-border p-3">
                          <SalaryAuthorizationConfirmForm
                            lastSalary={candidateDraft.lastSalary}
                            workAuthorization={candidateDraft.workAuthorization}
                          />
                        </div>
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
