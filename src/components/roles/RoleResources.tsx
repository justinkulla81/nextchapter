import { ConferenceList, LINK, Section } from '@/components/topics/blocks'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MEDIA_KIND_LABEL } from '@/lib/roles/media'
import type { RoleResources } from '@/lib/roles/resources'
import { coursePath } from '@/lib/learning/public-catalog-shared'
import type { RoleDef } from '@/lib/seo/role-pages'

const CARD = 'rounded-xl border border-border bg-white p-4'
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * The sections around a role's jobs: recruiters who recruit for it, officer changes, conferences, training and media. A part with
 * nothing real to show renders nothing, so a thin role gets a short page, not empty boxes. The ask to register is the page's one
 * NextStepBox; none is added here.
 */
export function RoleResourceSections({ role, r, slug }: { role: RoleDef; r: RoleResources; slug: string }) {
  const lower = role.short
  const source = `role:${slug}`
  return (
    <>
      {r.firms.length > 0 && (
        <Section id="recruiters" title={`Recruiters who place ${lower} roles`} note={`Search firms whose live public searches are in ${role.fn} at this level. Counted from their own job postings, not self-described.`}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {r.firms.map((f) => (
              <li key={f.slug} className={CARD}>
                <TrackedLink href={`/search-firms/${f.slug}`} event="role_resource_clicked" properties={{ roleSlug: slug, resource: 'recruiter', to: f.slug }} className="font-semibold text-navy hover:underline">{f.name}</TrackedLink>
                <p className="mt-1 text-sm text-muted-foreground">{f.publicRoles.toLocaleString('en-US')} live public searches</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><TrackedLink href={`/search-firms?fn=${encodeURIComponent(role.fn)}`} event="role_resource_clicked" properties={{ roleSlug: slug, resource: 'recruiter_all' }} className={LINK}>All {role.fn} search firms</TrackedLink></p>
        </Section>
      )}

      {r.turnover && (
        <Section id="turnover" title={r.turnover.ownSeat ? `${lower} turnover` : `${r.turnover.label} turnover`} note={`Departures and appointments companies reported to the SEC in the last 120 days${r.turnover.ownSeat ? '' : `, for the ${r.turnover.label} seat above this role`}. Each links to the filing.`}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {r.turnover.items.map((t) => (
              <li key={t.id} className={CARD}>
                <p className="font-semibold text-navy">{t.company}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.kind === 'left' ? `${t.role} leaving` : `${t.role} named`} · {day(t.date)}</p>
                <TrackedLink href={t.url} event="role_resource_clicked" rel="noopener nofollow" properties={{ roleSlug: slug, resource: 'turnover', to: t.company }} className={`${LINK} mt-1 inline-block text-sm`}>SEC filing</TrackedLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.conferences && (
        <Section id="conferences" title={`Conferences for ${lower} leaders`} note={`Events tagged for ${role.fn}, with dates, cost and how to speak.`}>
          <ConferenceList rows={r.conferences.rows} total={r.conferences.total} upcoming={r.conferences.upcoming} source={source} />
          <p className="mt-3 text-sm"><TrackedLink href="/conferences" event="role_resource_clicked" properties={{ roleSlug: slug, resource: 'conference_all' }} className={LINK}>All conferences</TrackedLink></p>
        </Section>
      )}

      {r.courses.rows.length > 0 && (
        <Section id="training" title={`Training for ${lower} leaders`} note={`AI and ${role.fn} courses from named providers, with cost shown.`}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {r.courses.rows.map((c) => (
              <li key={c.slug} className={CARD}>
                <TrackedLink href={coursePath(c)} event="role_resource_clicked" properties={{ roleSlug: slug, resource: 'course', to: c.slug }} className="font-semibold text-navy hover:underline">{c.title}</TrackedLink>
                <p className="mt-1 text-sm text-muted-foreground">{c.sponsor} · {c.free ? 'Free' : 'Paid'}</p>
              </li>
            ))}
          </ul>
          {r.courses.fnPath && <p className="mt-3 text-sm"><TrackedLink href={r.courses.fnPath} event="role_resource_clicked" properties={{ roleSlug: slug, resource: 'course_all' }} className={LINK}>All {r.courses.total.toLocaleString('en-US')} {role.fn} courses</TrackedLink></p>}
        </Section>
      )}

      {r.media.length > 0 && (
        <Section id="media" title={`Podcasts and media ${lower} leaders follow`} note="Hand-picked, each checked to be live. Links go to the publisher.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {r.media.map((m) => (
              <li key={m.url} className={CARD}>
                <TrackedLink href={m.url} event="role_resource_clicked" rel="noopener nofollow" properties={{ roleSlug: slug, resource: m.kind, to: m.name }} className="font-semibold text-navy hover:underline">{m.name}</TrackedLink>
                <p className="mt-1 text-xs text-muted-foreground">{MEDIA_KIND_LABEL[m.kind]} · {m.by}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.blurb}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
