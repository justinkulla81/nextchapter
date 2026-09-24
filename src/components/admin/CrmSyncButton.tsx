import { getCrmSyncHealth } from '@/lib/crm/sync-health'
import { CrmSyncNowButton } from '@/components/admin/CrmSyncNowButton'

/** Sync now — or Reconnect & sync when only reconnecting Google can fix the sync. */
export async function CrmSyncButton() {
  const { needsReconnect } = await getCrmSyncHealth()
  return <CrmSyncNowButton needsReconnect={needsReconnect} />
}
