'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MyStoryTab } from './MyStoryTab'
import { ToughQuestionsTab } from './ToughQuestionsTab'
import { PracticeTab } from './PracticeTab'
import { ThankYouEmailTab } from './ThankYouEmailTab'
import { ComfortCheckTab } from './ComfortCheckTab'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

const TABS = [
  { id: 'story', label: 'My Story' },
  { id: 'tough', label: 'Tough Questions' },
  { id: 'practice', label: 'Practice' },
  { id: 'thank-you', label: 'Thank You Emails' },
  { id: 'comfort', label: 'Comfort Check' },
] as const

export function InterviewPrepTabs({
  coreStatement,
  adaptations,
  targetRoleType,
  storyComfort,
  interviewComfort,
  elevatorPitchReady,
  hasJobDescription,
  jobHoppingFlag,
  redesign = false,
}: {
  coreStatement: string | null
  adaptations: NarrativeAdaptations | null
  targetRoleType: string | null
  storyComfort: number | null
  interviewComfort: number | null
  elevatorPitchReady: number | null
  hasJobDescription: boolean
  jobHoppingFlag: boolean
  /** Pill tabs and the quiet story panel, to match the redesigned pages. */
  redesign?: boolean
}) {
  return (
    <Tabs defaultValue="story">
      <div className="overflow-x-auto">
        <TabsList variant={redesign ? 'line' : 'default'} className={redesign ? 'h-auto min-w-full justify-start gap-2 p-0' : 'h-auto min-w-full justify-start gap-1 bg-light-gray p-1'}>
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={
                redesign
                  ? 'h-auto shrink-0 flex-none rounded-full border-border px-4 py-1.5 text-muted-foreground data-active:border-ink data-active:!bg-ink data-active:text-white group-data-[variant=line]/tabs-list:data-active:!bg-ink'
                  : 'shrink-0 px-3 py-2'
              }
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="story" className="mt-6">
        <MyStoryTab coreStatement={coreStatement} adaptations={adaptations} redesign={redesign} />
      </TabsContent>
      <TabsContent value="tough" className="mt-6">
        <ToughQuestionsTab hasJobDescription={hasJobDescription} jobHoppingFlag={jobHoppingFlag} />
      </TabsContent>
      <TabsContent value="practice" className="mt-6">
        <PracticeTab targetRoleType={targetRoleType} hasJobDescription={hasJobDescription} />
      </TabsContent>
      <TabsContent value="thank-you" className="mt-6">
        <ThankYouEmailTab hasJobDescription={hasJobDescription} />
      </TabsContent>
      <TabsContent value="comfort" className="mt-6">
        <ComfortCheckTab
          storyComfort={storyComfort}
          interviewComfort={interviewComfort}
          elevatorPitchReady={elevatorPitchReady}
        />
      </TabsContent>
    </Tabs>
  )
}
