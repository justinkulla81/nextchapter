import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { reconcileOpensFromResend } from '@/lib/mailing/reconcile-opens'

export const maxDuration = 120

// Every five minutes (in bundle-every-5): asks Resend about up to 100 recipients (sent over two hours ago, in the last 30 days) that
// we hold no open or click event for, and counts the ones Resend saw opened (lib/mailing/reconcile-opens.ts). Reads at most 100 rows
// per run and makes at most 100 Resend lookups; with nothing left to check it reads nothing more.
export const GET = withCronRun('mailing-reconcile-opens', async () => NextResponse.json(await reconcileOpensFromResend()))
