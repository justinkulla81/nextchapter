import 'server-only'
import { createHmac } from 'crypto'

// Server-only on purpose: uses Node's crypto, which must never be reachable
// from a client component (see webhook-shared.ts).

/** Header value: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">. */
export function signWebhookBody(secret: string, timestamp: number, body: string): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${mac}`
}
