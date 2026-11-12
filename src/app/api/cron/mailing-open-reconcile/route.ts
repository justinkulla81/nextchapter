import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { reconcileOpensFromResend } from '@/lib/mailing/open-reconcile'

export const maxDuration = 300

/**
 * Hourly: counts an open for list-email recipients Resend says opened (or who replied, unsubscribed or clicked) when the webhook
 * never stored one. About 45 Resend list requests and no more than one small database read per page (lib/mailing/open-reconcile.ts).
 */
export const GET = withCronRun('mailing-open-reconcile', async () => NextResponse.json(await reconcileOpensFromResend()))
