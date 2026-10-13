import 'server-only'

export type InvokeResult = { ok: boolean; status: number; error?: string }

/**
 * Calls a cron route the way Vercel's scheduler does, bearer secret included.
 * Used by the watchdog's single retry and the admin "Run now" button.
 */
export async function invokeCron(job: string, trigger: 'retry' | 'manual', timeoutMs = 290_000): Promise<InvokeResult> {
  const secret = process.env.CRON_SECRET
  if (!secret) return { ok: false, status: 0, error: 'CRON_SECRET is not set.' }
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  try {
    const res = await fetch(`${base}/api/cron/${encodeURIComponent(job)}?trigger=${trigger}`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) }
  }
}
