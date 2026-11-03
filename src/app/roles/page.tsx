import type { Metadata } from 'next'
import { Chips, JoinBand, Section, TopicShell } from '@/components/topics/blocks'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { usd } from '@/lib/seo/job-title-rules'
import { getRoleIndex } from '@/lib/seo/role-figures'
import { ROLES, ROLE_MIN_PAY, type RoleLevel } from '@/lib/seo/role-pages'

// Not prerendered: it reads the stored role index, and the CDN keeps each render for six hours (next.config.ts headers).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Executive Jobs by Role: CEO, CFO, CRO, CMO, VP, Director',
  description: 'Open C-suite, VP and director jobs by role (CEO, CFO, CRO, CMO, CTO, CHRO, VP of Sales, Director of Marketing and more), with pay, best industries, states, skills and AI skills for each.',
  ...canonical('/roles'),
}

const GROUPS: { level: RoleLevel; id: string; title: string; note: string }[] = [
  { level: 'c-suite', id: 'c-suite', title: 'C-suite and executive roles', note: 'CEO, CFO, CRO, CMO and the rest of the chief officers, each with the other ways the title is written.' },
  { level: 'vp', id: 'vp', title: 'Vice president roles', note: 'VP, SVP and EVP titles by function, counted together.' },
  { level: 'director', id: 'director', title: 'Director roles', note: 'Director and senior director titles by function.' },
]

export default async function RolesIndexPage() {
  const index = await getRoleIndex()
  const stat = new Map(index.map((s) => [s.slug, s]))
  const live = ROLES.filter((r) => stat.has(r.slug))
  return (
    <TopicShell
      trail={[{ name: 'Roles', path: '/roles' }]}
      title="Executive and leadership jobs by role"
      intro="Open C-suite, vice president and director jobs, grouped the way people search for them: by the acronym, the spelled-out title and the other names a role goes by. Each role shows its open jobs, pay, best industries, states, skills and AI skills."
      jsonLd={[
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Executive and leadership jobs by role', url: `${SITE_URL}/roles`,
          mainEntity: { '@type': 'ItemList', itemListElement: live.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/roles/${r.slug}`, name: r.spelled })) },
        },
      ]}
    >
      {live.length === 0 && <p className="mt-8 text-sm text-muted-foreground">Role pages appear here once the next daily count of open jobs has run.</p>}
      {GROUPS.map((g) => {
        const rows = live.filter((r) => r.level === g.level).sort((a, b) => stat.get(b.slug)!.jobs - stat.get(a.slug)!.jobs)
        if (rows.length === 0) return null
        return (
          <Section key={g.id} id={g.id} title={g.title} note={g.note}>
            <Chips
              kind={`roles_hub_${g.level}`}
              event="topic_link_clicked"
              items={rows.map((r) => {
                const s = stat.get(r.slug)!
                return { href: `/roles/${r.slug}`, label: r.name, detail: `${s.jobs.toLocaleString('en-US')}${s.median != null && s.payCount >= ROLE_MIN_PAY ? ` · ${usd(s.median)}` : ''}` }
              })}
            />
          </Section>
        )
      })}
      <JoinBand source="roles_hub" what="how the market reads your background for leadership roles" />
    </TopicShell>
  )
}
