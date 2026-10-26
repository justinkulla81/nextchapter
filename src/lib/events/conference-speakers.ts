import 'server-only'
import { prisma } from '@/lib/prisma'

// Named speakers on a conference's own program (keynotes, panelists, moderators, session speakers), each with the page it was read from.
// The table is applied by hand (prisma/manual/conference-speakers.sql); a deploy that lands first must not 500, so a failed read is an empty list.

export interface ConferenceSpeakerRow { name: string; title: string | null; organization: string | null; kind: string; sessionTitle: string | null; year: number | null; sourceUrl: string }

const RANK: Record<string, number> = { KEYNOTE: 0, MODERATOR: 1, PANELIST: 2, SPEAKER: 3 }

export async function speakersForConference(seriesId: string): Promise<ConferenceSpeakerRow[]> {
  const rows = await prisma.conferenceSpeaker
    .findMany({ where: { seriesId }, select: { name: true, title: true, organization: true, kind: true, sessionTitle: true, year: true, sourceUrl: true }, take: 200 })
    .catch(() => [] as ConferenceSpeakerRow[])
  return rows.sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || a.name.localeCompare(b.name))
}
