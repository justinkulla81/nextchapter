'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computePopulationSnapshotRows, upsertPopulationSnapshotRows } from '@/lib/analytics/population-metrics'
import { captureServerEvent } from '@/lib/posthog/server'

export type GenerateSnapshotState = { error?: string; success?: string } | undefined

// Manual "generate this week's snapshot now" trigger — same computation
// the Monday 00:15 UTC cron runs (src/app/api/cron/population-snapshot/route.ts),
// exposed here so an admin doesn't have to wait for Monday to see the
// report populated, and so this build could be verified end to end
// without waiting for a real cron fire. Same upsert-based idempotency —
// running this twice for the same week overwrites cleanly, same as the
// cron.
export async function generateThisWeekSnapshotAction(): Promise<GenerateSnapshotState> {
  const admin = await requireAdmin()

  const weekStartDate = getMondayOfWeek(new Date())
  try {
    const rows = await computePopulationSnapshotRows(weekStartDate)
    const written = await upsertPopulationSnapshotRows(weekStartDate, rows)
    captureServerEvent(admin.email ?? 'admin', 'admin_population_snapshot_generated', {
      weekStartDate: weekStartDate.toISOString(),
      rowsComputed: rows.length,
      rowsWritten: written,
    })
    revalidatePath('/support/admin/population')
    return { success: `Generated ${written} segment rows for the week of ${weekStartDate.toDateString()}.` }
  } catch (error) {
    console.error('generateThisWeekSnapshotAction failed', error)
    return { error: 'Snapshot generation failed. Check server logs.' }
  }
}
