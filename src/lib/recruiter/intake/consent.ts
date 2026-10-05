import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { isIntakeConsentScope } from './constants'

// Replaces a connection's consent scopes and writes one ledger row per
// change (grant or revoke). Consent belongs to the firm connection.
export async function saveIntakeConsent(connectionId: string, requested: string[], ip: string | null) {
  const connection = await prisma.intakeConnection.findUnique({ where: { id: connectionId } })
  if (!connection) return
  const next = Array.from(new Set(requested.filter(isIntakeConsentScope)))
  const granted = next.filter((s) => !connection.consentScopes.includes(s))
  const revoked = connection.consentScopes.filter((s) => !next.includes(s as never))
  if (granted.length === 0 && revoked.length === 0) return

  await prisma.$transaction([
    prisma.intakeConnection.update({ where: { id: connectionId }, data: { consentScopes: next } }),
    prisma.intakeConsentEvent.createMany({
      data: [
        ...granted.map((scope) => ({ scope, granted: true })),
        ...revoked.map((scope) => ({ scope, granted: false })),
      ].map((e) => ({ ...e, connectionId, intakeCandidateId: connection.intakeCandidateId, firmId: connection.firmId, ip })),
    }),
  ])
  captureServerEvent(connection.intakeCandidateId, 'talent_consent_changed', {
    connectionId,
    firmId: connection.firmId,
    granted,
    revoked,
  })
}

// Candidate disconnects from a firm: every scope revoked, the firm loses
// the connection, and no reply or reminder goes out for it.
export async function disconnectIntakeConnection(connectionId: string, ip: string | null) {
  await saveIntakeConsent(connectionId, [], ip)
  const connection = await prisma.intakeConnection.update({
    where: { id: connectionId },
    data: { disconnectedAt: new Date() },
  })
  await prisma.intakeReply.updateMany({
    where: { connectionId, status: { in: ['DRAFT', 'APPROVED'] } },
    data: { status: 'CANCELLED', cancelledById: 'candidate', cancelledAt: new Date() },
  })
  captureServerEvent(connection.intakeCandidateId, 'talent_firm_disconnected', { connectionId, firmId: connection.firmId })
}
