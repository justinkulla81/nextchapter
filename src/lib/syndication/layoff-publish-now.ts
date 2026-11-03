import 'server-only'
import { revalidatePath, revalidateTag } from 'next/cache'
import { forgetAnnouncements } from '@/lib/warn/company-announcements'
import { forgetLayoffNotices } from '@/lib/warn/layoff-pages'
import { runLayoffIndexNow } from './indexnow-layoffs'

/**
 * Puts the layoffs just filed in front of readers and search engines now, not at the next hourly run: forgets the cached copies of
 * the record (the pages keep them for an hour), refreshes the hub, the feed and the changed company and state pages, tells WebSub
 * hubs which feeds changed, and sends the changed pages to IndexNow. Safe to call when nothing changed: it sends only pages whose
 * record moved since they were last announced. Never throws, since a layoff must stay filed whether or not this works.
 */
export async function publishLayoffsNow(): Promise<string> {
  try {
    forgetLayoffNotices()
    forgetAnnouncements()
    revalidateTag('shared-load:public-notices', { expire: 0 })
    revalidatePath('/layoffs')
    revalidatePath('/feeds/layoffs')
    const r = await runLayoffIndexNow()
    return `${r.due} pages due, ${r.sent} sent to IndexNow${r.stoppedEarly ? `, stopped: ${r.stoppedEarly}` : ''}`
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Publishing layoffs now failed', message)
    return `failed: ${message.slice(0, 200)}`
  }
}
