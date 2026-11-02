import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runCourseScan } from '@/lib/learning/course-scan/run'

export const maxDuration = 300

// Weekly (Monday, early morning New York time): looks for new AI courses at Google, Anthropic, DeepLearning.AI and Microsoft,
// queues them at /support/admin/courses and emails a summary. Adds nothing to the catalog and posts nothing; a person approves each one.
export const GET = withCronRun('course-scan', async () => NextResponse.json(await runCourseScan()))
