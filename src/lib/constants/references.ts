import type { ReferenceType } from '@prisma/client'

export const RELATIONSHIP_TYPE_LABELS: Record<ReferenceType, string> = {
  DIRECT_MANAGER: 'Direct manager',
  SKIP_LEVEL_MANAGER: 'Skip-level manager',
  PEER: 'Peer',
  DIRECT_REPORT: 'Direct report',
  CLIENT: 'Client',
  VENDOR: 'Vendor',
  FACULTY_ADVISOR: 'Faculty advisor',
  OTHER: 'Other',
}

export const RELATIONSHIP_TYPE_HELP =
  'Direct managers and skip-level managers carry the most weight since they saw your day-to-day work and growth. Peers, direct reports, and clients add valuable context from different angles.'

export const REFERENCE_TOKEN_EXPIRY_DAYS = 30
