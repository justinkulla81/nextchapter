import { getCrmSyncHealth } from '@/lib/crm/sync-health'
import { CrmSyncNowButton } from '@/components/admin/CrmSyncNowButton'

/**
 * A standing alert while the Gmail/Calendar sweep is failing — it once broke
 * for two days (a reconnect that granted only the email-address permission)
 * and the only sign was a message after clicking Sync now. Shown from the
 * first failed run until one succeeds.
 */
export async function CrmSyncHealthAlert() {
  const health = await getCrmSyncHealth()
  if (health.failing.length === 0) return null

  const since = new Date(Math.min(...health.failing.map((f) => f.since.getTime())))
  const what = health.failing.map((f) => f.label).join(' and ')

  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-destructive">
          {what} sync has been failing since {since.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
          {' '}— new emails, replies and meetings aren&apos;t reaching the CRM.
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {health.reason === 'permission'
            ? 'Google isn’t letting NextChapter read your mail and calendar. Reconnect, and on Google’s screen tick every permission box.'
            : health.reason === 'expired'
              ? 'Google access expired. Reconnect to resume syncing.'
              : health.reason === 'not_connected'
                ? 'Google isn’t connected.'
                : 'Google isn’t answering. It usually recovers on its own; try Sync now in a few minutes.'}
          {health.needsReconnect && ' Everything missed since then syncs as soon as you do.'}
        </p>
      </div>
      <CrmSyncNowButton needsReconnect={health.needsReconnect} />
    </div>
  )
}
