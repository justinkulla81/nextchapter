'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { invokeCron } from '@/lib/cron/invoke'
import { RANKINGS_GROUPS, RERUN_SAFE_JOBS } from '@/lib/cron/schedule'
import { captureServerEvent } from '@/lib/posthog/server'

/** Runs one data-sync job right now. Only jobs that cannot double-send are allowed. */
export async function runJobNow(formData: FormData) {
  await requireAdmin()
  const job = String(formData.get('job') ?? '')
  if (!RERUN_SAFE_JOBS.has(job)) return
  const group = String(formData.get('group') ?? '')
  const extra: Record<string, string> = job === 'rankings' && (RANKINGS_GROUPS as readonly string[]).includes(group) ? { group } : {}
  const result = await invokeCron(job, 'manual', undefined, extra)
  captureServerEvent('cron', 'job_run_now_clicked', {
    job, group: extra.group ?? null, ok: result.ok, status: result.status,
  })
  revalidatePath('/support/admin/job-health')
}
