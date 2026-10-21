import type { ReactNode } from 'react'
import type { Strengths, WhyHire } from '@/lib/profile/strengths-load'
import { strengthStepHref } from '@/lib/redesign/jobs-pages'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'
import { FactList, SectionBlock, SourceLine, VerdictPanel } from '@/components/candidate/Blocks'

/** The written "why hire me": the statement in display type, its proof points, and where to use it. */
export function WhyHireView({ whyHire }: { whyHire: WhyHire }) {
  return (
    <div className="space-y-3">
      <p className="max-w-2xl font-display text-xl leading-snug text-ink">{whyHire.statement}</p>
      {whyHire.proofPoints.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-base text-ink">
          {whyHire.proofPoints.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <SourceLine>Use it in your LinkedIn About, your “tell me about yourself”, and your cover notes.</SourceLine>
    </div>
  )
}

// Why hire me in the redesign: one verdict with the written statement, the strengths with the evidence behind each,
// and what to prepare or sharpen behind "Show more". `whyHire` is a slot so the page can stream the write-up.
export function StrengthsRedesign({ st, whyHire }: { st: Strengths; whyHire: ReactNode }) {
  const lead = st.shape === 'peaked' ? st.peaks : st.broad.slice(0, 4)
  const nextMissing = st.missing[0]
  return (
    <div className="space-y-8">
      <PageHeader
        title="Why hire me"
        intro="Where you stand out, shown with the evidence behind it: your assessments, references, track record and skills. Your job matches, LinkedIn copy and dossier lead with these."
        action={
          nextMissing ? (
            <ActionLink href={strengthStepHref(nextMissing)} kind="primary" event="strengths_next_step_clicked" props={{ step: nextMissing, shape: st.shape, evidenceCount: lead.length }}>
              Add more evidence
            </ActionLink>
          ) : (
            <ActionLink href="/dashboard/linkedin" kind="primary" event="strengths_use_clicked" props={{ shape: st.shape, evidenceCount: lead.length }}>
              Use it on LinkedIn
            </ActionLink>
          )
        }
      />
      <VerdictPanel id="headline" title={st.headline}>
        {whyHire}
      </VerdictPanel>
      {lead.length > 0 ? (
        <SectionBlock id="peaks-h" title={st.shape === 'peaked' ? 'Your standout strengths' : 'Where you are strong'} why="Each one rests on the evidence under it.">
          <RowList
            label="Strengths"
            items={lead.map((x) => ({
              key: x.key,
              title: x.label,
              why: x.evidence[0],
              detail:
                x.evidence.length > 1 ? (
                  <ul className="list-disc space-y-1 pl-5 text-base text-ink">
                    {x.evidence.slice(1).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                ) : undefined,
              detailLabel: 'More evidence',
            }))}
          />
          {st.shape === 'balanced' && (
            <SourceLine>
              No single peak is not a weakness. Teams need people who are reliably good at many things; say so plainly (“the person you can hand anything to”) and back it with one example for each.
            </SourceLine>
          )}
        </SectionBlock>
      ) : (
        <SectionBlock id="peaks-h" title="Not enough evidence yet" why="Do one of the steps under Show more and this fills in. References count most." />
      )}
      {(st.weakSpots.length > 0 || st.missing.length > 0) && (
        <ShowMore page="strengths" label="Show what to prepare and sharpen">
          {st.weakSpots.length > 0 && (
            <SectionBlock
              id="weak-h"
              title="Go in with a plan (private)"
              why="Only you see this. We flag jobs and pivot paths that lean on these, so you can prepare or pick roles that play to your strengths."
            >
              <FactList label="Weak spots" items={st.weakSpots.map((w) => ({ key: w.key, name: <span className="font-semibold">{w.label}</span>, fact: w.line }))} />
            </SectionBlock>
          )}
          {st.missing.length > 0 && (
            <SectionBlock id="sharpen-h" title="Sharpen this" why="Each step adds evidence a recruiter can check.">
              <RowList
                label="Ways to add evidence"
                items={st.missing.map((m) => ({
                  key: m,
                  title: m.endsWith('.') ? m : `${m}.`,
                  actions: (
                    <ActionLink href={strengthStepHref(m)} event="strengths_sharpen_clicked" props={{ step: m }}>
                      Do it now
                    </ActionLink>
                  ),
                }))}
              />
            </SectionBlock>
          )}
        </ShowMore>
      )}
    </div>
  )
}
