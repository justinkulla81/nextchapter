'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MyStoryTab } from './MyStoryTab'
import { ToughQuestionsTab } from './ToughQuestionsTab'
import { PracticeTab } from './PracticeTab'
import { ThankYouEmailTab } from './ThankYouEmailTab'
import { ComfortCheckTab } from './ComfortCheckTab'
import type { NarrativeAdaptations } from '@/lib/narrative/generate-adaptations'

const TABS = [
  { id: 'story', label: 'My story' },
  { id: 'tough', label: 'Tough questions' },
  { id: 'practice', label: 'Practice' },
  { id: 'thank-you', label: 'Thank-you emails' },
  { id: 'comfort', label: 'Comfort check' },
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
}: {
  coreStatement: string | null
  adaptations: NarrativeAdaptations | null
  targetRoleType: string | null
  storyComfort: number | null
  interviewComfort: number | null
  elevatorPitchReady: number | null
  hasJobDescription: boolean
  jobHoppingFlag: boolean
}) {
  return (
    <Tabs defaultValue="story">
      <div className="overflow-x-auto">
        <TabsList variant="line" className="h-auto min-w-full justify-start gap-2 p-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="h-auto shrink-0 flex-none rounded-full border-border px-4 py-1.5 text-muted-foreground data-active:border-ink data-active:!bg-ink data-active:text-white group-data-[variant=line]/tabs-list:data-active:!bg-ink group-data-[variant=line]/tabs-list:data-active:!text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="story" className="mt-6">
        <MyStoryTab coreStatement={coreStatement} adaptations={adaptations} />
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
          redesign
        />
      </TabsContent>
    </Tabs>
  )
}
