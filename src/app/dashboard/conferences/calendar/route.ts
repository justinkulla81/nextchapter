import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { buildIcs, type IcsItem } from '@/lib/conferences/ics'
import { captureServerEvent } from '@/lib/posthog/server'

// "Add to my calendar": an .ics of the conference dates plus the deadlines of opportunities the member is working on.
// Calendar Connect only reads a member's calendar, so a file they open in their own calendar app is the add path.
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', req.url))
  const profile = await getOrCreateCandidateProfile(user.id)
  const id = new URL(req.url).searchParams.get('id') ?? ''
  const uc = await prisma.userConference.findUnique({ where: { candidateId_seriesId: { candidateId: profile.id, seriesId: id } } })
  const series = await prisma.conferenceEvent.findUnique({ where: { id } })
  if (!series || (!series.published && !uc)) return new NextResponse('Not found', { status: 404 })
  const items: IcsItem[] = []
  if (series.datesConfirmed && series.startDate) {
    items.push({ uid: `conf-${id}-${series.startDate.getUTCFullYear()}`, title: series.name, start: series.startDate, end: series.endDate, url: series.url, description: 'Added from NextChapter' })
  }
  const opps = await prisma.conferenceOpportunity.findMany({
    where: { seriesId: id, deadline: { not: null }, tracks: { some: { candidateId: profile.id, status: { in: ['WATCHING', 'DRAFTING'] } } } },
  })
  for (const o of opps) items.push({ uid: `opp-${o.id}`, title: `Deadline: ${o.title} (${series.name})`, start: o.deadline!, url: o.url })
  captureServerEvent(profile.id, 'conference_calendar_downloaded', { seriesId: id, items: items.length })
  if (items.length === 0) return new NextResponse('No confirmed dates to add yet.', { status: 404 })
  return new NextResponse(buildIcs(items), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${id}.ics"` } })
}
