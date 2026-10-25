import { pageMetadata } from '@/lib/seo/keywords'
import type { Metadata } from 'next'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { FUNDING_STATS } from '@/lib/benefits/public-stats'
import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import { canonical } from '@/lib/seo/canonical'

const DESCRIPTION =
  'Relocation grants, tuition aid, federal training money and free courses, ranked for you. Join NextChapter free and see the programs you qualify for, best fit first.'

export const metadata: Metadata = pageMetadata('/funding')

const action = 'inline-flex h-14 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'
const fmt = (n: number) => n.toLocaleString('en-US')

const STEPS = [
  { title: 'Join free', body: 'A five-minute Market Reality Assessment. It is how we learn where you live, where you would go and what you do.' },
  { title: 'We match', body: 'Each program has rules: a state, a profession, a situation. We keep the programs you can actually use and drop the rest.' },
  { title: 'You see them ranked', body: 'Best fit first, each with the reason it fits and a link to the official page to apply.' },
]

const FAQ = [
  { q: 'Why do I have to join to see the list?', a: 'Because the list is yours. Which programs apply depends on your state, the states you would move to, your work and your situation. Without those answers we would only be showing you everything, and most of it would not apply.' },
  { q: 'Is it free?', a: 'Yes. Candidates are never charged.' },
  { q: 'Do you apply for me, or guarantee I qualify?', a: 'No. We rank programs and send you to each program’s official page, where its own rules decide. Amounts and deadlines change, so confirm there.' },
  { q: 'How do you know these programs are real and open?', a: 'Each program in the list was checked against its official page. Programs that are closed, that pay employers rather than people, or that are written for a group you are not in are left out of your list.' },
  { q: 'Is my information shared?', a: 'What you tell us for matching is private to you. It is not shown to employers, recruiters, schools or coaches.' },
]

export default function FundingPage() {
  const s = FUNDING_STATS
  const groups = [
    { goal: 'support' as const, title: 'Help while you are out of work', body: 'Health-coverage help, final pay and severance you are owed, hardship loans, dues waivers and bill relief, by state.' },
    { goal: 'move' as const, title: 'Money to move', body: 'Relocation grants, down-payment help and incentives to move to a new city or state for work.' },
    { goal: 'retrain' as const, title: 'Tuition and training money', body: 'Tuition aid, state scholarships, federal dislocated-worker training and funds for specific professions.' },
    { goal: 'tax' as const, title: 'Tax credits and deductions', body: 'Money back at tax time that losing a job or changing careers can unlock.' },
    { goal: 'learn' as const, title: 'Free courses', body: 'Free learning from names hiring managers recognize. Listed after the money, because it is not cash.' },
  ]
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          name: 'Funding to relocate, retrain and reskill',
          mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        }}
      />
      <PublicSiteHeader />
      <main className="theme-redesign mx-auto w-full max-w-5xl px-6 py-14 text-ink">
        <section className="mx-auto max-w-3xl text-center" aria-labelledby="funding-h1">
          <h1 id="funding-h1" className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
            Real money to relocate, retrain and reskill is out there. Members get the part that fits them.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            We track {fmt(s.tracked)} programs across the country and keep {fmt(s.verifiedLive)} that are checked, open and made for people, not employers. Join free and we rank
            them for you.
          </p>
          <div className="mt-8">
            <TrackedLink href={MARKET_REALITY_START_HREF} event="funding_cta_clicked" properties={{ cta: 'join_for_matches', page: 'funding_hero' }} className={action}>
              Join free and see what you qualify for
            </TrackedLink>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Free for candidates, always. Takes about five minutes.</p>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="What is in the list">
          {groups.map((g) => (
            <div key={g.goal} className="space-y-3 rounded-2xl border border-border p-6">
              <p className="font-display text-4xl font-semibold">{fmt(s.byGoal[g.goal])}</p>
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <p className="text-sm text-muted-foreground">{g.body}</p>
              {s.examples[g.goal].length > 0 && (
                <ul className="space-y-2 border-t border-border pt-3 text-sm">
                  {s.examples[g.goal].map((e) => (
                    <li key={e.name}>
                      <span className="font-medium">{e.name}</span>, {e.where}
                      <span className="block text-muted-foreground">{e.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Examples only. Whether a program is yours depends on your state, your move and your situation, which is why the list is for members.
        </p>

        <section className="mt-16" aria-labelledby="funding-how">
          <h2 id="funding-how" className="text-center font-display text-3xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((st, i) => (
              <li key={st.title} className="rounded-2xl bg-off-white p-6">
                <p className="text-sm font-semibold text-brand">Step {i + 1}</p>
                <p className="mt-1 text-lg font-semibold">{st.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{st.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16" aria-labelledby="funding-faq">
          <h2 id="funding-faq" className="font-display text-3xl font-semibold tracking-tight">
            Questions
          </h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16 text-center">
          <TrackedLink href={MARKET_REALITY_START_HREF} event="funding_cta_clicked" properties={{ cta: 'join_for_matches', page: 'funding_bottom' }} className={action}>
            Join free and see what you qualify for
          </TrackedLink>
        </section>
      </main>
      <PublicSiteFooter page="funding" />
    </div>
  )
}
