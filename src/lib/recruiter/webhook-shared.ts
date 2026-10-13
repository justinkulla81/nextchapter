// Pure helpers shared by the sender, the onboarding UI and the tests. Keep this
// file free of Node built-ins (crypto etc.): WebhookManager imports it in the
// browser, and a Node import here makes webpack ship a ~100 KB crypto polyfill.
// The HMAC signer lives in webhook-sign.ts for that reason.

export const FIRM_WEBHOOK_EVENTS = ['lead.created', 'lead.tagged'] as const
export type FirmWebhookEvent = (typeof FIRM_WEBHOOK_EVENTS)[number] | 'ping'

export const FIRM_WEBHOOK_EVENT_LABELS: Record<(typeof FIRM_WEBHOOK_EVENTS)[number], string> = {
  'lead.created': 'A resume arrives',
  'lead.tagged': 'A resume is read and routed (fit, niche or outside)',
}

/** https only, and never an address on the machine or a private network. */
export function isSafeWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { ok: false, message: 'Enter a full address, like https://example.com/hooks/nextchapter.' }
  }
  if (u.protocol !== 'https:') return { ok: false, message: 'The address must start with https://.' }
  const host = u.hostname.toLowerCase()
  const blockedName = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  const privateV4 = ipv4 && (() => {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  })()
  const v6 = host.startsWith('[') || host.includes(':')
  if (blockedName || privateV4 || v6) return { ok: false, message: 'That address is not reachable from the internet. Use a public https address.' }
  if (u.username || u.password) return { ok: false, message: 'Remove the username and password from the address.' }
  return { ok: true, url: u.toString() }
}
