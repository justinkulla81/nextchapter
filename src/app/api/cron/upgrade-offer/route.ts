import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runUpgradeOffer } from '@/lib/email/dispatch/run-upgrade-offer'

// Tuesdays. Which members get an offer, and how often, is decided in
// src/lib/upgrade-offer/triggers.ts.
export const GET = withCronRun('upgrade-offer', async () => NextResponse.json(await runUpgradeOffer()))
