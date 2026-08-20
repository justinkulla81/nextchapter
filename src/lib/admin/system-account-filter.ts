import 'server-only'
import type { Prisma } from '@prisma/client'

// The one row CandidateProfile.isSystemAccount marks (see
// scripts/create-system-account.ts) authors admin Community posts but is
// not a real candidate — every admin-facing candidate list/count must
// exclude it so it doesn't skew population figures or show up as a row in a
// candidates table. Spread this into any CandidateProfileWhereInput that
// isn't already filtered down to a real-candidate-only condition (e.g.
// requiring a registration timestamp or EEOC field the system account will
// never have).
export const EXCLUDE_SYSTEM_ACCOUNT: Prisma.CandidateProfileWhereInput = { isSystemAccount: false }
