'use client'

import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import {
  analyzeSituationAction,
  deleteQuestionAction,
  postQuestionAction,
  prepareQuestionAction,
  replyToQuestionAction,
  reportWorkItemAction,
} from '@/app/dashboard/work-help/actions'
import type { WorkQuestionView } from '@/lib/work-help/constants'
import { WorkHelpFlow, type WorkHelpActions } from './WorkHelpFlow'

const actions: WorkHelpActions = {
  analyze: analyzeSituationAction,
  prepare: prepareQuestionAction,
  post: postQuestionAction,
  remove: deleteQuestionAction,
  reply: replyToQuestionAction,
  report: reportWorkItemAction,
}

export function WorkHelpPage({ mine, others }: { mine: WorkQuestionView[]; others: WorkQuestionView[] }) {
  const router = useRouter()
  return <WorkHelpFlow actions={actions} initialMine={mine} initialOthers={others} onChanged={() => router.refresh()} capture={(event, props) => posthog.capture(event, props)} />
}
