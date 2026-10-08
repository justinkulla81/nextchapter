import 'server-only'
import { randomBytes, randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FIRM_WEBHOOK_EVENTS, isSafeWebhookUrl, signWebhookBody, type FirmWebhookEvent } from './webhook-shared'

export { FIRM_WEBHOOK_EVENTS, isSafeWebhookUrl, signWebhookBody }
export type { FirmWebhookEvent }

const ATTEMPT_DELAYS_MS = [0, 2_000, 6_000]
const TIMEOUT_MS = 8_000

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`
}

/** One delivery, with up to three attempts. Never throws. */
async function deliver(deliveryId: string): Promise<void> {
  const delivery = await prisma.firmWebhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } })
  if (!delivery) return
  const { endpoint } = delivery
  const body = JSON.stringify(delivery.payload)
  let lastError: string | null = null
  let status: number | null = null

  for (let i = 0; i < ATTEMPT_DELAYS_MS.length; i++) {
    if (ATTEMPT_DELAYS_MS[i] > 0) await new Promise((r) => setTimeout(r, ATTEMPT_DELAYS_MS[i]))
    const ts = Math.floor(Date.now() / 1000)
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NextChapter-Webhooks/1',
          'NextChapter-Event': delivery.event,
          'NextChapter-Delivery': delivery.id,
          'NextChapter-Signature': signWebhookBody(endpoint.secret, ts, body),
        },
        body,
      })
      status = res.status
      if (res.status >= 200 && res.status < 300) {
        await prisma.firmWebhookDelivery.update({
          where: { id: delivery.id },
          data: { status: 'SUCCESS', attempts: i + 1, responseStatus: status, error: null, deliveredAt: new Date() },
        })
        await prisma.firmWebhookEndpoint.update({ where: { id: endpoint.id }, data: { lastSuccessAt: new Date() } })
        return
      }
      lastError = `Your endpoint answered ${res.status}.`
    } catch (e) {
      lastError = e instanceof Error && e.name === 'TimeoutError' ? 'No answer within 8 seconds.' : 'Could not reach your endpoint.'
    }
    await prisma.firmWebhookDelivery.update({ where: { id: delivery.id }, data: { attempts: i + 1, responseStatus: status, error: lastError } })
  }
  await prisma.firmWebhookDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED' } })
  await prisma.firmWebhookEndpoint.update({ where: { id: endpoint.id }, data: { lastFailureAt: new Date() } })
}

/**
 * Queues and sends an event to every active endpoint of the firm that
 * subscribes to it. Runs after the response so a slow customer endpoint
 * never delays a candidate. Safe to call anywhere; failures are logged only.
 */
export function emitFirmWebhook(firmId: string, event: Exclude<FirmWebhookEvent, 'ping'>, data: Record<string, unknown>): void {
  const run = async () => {
    try {
      const endpoints = await prisma.firmWebhookEndpoint.findMany({ where: { firmId, isActive: true, events: { has: event } } })
      for (const ep of endpoints) {
        const id = randomUUID()
        const payload: Prisma.InputJsonObject = { id, event, createdAt: new Date().toISOString(), firmId, data: data as Prisma.InputJsonObject }
        await prisma.firmWebhookDelivery.create({ data: { id, endpointId: ep.id, event, status: 'PENDING', payload } })
        await deliver(id)
      }
    } catch (error) {
      console.error('Firm webhook emit failed:', error)
    }
  }
  try {
    after(run)
  } catch {
    void run()
  }
}

/** Sends a ping to one endpoint and waits for the result (used by the Test button). */
export async function sendTestWebhook(endpointId: string): Promise<{ ok: boolean; message: string }> {
  const ep = await prisma.firmWebhookEndpoint.findUnique({ where: { id: endpointId } })
  if (!ep) return { ok: false, message: 'Endpoint not found.' }
  const id = randomUUID()
  const payload: Prisma.InputJsonObject = { id, event: 'ping', createdAt: new Date().toISOString(), firmId: ep.firmId, data: { message: 'Test from NextChapter.' } }
  await prisma.firmWebhookDelivery.create({ data: { id, endpointId: ep.id, event: 'ping', status: 'PENDING', payload } })
  await deliver(id)
  const done = await prisma.firmWebhookDelivery.findUnique({ where: { id } })
  return done?.status === 'SUCCESS'
    ? { ok: true, message: 'Your endpoint received the test.' }
    : { ok: false, message: done?.error ?? 'The test did not go through.' }
}
