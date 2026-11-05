import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'

// Releases the batch. Pushes to main no longer deploy on their own (scripts/vercel-ignore-build.sh); twice a day this
// calls the project's deploy hook, which builds the latest main inside the release window the script allows. Each
// deploy empties the page caches and re-bills the ISR writes, so fewer deploys is the saving.
export const GET = withCronRun('deploy-batch', async () => {
  const hook = process.env.DEPLOY_HOOK_URL
  if (!hook) return NextResponse.json({ error: 'DEPLOY_HOOK_URL is not set' }, { status: 500 })
  const res = await fetch(hook, { method: 'POST' })
  if (!res.ok) return NextResponse.json({ error: `Deploy hook answered ${res.status}` }, { status: 502 })
  return NextResponse.json({ triggered: true })
})
