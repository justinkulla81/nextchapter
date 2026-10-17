import { Suspense, type ReactNode } from 'react'
import { ReviewerExplanationForm } from '@/components/dashboard/ReviewerExplanationForm'
import { AdzunaMarketSection, AdzunaMarketSectionLoading } from '@/components/market/AdzunaMarketSection'
import { isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'
import type { MarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import { INTERVIEWS_PER_OFFER, PLAN_WEEKS } from '@/lib/reports/market-reality-brief/effort-plan'
import { AssessmentMark, Estimate, ReportLink, ReportSection, ReportTable, Stat, SubHeading } from './report-ui'

const n = (v: number) => v.toLocaleString('en-US')
const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>

// ── 02 Market ──────────────────────────────────────────────────────────────

export function MarketSection({ brief, marketScope, candidateId }: { brief: MarketRealityBrief; marketScope: 'state' | 'us'; candidateId: string }) {
  const m = brief.market
  return (
    <ReportSection
      id="market"
      number="02"
      title="Market"
      finding={m ? m.readout : 'Set a target function and level on Search Strategy to size the market for this search.'}
    >
      {m && (
        <>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Stat value={n(m.openRoles)} label="Open roles that fit on level, field, place and skills" />
            {m.strongFits !== null && <Stat value={n(m.strongFits)} label="Of those, strong fits" />}
            <Stat value={n(m.widerOpen)} label="Open in the wider market for the same work" />
          </div>
          <p className="text-xs text-muted-foreground">Target: {m.targetLabel}. Trend compares the last two weeks of new postings with the four before, against the whole board.</p>

          {m.prompt === 'too_many' && m.slices.length > 0 && (
            <div>
              <SubHeading>Largest slices of this market</SubHeading>
              <ReportTable
                label="Largest slices of the market"
                head={['Slice', 'Open roles']}
                className="mt-2"
                rows={m.slices.map((s) => ({
                  key: s.label,
                  cells: [
                    <ReportLink key="l" href={`/dashboard/find-my-job?q=${encodeURIComponent(s.label)}#job-recommendations`} event="market_reality_market_option_clicked" properties={{ label: s.label, kind: 'slice', openRoles: s.openRoles }}>
                      {s.label}
                    </ReportLink>,
                    n(s.openRoles),
                  ],
                }))}
              />
            </div>
          )}

          {m.rows.length > 0 && m.prompt !== 'too_many' && (
            <div>
              <SubHeading>If one limit is lifted</SubHeading>
              <ReportTable
                label="Open roles if one limit is lifted"
                head={['Option', 'Open roles', 'Trend', '']}
                className="mt-2"
                rows={m.rows.map((r) => ({
                  key: r.label,
                  cells: [
                    r.href ? (
                      <ReportLink key="l" href={r.href} event="market_reality_market_option_clicked" properties={{ label: r.label, kind: 'widen', openRoles: r.openRoles, recommended: r.recommended }}>
                        {r.label}
                      </ReportLink>
                    ) : (
                      r.label
                    ),
                    n(r.openRoles),
                    <Muted key="t">{r.trend ?? '—'}</Muted>,
                    r.recommended ? <span key="r" className="text-xs font-semibold tracking-wide text-navy uppercase">Widens most</span> : null,
                  ],
                }))}
              />
            </div>
          )}
        </>
      )}

      {isAdzunaInsightsEnabled() && (
        <div id="market-data" className="scroll-mt-24">
          <SubHeading>Compensation and demand for the role</SubHeading>
          <Suspense fallback={<AdzunaMarketSectionLoading />}>
            <AdzunaMarketSection candidateId={candidateId} scope={marketScope} />
          </Suspense>
        </div>
      )}
    </ReportSection>
  )
}

// ── 03 Search requirements ─────────────────────────────────────────────────

export function RequirementsSection({ brief }: { brief: MarketRealityBrief }) {
  const e = brief.effort
  if (!e) {
    return (
      <ReportSection id="requirements" number="03" title="Search requirements" finding="Needs a resume and a target role to estimate how much activity this search takes.">
        <></>
      </ReportSection>
    )
  }
  const { plan } = e
  const { pace } = plan
  const coverage = Math.round(pace.coverage * 100)
  return (
    <ReportSection
      id="requirements"
      number="03"
      title="Search requirements"
      finding={
        <>
          For this profile in this market, one interview typically takes about <strong className="font-semibold">{n(plan.applicationsPerInterview)} applications</strong> or{' '}
          <strong className="font-semibold">{n(plan.conversationsPerInterview)} real conversations</strong>. Competitiveness: {e.competitiveness.label.toLowerCase()}.
          <Estimate />
        </>
      }
    >
      <div>
        <SubHeading>Volume to reach about {INTERVIEWS_PER_OFFER} interviews, over {PLAN_WEEKS} weeks</SubHeading>
        <ReportTable
          label="Search volume by route"
          head={['Route', 'Applications', 'Conversations', 'Per week']}
          className="mt-2"
          rows={plan.routes.map((r) => ({
            key: r.key,
            cells: [
              r.label,
              r.applications > 0 ? n(r.applications) : '—',
              r.conversations > 0 ? n(r.conversations) : '—',
              <Muted key="w">
                {[r.applicationsPerWeek > 0 && `${r.applicationsPerWeek} applications`, r.conversationsPerWeek > 0 && `${r.conversationsPerWeek} conversations`].filter(Boolean).join(' + ')}
              </Muted>,
            ],
          }))}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Planning assumption: about {INTERVIEWS_PER_OFFER} interviews produce one offer. A real conversation counts as roughly {Math.round(plan.applicationsPerInterview / plan.conversationsPerInterview)} applications because a referred candidate is pulled from the pile far more often. Applications that Job Fit rates as a poor match are not counted.
        </p>
      </div>

      {e.capacity.notes.length > 0 && (
        <div>
          <SubHeading>Against your Search Strategy</SubHeading>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {e.capacity.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm print:hidden">
            <ReportLink href="/dashboard/search-strategy" event="market_reality_action_clicked" properties={{ key: 'adjust_search_strategy', area: 'Search activity' }}>
              Adjust your weekly goal
            </ReportLink>
          </p>
        </div>
      )}

      <div>
        <SubHeading>Current pace, last four weeks</SubHeading>
        {pace.activityObserved ? (
          <div className="mt-2 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={`${pace.applicationsPerWeek}`} label="Applications a week" />
            <Stat value={`${pace.conversationsPerWeek}`} label="Conversations a week" />
            <Stat value={`${pace.expectedInterviews}`} label={`Interviews expected in ${PLAN_WEEKS} weeks`} />
            <Stat value={`${coverage}%`} label={`Of the ~${INTERVIEWS_PER_OFFER} typically needed`} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No applications or networking are logged in the last four weeks, so the search has not started producing interviews yet.</p>
        )}
      </div>
    </ReportSection>
  )
}

// ── 04 Experience ──────────────────────────────────────────────────────────

export function ExperienceSection({ brief }: { brief: MarketRealityBrief }) {
  const x = brief.experience
  const finding = !x.assessable
    ? 'Two or more roles on file are needed to read the history.'
    : x.developmentCount === 0
      ? `${x.careerYears} years across ${x.roleCount} roles. The history reads cleanly on every check a recruiter runs.`
      : `${x.careerYears} years across ${x.roleCount} roles. ${x.developmentCount} of ${x.findings.length} checks a recruiter runs would draw a question.`
  return (
    <ReportSection id="experience" number="04" title="Experience" finding={finding}>
      {x.assessable ? (
        <ReportTable
          label="Experience checks"
          head={['Check', 'Finding', 'Assessment']}
          rows={x.findings.map((f) => ({
            key: f.key,
            cells: [
              f.label,
              <div key="f" className="space-y-1">
                <p className="text-foreground">{f.measure}</p>
                <p className="text-xs text-muted-foreground">{f.norm}</p>
                {f.action && (
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Action:</span> {f.action}
                  </p>
                )}
              </div>,
              <AssessmentMark key="a" value={f.assessment} />,
            ],
          }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          <ReportLink href="/dashboard/profile" event="market_reality_action_clicked" properties={{ key: 'add_work_history', area: 'Experience' }}>
            Add your work history
          </ReportLink>{' '}
          to see tenure, gaps and progression assessed.
        </p>
      )}

      {x.timeline.length > 0 && (
        <div>
          <SubHeading>Role history on file</SubHeading>
          <ReportTable
            label="Role history"
            head={['Company', 'Title', 'Period', 'Tenure']}
            className="mt-2"
            rows={x.timeline.map((t, i) => ({
              key: `${t.company}-${i}`,
              cells: [
                t.company,
                <span key="t">
                  {t.title}
                  {t.note && <span className="text-xs text-muted-foreground"> · {t.note}</span>}
                </span>,
                <Muted key="p">{t.period}</Muted>,
                <Muted key="n">{t.tenure}</Muted>,
              ],
            }))}
          />
        </div>
      )}

      {brief.recruiterRead.length > 0 && (
        <div id="recruiter-read" className="scroll-mt-24">
          <SubHeading>Questions a recruiter will ask</SubHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare a one-line answer to each. Saving it removes the question from this list; it is practice, not an admission.
          </p>
          <div className="mt-3 divide-y divide-border">
            {brief.recruiterRead.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 break-inside-avoid">
                <p className="text-sm text-foreground">{item.whatAReviewerNotices}</p>
                <div className="print:hidden">
                  <ReviewerExplanationForm id={item.id} placeholder={item.followUpPrompt} detectionType={item.detectionType} detectedContext={item.detectedContext} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReportSection>
  )
}

// ── 05 Skills ──────────────────────────────────────────────────────────────

export function SkillsSection({ brief }: { brief: MarketRealityBrief }) {
  const s = brief.skills
  const aiGaps = s?.ai.filter((r) => !r.have).length ?? 0
  const finding =
    !s || s.employers === 0
      ? 'There are not enough matching jobs yet to read your skills against what employers ask for.'
      : s.employersAskingAi === 0
        ? `None of the ${s.employers} employers with jobs that fit you ask for a specific AI skill yet.`
        : `${s.employersAskingAi} of the ${s.employers} employers with jobs that fit you ask for a specific AI skill. ${aiGaps === 0 ? 'Each one asked for is on your profile.' : `${aiGaps} ${aiGaps === 1 ? 'is' : 'are'} not on your profile.`}`
  return (
    <ReportSection id="skills" number="05" title="Skills" finding={finding}>
      {s?.marketLine && <p className="text-sm text-muted-foreground">{s.marketLine}</p>}

      {s && s.ai.length > 0 && (
        <div>
          <SubHeading>AI skills</SubHeading>
          <ReportTable
            label="AI skills asked for by target employers"
            head={['Skill', 'Asked for by', 'On profile', 'Close the gap']}
            className="mt-2"
            rows={s.ai.map((r) => ({
              key: r.term,
              cells: [
                r.term,
                <Muted key="e">{r.employers} of {s.employers} employers</Muted>,
                r.have ? 'Yes' : <span key="n" className="font-semibold">No</span>,
                r.have ? (
                  <Muted key="c">—</Muted>
                ) : (
                  <span key="c" className="print:hidden">
                    <ReportLink href="/dashboard/learning#ai-skills-for-your-search" event="market_reality_action_clicked" properties={{ key: 'ai_skill_course', area: 'Skills', term: r.term, hasCourse: !!r.course }}>
                      {r.course ? r.course.title : 'Add it, or find a course'}
                    </ReportLink>
                  </span>
                ),
              ],
            }))}
          />
        </div>
      )}

      {s && s.other.length > 0 && (
        <div>
          <SubHeading>Other skills</SubHeading>
          <ReportTable
            label="Other skills asked for by target employers"
            head={['Skill', 'Asked for by', 'On profile']}
            className="mt-2"
            rows={s.other.map((r) => ({
              key: r.term,
              cells: [r.term, <Muted key="e">{r.employers} of {s.employers} employers</Muted>, r.have ? 'Yes' : <span key="n" className="font-semibold">No</span>],
            }))}
          />
        </div>
      )}

      {s && s.tools.length > 0 && (
        <p className="text-sm text-muted-foreground">
          AI tools named most in postings for this function: <span className="text-foreground">{s.tools.join(', ')}</span>.{' '}
          <span className="print:hidden">
            <ReportLink href="/dashboard/skills-assessment#tools" event="market_reality_action_clicked" properties={{ key: 'ai_tools', area: 'Skills' }}>
              Show the AI you use
            </ReportLink>
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Gaps describe what postings ask for, not a test of the person. “On profile” means the skill appears in the resume, confirmed skills or certifications; if you have one that is not listed, add it so matches count it.
      </p>
    </ReportSection>
  )
}

// ── 06 Resume ──────────────────────────────────────────────────────────────

export function ResumeSection({ brief }: { brief: MarketRealityBrief }) {
  const r = brief.resume
  const finding = !r
    ? 'Upload a resume to see what to fix and how it reads to the screening software.'
    : r.fixes.length === 0
      ? 'No high-impact issues were found on the current resume.'
      : `${r.fixes.length + r.moreFixes} fixes identified, ordered by how much each improves the resume.`
  return (
    <ReportSection id="resume" number="06" title="Resume" finding={finding}>
      {r && r.fixes.length > 0 && (
        <>
          <ReportTable
            label="Resume fixes"
            head={['Area', 'Issue and fix']}
            rows={r.fixes.map((f, i) => ({
              key: `${f.dimension}-${i}`,
              cells: [
                f.dimension,
                <div key="f" className="space-y-1.5">
                  <p className="text-foreground">{f.whatsWrong}</p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Fix:</span> {f.fix}
                  </p>
                  {f.rewrite && (
                    <div className="mt-2 grid gap-3 border-l-2 border-navy/30 pl-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Current</p>
                        <p className="mt-0.5 text-sm text-foreground">{f.rewrite.before}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-navy uppercase">Suggested</p>
                        <p className="mt-0.5 text-sm text-foreground">{f.rewrite.after}</p>
                      </div>
                    </div>
                  )}
                </div>,
              ],
            }))}
          />
          <p className="text-sm print:hidden">
            {r.moreFixes > 0 && <Muted>{r.moreFixes} more in the editor. </Muted>}
            <ReportLink href="/dashboard/resume#resume-fixes" event="market_reality_action_clicked" properties={{ key: 'open_resume_editor', area: 'Resume' }}>
              Fix these in the Resume Editor
            </ReportLink>
          </p>
        </>
      )}

      {r?.ats && (
        <div>
          <SubHeading>Screening software</SubHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            Most resumes are read by software before a person. This is a mechanical check, not a comment on the candidate.
          </p>
          <ReportTable
            label="Screening software compatibility"
            head={['Parser', 'Result']}
            className="mt-2"
            rows={[
              ...r.ats.issues.map((i) => ({
                key: i.parserLabel,
                cells: [
                  i.parserLabel,
                  <div key="r" className="space-y-1">
                    <p className="font-semibold">{i.severity === 'FAILING' ? 'Largely fails to parse' : 'Partial parse'}</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {i.failures.map((f, k) => (
                        <li key={k}>{f}</li>
                      ))}
                    </ul>
                  </div>,
                ],
              })),
              ...(r.ats.cleanParsers.length > 0
                ? [{ key: 'clean', cells: [r.ats.cleanParsers.join(', '), <Muted key="c">Parses cleanly</Muted>] }]
                : []),
            ]}
          />
        </div>
      )}
    </ReportSection>
  )
}

// ── 07 Direction ───────────────────────────────────────────────────────────

export function DirectionSection({ brief }: { brief: MarketRealityBrief }) {
  const p = brief.pivots
  return (
    <ReportSection
      id="direction"
      number="07"
      title="Direction"
      finding={
        p
          ? 'A change of direction is worth testing alongside the main search. The options below are ranked by open roles and fit with the background.'
          : 'No change of direction is indicated. The target market is large enough and the odds per application do not call for a pivot. Revisit this if the market shrinks or the search stalls.'
      }
    >
      {p && (
        <>
          {p.reasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {p.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          {p.industries.length > 0 && (
            <div>
              <SubHeading>Industry: the same work elsewhere</SubHeading>
              <ReportTable
                label="Industry options"
                head={['Option', 'Open roles', 'Trend']}
                className="mt-2"
                rows={p.industries.map((r) => ({
                  key: r.label,
                  cells: [
                    r.href ? (
                      <ReportLink key="l" href={r.href} event="market_reality_market_option_clicked" properties={{ label: r.label, kind: 'industry', openRoles: r.openRoles }}>
                        {r.label}
                      </ReportLink>
                    ) : (
                      r.label
                    ),
                    n(r.openRoles),
                    <Muted key="t">{r.trend ?? '—'}</Muted>,
                  ],
                }))}
              />
            </div>
          )}

          {p.places.length > 0 && (
            <div>
              <SubHeading>Geography: a wider area</SubHeading>
              <ReportTable
                label="Geography options"
                head={['Option', 'Open roles', 'Trend']}
                className="mt-2"
                rows={p.places.map((r) => ({
                  key: r.label,
                  cells: [
                    r.href ? (
                      <ReportLink key="l" href={r.href} event="market_reality_market_option_clicked" properties={{ label: r.label, kind: 'place', openRoles: r.openRoles }}>
                        {r.label}
                      </ReportLink>
                    ) : (
                      r.label
                    ),
                    n(r.openRoles),
                    <Muted key="t">{r.trend ?? '—'}</Muted>,
                  ],
                }))}
              />
            </div>
          )}

          {p.functions.length > 0 && (
            <div>
              <SubHeading>Function: a different kind of work</SubHeading>
              <ReportTable
                label="Function options"
                head={['Role', 'Fit and time', 'Demand', 'Pay']}
                className="mt-2"
                rows={p.functions.map((f) => ({
                  key: f.label,
                  cells: [
                    <div key="r" className="space-y-1">
                      <p>{f.label}</p>
                      <p className="text-xs font-normal text-muted-foreground">{f.why}</p>
                    </div>,
                    <Muted key="f">
                      {f.fit}; {f.time}
                    </Muted>,
                    <Muted key="d">{f.demand}</Muted>,
                    <Muted key="p">{f.pay}</Muted>,
                  ],
                }))}
              />
              <p className="mt-3 text-sm print:hidden">
                <ReportLink href="/dashboard/pivot-paths" event="market_reality_action_clicked" properties={{ key: 'open_pivot_paths', area: 'Direction' }}>
                  See every pivot path with the skills to close
                </ReportLink>
              </p>
            </div>
          )}
        </>
      )}
    </ReportSection>
  )
}

// ── 08 Search activity ─────────────────────────────────────────────────────

const VERDICT_WORD = { act: 'Act', watch: 'Watch', good: 'On track', unknown: 'Too early' } as const

export function ActivitySection({ brief }: { brief: MarketRealityBrief }) {
  const a = brief.search
  if (!a) return null
  const { totals } = a
  return (
    <ReportSection
      id="activity"
      number="08"
      title="Search activity to date"
      finding={`${totals.applications} applications have produced ${totals.interviews} interview${totals.interviews === 1 ? '' : 's'}${a.interviewRate !== null ? ` (${a.interviewRate}%)` : ''}, ${totals.rejections} rejection${totals.rejections === 1 ? '' : 's'} and ${totals.noReplyYet} with no reply after three weeks. Updated as new mail arrives.`}
    >
      <ReportTable
        label="Search diagnosis"
        head={['Question', 'Finding', 'Reading']}
        rows={a.checks.map((c) => ({
          key: c.key,
          cells: [
            c.question,
            <div key="f" className="space-y-1">
              <p className="text-foreground">{c.headline}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
              {c.suggestion && (
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Action:</span> {c.suggestion}
                </p>
              )}
            </div>,
            <span key="v" className={c.verdict === 'act' ? 'font-semibold' : 'text-muted-foreground'}>
              {VERDICT_WORD[c.verdict]}
            </span>,
          ],
        }))}
      />

      {(a.focus.length > 0 || a.rejections.length > 0) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {a.focus.length > 0 && (
            <div>
              <SubHeading>Focus of applications</SubHeading>
              <dl className="mt-2 space-y-2 text-sm">
                {a.focus.map((f) => (
                  <div key={f.label}>
                    <dt className="font-medium text-foreground">{f.label}</dt>
                    <dd className="text-muted-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {a.rejections.length > 0 && (
            <div>
              <SubHeading>Where the rejections came from</SubHeading>
              <dl className="mt-2 space-y-2 text-sm">
                {a.rejections.map((f) => (
                  <div key={f.label}>
                    <dt className="font-medium text-foreground">{f.label}</dt>
                    <dd className="text-muted-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground print:hidden">
        Something counted wrongly? Remove it on the{' '}
        <ReportLink href="/dashboard/find-my-job" event="market_reality_action_clicked" properties={{ key: 'fix_counted_activity', area: 'Search activity' }}>
          Jobs page
        </ReportLink>
        .
      </p>
    </ReportSection>
  )
}

// ── 09 This week ───────────────────────────────────────────────────────────

export function WeekSection({ brief }: { brief: MarketRealityBrief }) {
  if (brief.weekActions.length === 0) return null
  return (
    <ReportSection
      id="this-week"
      number="09"
      title="This week"
      finding="Each of these is a real action that counts toward the weekly sprint."
      className="print:hidden"
    >
      <ul className="divide-y divide-border">
        {brief.weekActions.map((a, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <span className="text-foreground">{a.text}</span>
            {a.isAStandard && <span className="shrink-0 text-xs text-muted-foreground">Part of an A-level week</span>}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <ReportLink href="/dashboard" event="market_reality_action_clicked" properties={{ key: 'open_sprint', area: 'This week' }}>
          Set the weekly goal in the sprint
        </ReportLink>
      </p>
    </ReportSection>
  )
}

export function MethodNotes() {
  return (
    <footer className="border-t border-navy/20 pt-6 text-xs leading-relaxed text-muted-foreground">
      <p className="font-semibold tracking-widest text-navy uppercase">Method and limits</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Everything here is read from your profile and activity and computed by fixed rules. Nothing is written by a model, so a sentence cannot disagree with the number beside it.</li>
        <li>Open-role counts are live postings on the NextChapter board. Trends compare each market with the whole board, because the number of sources grows over time.</li>
        <li>Odds per application, volumes and the grade are working estimates. They sharpen as more candidates use the product and as your own results come in, and they are not predictions of an outcome.</li>
        <li>Experience norms are the screening rules of thumb recruiters use, not statistics about your market. A short stint or a gap is never a verdict on a person.</li>
        <li>Private notes you share with a coach, such as blockers and motivations, never enter this report.</li>
      </ul>
    </footer>
  )
}
