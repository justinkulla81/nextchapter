import type { Metadata } from 'next'
import Link from 'next/link'
import { Chips, ConferenceList, Section, TopicShell, functionChip, industryChip } from '@/components/topics/blocks'
import { prisma } from '@/lib/prisma'
import { canonical } from '@/lib/seo/canonical'
import { INDUSTRIES, JOB_FUNCTIONS } from '@/lib/seo/topics'
import { getAssociations, sortConferences, type Conf } from '@/lib/seo/topic-data'

export const revalidate = 3600

const DESCRIPTION = 'Conferences, trade shows and summits by industry and function: dates, costs, calls for speakers, the associations that run them and the employers worth meeting.'
export const metadata: Metadata = { title: 'Conferences and trade shows: dates, costs and speaking', description: DESCRIPTION, ...canonical('/conferences') }

async function load() {
  const today = new Date()
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const [soon, cfp, total, associations] = await Promise.all([
    prisma.conferenceEvent.findMany({ where: { published: true, datesConfirmed: true, startDate: { gte: start } }, orderBy: { startDate: 'asc' }, take: 40 }),
    prisma.conferenceEvent.findMany({ where: { published: true, speaking: 'OPEN_CFP', OR: [{ speakingDeadline: null }, { speakingDeadline: { gte: start } }] }, orderBy: [{ speakingDeadline: { sort: 'asc', nulls: 'last' } }, { importance: 'asc' }], take: 12 }),
    prisma.conferenceEvent.count({ where: { published: true } }),
    getAssociations(),
  ])
  return { soon: soon as unknown as Conf[], cfp: sortConferences(cfp as unknown as Conf[]), total, associations }
}

export default async function ConferencesHub() {
  const d = await load().catch(() => null)
  return (
    <TopicShell
      trail={[{ name: 'Conferences', path: '/conferences' }]}
      title="Conferences and trade shows"
      intro={`${d ? d.total.toLocaleString() : 'Thousands of'} conferences, trade shows and summits, each with dates, costs, speaking opportunities, the association behind it and the industries and functions it serves.`}
    >
      {d && (
        <>
          <Section id="soon" title="Coming up next">
            <ConferenceList rows={d.soon} total={d.soon.length} source="hub:soon" />
          </Section>
          {d.cfp.length > 0 && (
            <Section id="cfp" title="Open calls for speakers">
              <ConferenceList rows={d.cfp} total={d.cfp.length} source="hub:cfp" />
            </Section>
          )}
        </>
      )}
      <Section id="industries" title="By industry">
        <Chips kind="conferences_to_industry" event="topic_link_clicked" items={INDUSTRIES.map((i) => industryChip(i.name))} />
      </Section>
      <Section id="functions" title="By function">
        <Chips kind="conferences_to_function" event="topic_link_clicked" items={JOB_FUNCTIONS.map((f) => functionChip(f.name))} />
      </Section>
      {d && d.associations.length > 0 && (
        <Section id="associations" title="Largest organizers">
          <Chips kind="conferences_to_association" event="topic_link_clicked" items={d.associations.slice(0, 20).map((a) => ({ href: `/associations/${a.slug}`, label: a.name, detail: String(a.count) }))} />
          <p className="mt-3 text-sm"><Link href="/associations" className="text-brand underline underline-offset-4">All organizers</Link></p>
        </Section>
      )}
    </TopicShell>
  )
}
