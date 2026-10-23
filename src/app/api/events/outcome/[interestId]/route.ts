import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyLink } from '@/lib/email/signed-links'
import { applyOutcome } from '@/lib/events/outcome'
import { OUTCOMES, type Outcome } from '@/lib/events/headsup'
import { confirmPage, messagePage } from '@/lib/http/confirm-page'

const LABEL: Record<Outcome, string> = { ATTENDED: 'Yes, you went', SPOKE: 'Yes, you spoke', DID_NOT_GO: 'No, you did not go' }
const THANKS: Record<Outcome, string> = {
  ATTENDED: "Thanks. We'll tell you when next year's dates are announced, early enough to ask about speaking and to book.",
  SPOKE: "Thanks, and well done. We'll tell you when next year's dates are announced, early enough to propose again and to book.",
  DID_NOT_GO: "Thanks. We'll keep it saved, and you can change your mind any time from Network, Events to attend.",
}

function parse(request: NextRequest, interestId: string): Outcome | null {
  const o = request.nextUrl.searchParams.get('o') as Outcome | null
  if (!o || !OUTCOMES.includes(o)) return null
  return verifyLink(request.nextUrl.searchParams.get('sig'), 'conf-outcome', interestId, o) ? o : null
}

// GET only asks for confirmation: mail scanners fetch every link in a message.
export async function GET(request: NextRequest, { params }: { params: Promise<{ interestId: string }> }) {
  const { interestId } = await params
  const o = parse(request, interestId)
  if (!o) return messagePage('This link is no longer valid. You can update this from Network, Events to attend in your NextChapter account.', 410)
  const row = await prisma.conferenceInterest.findUnique({ where: { id: interestId }, select: { event: { select: { name: true } } } }).catch(() => null)
  return confirmPage({ message: `${row?.event.name ?? 'This event'}: ${LABEL[o]}?`, button: 'Confirm', action: `${request.nextUrl.pathname}${request.nextUrl.search}` })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ interestId: string }> }) {
  const { interestId } = await params
  const o = parse(request, interestId)
  if (!o) return messagePage('This link is no longer valid. You can update this from Network, Events to attend in your NextChapter account.', 410)
  const row = await prisma.conferenceInterest.findUnique({ where: { id: interestId }, select: { candidateId: true, eventId: true } })
  if (!row) return messagePage('We could not find that event any more.', 404)
  await applyOutcome(row.candidateId, row.eventId, o)
  return messagePage(THANKS[o])
}
