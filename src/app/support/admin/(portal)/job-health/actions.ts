'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { invokeCron } from '@/lib/cron/invoke'
import { RERUN_SAFE_JOBS } from '@/lib/cron/schedule'
import { captureServerEvent } from '@/lib/posthog/server'

/** Runs one data-sync job right now. Only jobs that cannot double-send are allowed. */
export async function runJobNow(formData: FormData) {
  await requireAdmin()
  const job = String(formData.get('job') ?? '')
  if (!RERUN_SAFE_JOBS.has(job)) return
  const result = await invokeCron(job, 'manual')
  captureServerEvent('cron', 'job_run_now_clicked', {
    job, ok: result.ok, status: result.status,
  })
  revalidatePath('/support/admin/job-health')
}
