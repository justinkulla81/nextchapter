import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'

// Link/bearer token columns default to Prisma's @default(cuid()) — cuid v1 is
// timestamp + counter + a short fingerprint + a few Math.random characters,
// i.e. guessable enough that it shouldn't be the only secret in a link. This
// extension fills the field with 192 bits from crypto.randomBytes whenever a
// create doesn't supply one, so every creation site (and any future one) gets
// an unguessable token without a schema change. Existing rows keep their
// tokens; their exposure is bounded by expiry (token-ttl.ts) and by the
// email/session binding at the consuming routes.
const TOKEN_FIELDS: Record<string, string> = {
  Reference: 'token',
  EmployerSeat: 'inviteToken',
  ProfileShare: 'token',
  Coach: 'accessToken',
  CoachClientInvite: 'inviteToken',
  Recruiter: 'accessToken',
  CandidateSearchCheckIn: 'token',
  EmployerReferenceSubmission: 'inviteToken',
  OutplacementSeat: 'inviteToken',
  OutplacementOrgUser: 'inviteToken',
  RecruiterFirmInvite: 'token',
  IntakeCandidate: 'claimToken',
  InterviewPanelist: 'scorecardToken',
  BenefitsNetworkVerification: 'token',
  CrucibleContestEntry: 'token',
  NewsletterSubscriber: 'unsubscribeToken',
  InstitutionUser: 'inviteToken',
  OutreachSend: 'claimToken',
}

const newToken = () => randomBytes(24).toString('base64url')

function fill(model: string, data: unknown): unknown {
  const field = TOKEN_FIELDS[model]
  if (!field || !data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map((d) => fill(model, d))
  const row = data as Record<string, unknown>
  return row[field] === undefined ? { ...row, [field]: newToken() } : data
}

export const tokenDefaultsExtension = Prisma.defineExtension({
  name: 'unpredictable-token-defaults',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!(model in TOKEN_FIELDS)) return query(args)
        const a = { ...(args as Record<string, unknown>) }
        if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
          a.data = fill(model, a.data)
        } else if (operation === 'upsert') {
          a.create = fill(model, a.create)
        }
        return query(a)
      },
    },
  },
})

export const __internals = { TOKEN_FIELDS, fill }
