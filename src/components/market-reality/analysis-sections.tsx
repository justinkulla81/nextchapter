import { Suspense, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ReviewerExplanationForm } from '@/components/dashboard/ReviewerExplanationForm'
import { AdzunaMarketSection, AdzunaMarketSectionLoading } from '@/components/market/AdzunaMarketSection'
import { isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'
import type { MarketRealityBrief } from '@/lib/reports/market-reality-brief/load'
import { INTERVIEWS_PER_OFFER, PLAN_WEEKS } from '@/lib/reports/market-reality-brief/effort-plan'
import { STANCE_LABEL, STANCE_MARK } from '@/lib/reports/market-reality-brief/evaluators'
import { hiringCaseCounts, HIRING_STATUS_LABEL, type HiringStatus } from '@/lib/reports/market-reality-brief/hiring-case'
import { ADEQUATE_AT, STRENGTH_AT } from '@/lib/reports/market-reality-brief/profile'
import { GAP_LONG_MONTHS, GAP_REPORT_MONTHS, LOOKBACK_YEARS, RECENT_YEARS, SHORT_STINT_MONTHS } from '@/lib/reports/market-reality-brief/experience'
import type { WeeklyChange } from '@/lib/reports/market-reality-brief/weekly-change'
import { InlineAnswer } from './InlineAnswer'
import { CareerTimeline, PaceBars, ProfileScale } from './charts'
import { sectionNumber } from '@/lib/reports/market-reality-brief/sections'
import { buttonVariants } from '@/components/ui/button'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { firstStep, PHASE_LABEL, type Phase } from '@/lib/reports/market-reality-brief/launchpad'
import { AssessmentMark, Estimate, ReportLink, ReportSection, ReportTable, Stat, SubHeading } from './report-ui'

const n = (v: number) => v.toLocaleString('en-US')
const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>

// ── Market ──────────────────────────────────────────────────────────────

export function MarketSection({ brief, marketScope, candidateId }: { brief: MarketRealityBrief; marketScope: 'state' | 'us'; candidateId: string }) {
  const m = brief.market
  return (
    <ReportSection
      id="market"
      number={sectionNumber('market')}
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

// ── Search requirements ─────────────────────────────────────────────────

export function RequirementsSection({ brief }: { brief: MarketRealityBrief }) {
  const e = brief.effort
  if (!e) {
    return (
      <ReportSection id="requirements" number={sectionNumber('requirements')} title="Search requirements" finding="Needs a resume and a target role to estimate how much activity this search takes.">
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
      number={sectionNumber('requirements')}
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

      {pace.activityObserved && <PaceBars plan={plan} />}

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

// ── Experience ──────────────────────────────────────────────────────────

export function ExperienceSection({ brief }: { brief: MarketRealityBrief }) {
  const x = brief.experience
  const finding = !x.assessable
    ? 'Two or more roles on file are needed to read the history.'
    : x.developmentCount === 0
      ? `${x.careerYears} years across ${x.roleCount} roles. The history reads cleanly on every check a recruiter runs.`
      : `${x.careerYears} years across ${x.roleCount} roles. ${x.developmentCount} of ${x.findings.length} checks a recruiter runs would draw a question.`
  return (
    <ReportSection id="experience" number={sectionNumber('experience')} title="Experience in detail" finding={finding}>
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

// ── Skills ──────────────────────────────────────────────────────────────

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
    <ReportSection id="skills" number={sectionNumber('skills')} title="Skills in detail" finding={finding}>
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

// ── Resume ──────────────────────────────────────────────────────────────

export function ResumeSection({ brief }: { brief: MarketRealityBrief }) {
  const r = brief.resume
  const finding = !r
    ? 'Upload a resume to see what to fix and how it reads to the screening software.'
    : r.fixes.length === 0
      ? 'No high-impact issues were found on the current resume.'
      : `${r.fixes.length + r.moreFixes} fixes identified, ordered by how much each improves the resume.`
  return (
    <ReportSection id="resume" number={sectionNumber('resume')} title="Resume in detail" finding={finding}>
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

// ── Direction ───────────────────────────────────────────────────────────

export function DirectionSection({ brief }: { brief: MarketRealityBrief }) {
  const p = brief.pivots
  return (
    <ReportSection
      id="direction"
      number={sectionNumber('direction')}
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

          {(p.industries.length > 0 || p.places.length > 0) && (
            <p className="text-sm text-foreground">
              <span className="font-semibold">Industry and place.</span> The options with the most open roles are the rows marked “Widens most” under Market (section {sectionNumber('market')}). Changing one limit at a time is the lowest-risk move.
            </p>
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

// ── Search activity ─────────────────────────────────────────────────────

const VERDICT_WORD = { act: 'Act', watch: 'Watch', good: 'On track', unknown: 'Too early' } as const

export function ActivitySection({ brief }: { brief: MarketRealityBrief }) {
  const a = brief.search
  const snap = brief.snapshot
  const snapshotLine = snap
    ? [snap.applied ? `applied to ${snap.applied} roles` : null, snap.interviews !== null ? `${snap.interviews} interview${snap.interviews === 1 ? '' : 's'}` : null, snap.offers !== null ? `${snap.offers} offer${snap.offers === 1 ? '' : 's'}` : null].filter(Boolean).join(', ')
    : null
  if (!a && snap) {
    return (
      <ReportSection
        id="activity"
        number={sectionNumber('activity')}
        title="Search activity to date"
        finding={`You told us you have ${snapshotLine || 'started searching'}${snap.stall ? `, and that ${snap.stall.told}. That points to ${snap.stall.points}` : ''}. These are your own numbers. Connect Gmail and they are counted for you, with the reasons.`}
      >
        <p className="text-sm print:hidden">
          <ReportLink href="/dashboard/email-activity" event="market_reality_action_clicked" properties={{ key: 'connect_gmail', area: 'Search activity', surface: 'activity_snapshot' }}>
            Connect Gmail so applications and replies are counted for you
          </ReportLink>
        </p>
      </ReportSection>
    )
  }
  if (!a) {
    return (
      <ReportSection
        id="activity"
        number={sectionNumber('activity')}
        title="Search activity to date"
        finding="No applications are logged yet. Once you apply, this section reads your results as they arrive: interviews, rejections, silence, and whether the search is focused or scattered."
      >
        <p className="text-sm print:hidden">
          <ReportLink href="/dashboard/email-activity" event="market_reality_action_clicked" properties={{ key: 'connect_gmail', area: 'Search activity', surface: 'activity_empty' }}>
            Connect Gmail so applications and replies are counted for you
          </ReportLink>
        </p>
      </ReportSection>
    )
  }
  const { totals } = a
  return (
    <ReportSection
      id="activity"
      number={sectionNumber('activity')}
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

// ── 11 Start here ──────────────────────────────────────────────────────────

export function LaunchpadSection({ brief }: { brief: MarketRealityBrief }) {
  const steps = brief.launchpad
  const next = firstStep(steps)
  const done = steps.filter((s) => s.done).length
  const phases = (Object.keys(PHASE_LABEL) as Phase[]).map((p) => ({ phase: p, steps: steps.filter((s) => s.phase === p) })).filter((g) => g.steps.length > 0)
  return (
    <ReportSection
      id="start"
      number={sectionNumber('start')}
      title="Start here: your first twelve weeks"
      finding="Every step below answers a finding in this report and opens the NextChapter tool that does the work. Tools your current situation keeps off are not offered as steps; each says what turns it on."
    >
      {next && (
        <p className="print:hidden">
          <TrackedLink
            href={next.href}
            event="market_reality_start_clicked"
            properties={{ key: next.key, phase: next.phase, area: next.area, doneSteps: done, totalSteps: steps.length, surface: 'launchpad' }}
            className={buttonVariants()}
          >
            Start: {next.title}
          </TrackedLink>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {done} of {steps.length} steps already done.
      </p>
      {phases.map((g) => (
        <div key={g.phase}>
          <SubHeading>{PHASE_LABEL[g.phase]}</SubHeading>
          <ol className="mt-2 divide-y divide-border border-y border-border">
            {g.steps.map((st) => (
              <li key={st.key} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3 break-inside-avoid">
                <div className="min-w-0 max-w-xl">
                  <p className={st.done ? 'text-sm text-muted-foreground line-through' : 'text-sm font-medium text-foreground'}>{st.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{st.because}</p>
                  {st.lockedNote && <p className="mt-1 text-sm text-foreground">{st.lockedNote}</p>}
                </div>
                <div className="shrink-0 text-right text-sm">
                  {st.done ? (
                    <span className="text-muted-foreground">Done</span>
                  ) : (
                    <span className="print:hidden">
                      <ReportLink href={st.href} event="market_reality_start_clicked" properties={{ key: st.key, phase: st.phase, area: st.area, surface: 'launchpad_step' }}>
                        {st.lockedNote ? 'See what turns it on' : `Open ${st.tool}`}
                      </ReportLink>
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground">{st.minutes ? `About ${st.minutes} min` : st.tool}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {brief.weekActions.length > 0 && (
        <div className="print:hidden">
          <SubHeading>Already queued in your weekly sprint</SubHeading>
          <ul className="mt-2 divide-y divide-border">
            {brief.weekActions.map((a, i) => (
              <li key={i} className="py-2 text-sm text-foreground">
                {a.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            <ReportLink href="/dashboard" event="market_reality_action_clicked" properties={{ key: 'open_sprint', area: 'Start here' }}>
              Set the weekly goal in the sprint
            </ReportLink>
          </p>
        </div>
      )}
    </ReportSection>
  )
}

export function RubricSection() {
  const rows: [string, string][] = [
    ['Tenure', `A completed full-time role under ${SHORT_STINT_MONTHS} months inside the last ${LOOKBACK_YEARS} years is a short stint, unless a layoff, closure or acquisition is on file. Three unexplained, or two inside ${RECENT_YEARS} years, is a pattern. Interim and contract work never counts as a short stint.`],
    ['Gaps', `A gap of ${GAP_REPORT_MONTHS} months or more is reported. One of ${GAP_LONG_MONTHS} months or more with no reason on file, or being out of work that long now, is a development area. Gaps covered by school, a leave or a layoff on file are treated as explained.`],
    ['Progression', 'Two levels at once, or about one level a year, is rapid and needs scope numbers beside it. A step down inside five years needs a stated reason. Ten years at one level is a plateau.'],
    ['Resume dimensions', `Rated from the resume analysis: ${STRENGTH_AT} and above is a strength, ${ADEQUATE_AT} to ${STRENGTH_AT - 1} adequate, below ${ADEQUATE_AT} a development area.`],
    ['Recruiter view', 'Starts from the resume’s first-screen result, then steps down for each of an unexplained tenure pattern and an unexplained gap.'],
    ['Hiring manager view', 'Averages four dimensions: quantification, scope, relevance and recency, and skill currency. 70 and above advances, 45 and above advances with reservations. Capped at reservations when the target level has not been held.'],
    ['Executive recruiter view', 'Counts development areas across tenure, gaps, progression, level, industry breadth and plateau, plus a missing target line. None advances, one reserves, two or more pause.'],
    ['Search volume', `Applications and conversations per interview come from your estimated odds per application. About ${INTERVIEWS_PER_OFFER} interviews are assumed to produce one offer, over ${PLAN_WEEKS} weeks. A conversation is weighted several times an application.`],
    ['Status of these rules', 'They are the screening rules of thumb recruiters use, set by NextChapter. They have not yet been validated against employer outcomes or calibrated against a reference population, and they will change as that evidence arrives.'],
  ]
  return (
    <ReportSection id="rubric" number={sectionNumber('rubric')} title="How ratings are set">
      <ReportTable label="How ratings are set" widths={['22%', '78%']} head={['Measure', 'Rule']} rows={rows.map(([k, v]) => ({ key: k, cells: [k, <span key="v" className="font-normal text-muted-foreground">{v}</span>] }))} />
    </ReportSection>
  )
}

export function MethodNotes() {
  return (
    <footer className="border-t border-navy/20 pt-4 text-xs leading-relaxed text-muted-foreground">
      <p>
        Open-role counts are live postings on the NextChapter board, and trends compare each market with the whole board. Odds, volumes and the grade are working estimates that sharpen as your own results come in. Answers you gave in onboarding, such as pay, applications and where searches stall, are taken as given and replaced by tracked activity once Gmail is connected. A short stint or a gap is never a verdict on a person. Private notes shared with a coach never enter this report.
      </p>
    </footer>
  )
}

// ── 01 How you will be read ────────────────────────────────────────────────

export function EvaluatorSection({ brief }: { brief: MarketRealityBrief }) {
  return (
    <ReportSection
      id="read"
      number={sectionNumber('read')}
      title="How you will be read"
      finding="Three people decide whether this search moves forward, and each reads for something different. What follows is the likely first read from each, built from the evidence in this report using common screening practice. It is a read of the page and the record, not of the person. It has not yet been validated against any employer's actual decisions, so treat the stances as a guide to what to fix, not a forecast."
    >
      {brief.experience.chart.bars.length > 1 && (
        <div>
          <SubHeading>What the record looks like at a glance</SubHeading>
          <div className="mt-2">
            <CareerTimeline chart={brief.experience.chart} />
          </div>
        </div>
      )}
      <p className="text-sm text-foreground print:hidden">
        This is how you read in general. To see how you read for one real posting, with the gaps to close before you apply,{' '}
        <ReportLink href="/dashboard/job-fit" event="market_reality_action_clicked" properties={{ key: 'job_fit', area: 'How you will be read', surface: 'evaluators' }}>
          paste a job into Job Fit
        </ReportLink>
        .
      </p>
      <div className="space-y-8">
        {brief.evaluators.map((e) => (
          <article key={e.key} className="break-inside-avoid space-y-3 border-l-2 border-navy/30 pl-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h3 className="font-serif text-base font-semibold text-navy">
                {e.who}
                {e.stalls && <span className="ml-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Where you told us it stalls</span>}
              </h3>
              <AssessmentMark value={STANCE_MARK[e.stance]} label={STANCE_LABEL[e.stance]} />
            </div>
            <p className="text-sm text-muted-foreground">{e.lens}</p>
            <p className="text-sm text-foreground">
              <span className="font-semibold">First impression.</span> {e.firstImpression}
            </p>
            <div>
              <SubHeading>In their head</SubHeading>
              <ul className="mt-2 space-y-1.5">
                {e.thinking.map((t) => (
                  <li key={t} className="text-sm italic leading-relaxed text-foreground">
                    “{t}”
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <SubHeading>What they will ask</SubHeading>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {e.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
              {e.changesMind.length > 0 && (
                <div>
                  <SubHeading>What would move them up</SubHeading>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                    {e.changesMind.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </ReportSection>
  )
}

// ── 02 Likely objections ───────────────────────────────────────────────────

export function ObjectionsSection({ brief }: { brief: MarketRealityBrief }) {
  const o = brief.objections
  return (
    <ReportSection
      id="objections"
      number={sectionNumber('objections')}
      title="Likely objections and your answers"
      finding={
        o.length === 0
          ? 'Nothing in the record or the resume is likely to draw a serious objection. Keep the numbers on the page current.'
          : `${o.length} ${o.length === 1 ? 'question' : 'questions'} will come up, in roughly this order of weight. Each has a short answer structure. Rehearse them aloud until they take under a minute.`
      }
    >
      {o.length > 0 && (
        <ReportTable
          label="Likely objections and suggested answers"
          widths={['30%', '58%', '12%']}
          head={['What they will ask', 'How to answer', 'From']}
          rows={o.map((x) => ({
            key: x.key,
            cells: [
              <span key="q" className="font-medium">“{x.question}”</span>,
              <span key="a" className="font-normal text-foreground">{x.answer}</span>,
              <Muted key="s">{x.source}</Muted>,
            ],
          }))}
        />
      )}
    </ReportSection>
  )
}

// ── Reasons an employer would hire you ─────────────────────────────────────

/** The same four-state mark the whole report uses: filled, half, empty, and a question mark. */
function HiringStatusMark({ status }: { status: HiringStatus }) {
  if (status === 'unknown') {
    return (
      <span className="inline-flex items-start gap-2 text-foreground">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="mt-0.5 shrink-0">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2" className="text-navy" />
        </svg>
        {HIRING_STATUS_LABEL[status]}
      </span>
    )
  }
  const value = status === 'in_place' ? 'strength' : status === 'issue' ? 'adequate' : 'development'
  return <AssessmentMark value={value} label={HIRING_STATUS_LABEL[status]} className={cn('items-start whitespace-normal', status === 'missing' && 'font-semibold')} />
}

export function HiringCaseSection({ brief }: { brief: MarketRealityBrief }) {
  const rows = brief.hiringCase
  const c = hiringCaseCounts(rows)
  const c2 = brief.caseForYou
  return (
    <ReportSection
      id="hire"
      number={sectionNumber('hire')}
      title="Reasons an employer would hire you"
      finding={`An employer hires for ${rows.length} things. ${c.in_place} ${c.in_place === 1 ? 'is' : 'are'} in place. ${c.issue} ${c.issue === 1 ? 'needs' : 'need'} fixing, ${c.missing} ${c.missing === 1 ? 'is' : 'are'} not yet built, and ${c.unknown} we cannot tell because we do not have the answer yet. Each row names where in NextChapter to add it, fix it or answer it. Gaps come first.`}
    >
      <ReportTable
        label="Reasons an employer would hire you"
        widths={['18%', '17%', '27%', '38%']}
        head={['Employers hire people who…', 'Status', 'What we see', 'Add, fix or answer in NextChapter']}
        rows={rows.map((r) => ({
          key: r.key,
          cells: [
            r.reason,
            <HiringStatusMark key="s" status={r.status} />,
            <span key="w" className="font-normal text-muted-foreground">{r.seen}</span>,
            <div key="n" className="space-y-1 font-normal">
              <p className="text-foreground">{r.next}</p>
              {r.answer && (r.status === 'unknown' || r.status === 'missing') && (
                <div className="print:hidden">
                  <InlineAnswer field={r.answer} />
                </div>
              )}
              <p className="print:hidden">
                <ReportLink href={r.href} event="market_reality_hiring_case_clicked" properties={{ key: r.key, status: r.status, tool: r.tool }}>
                  {r.status === 'in_place' ? `See it in ${r.tool}` : `Open ${r.tool}`}
                </ReportLink>
                {r.minutes ? <span className="text-xs text-muted-foreground"> · about {r.minutes} min</span> : null}
              </p>
              <p className="hidden text-xs text-muted-foreground print:block">{r.tool}{r.minutes ? ` · about ${r.minutes} min` : ''}</p>
            </div>,
          ],
        }))}
      />
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Not yet built</span> means it does not exist for you yet, so it is something to add.{' '}
        <span className="font-semibold text-foreground">We do not know yet</span> means we lack the input, so it is something to answer.
      </p>
      {(c2.items.length > 0 || c2.positioningLine) && (
        <div className="grid gap-6 sm:grid-cols-2 break-inside-avoid">
          {c2.items.length > 0 && (
            <div>
              <SubHeading>Lead with these</SubHeading>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {c2.items.slice(0, 3).map((x) => (
                  <li key={x.key}>
                    <span className="font-semibold">{x.headline}.</span> {x.evidence}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c2.positioningLine && (
            <div className="border-l-2 border-navy/30 pl-5">
              <SubHeading>A draft positioning line</SubHeading>
              <p className="mt-2 font-serif text-base leading-relaxed text-navy">{c2.positioningLine}</p>
              <p className="mt-1 text-xs text-muted-foreground">Built only from facts on your profile. Edit it, then use it as the top line of the resume, the LinkedIn headline and every first message.</p>
            </div>
          )}
        </div>
      )}
    </ReportSection>
  )
}

// ── Competency profile ─────────────────────────────────────────────────────

export function ProfileSection({ brief }: { brief: MarketRealityBrief }) {
  const groups = brief.profile
  const rows = groups.flatMap((g) => g.rows)
  const dev = rows.filter((r) => r.assessment === 'development').length
  return (
    <ReportSection
      id="profile"
      number={sectionNumber('profile')}
      title="Competency profile"
      finding={
        rows.length === 0
          ? 'Upload a resume to see how it scores on each of the thirteen things a reviewer reads.'
          : `${rows.length} dimensions a reviewer reads, in the groups they think in. ${dev === 0 ? 'None is a development area.' : `${dev} ${dev === 1 ? 'is a development area' : 'are development areas'}; the observation beside each says what to change first.`}`
      }
    >
      {groups.length > 0 && <ProfileScale groups={groups} />}
      {groups.length > 0 && (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[34rem] table-fixed border-collapse text-sm" aria-label="Competency profile">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '56%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-navy text-left">
                {['Dimension', 'What a reviewer reads', 'Rating'].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 text-xs font-semibold tracking-wide text-navy uppercase last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title}>
                <tr>
                  <th colSpan={3} scope="colgroup" className="pt-4 pb-1 text-left text-xs font-semibold tracking-widest text-muted-foreground uppercase print:break-after-avoid">
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.key} className="break-inside-avoid border-b border-border align-top">
                    <td className="py-2 pr-4 font-medium text-foreground print:py-1">{r.label}</td>
                    <td className="py-2 pr-4 print:py-1">
                      <p className="text-muted-foreground print:hidden">{r.reads}</p>
                      {r.observation && <p className="text-foreground">{r.observation}</p>}
                    </td>
                    <td className="py-2 print:py-1">
                      <AssessmentMark value={r.assessment} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </ReportSection>
  )
}

export function AppendixDivider() {
  return (
    <div className="space-y-2 border-t-4 border-navy pt-6 print:break-before-page">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Appendix</p>
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">Supporting detail</h2>
      <p className="max-w-2xl text-sm text-muted-foreground print:hidden">
        The evidence behind the findings above: the profile this was read against, how each resume dimension scored, and the detail on experience, skills, the resume and search activity.
      </p>
    </div>
  )
}

// ── Sharpen this report ────────────────────────────────────────────────────

/** What the report has and what it would still like to know, each with the one step that tells it. Not a score. */
export function SharpenPanel({ brief }: { brief: MarketRealityBrief }) {
  const items = brief.sharpen
  const known = items.filter((i) => i.known).length
  const open = items.filter((i) => !i.known)
  if (open.length === 0) return null
  return (
    <section id="sharpen" aria-labelledby="sharpen-title" className="space-y-3 border border-navy/20 p-5 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sharpen-title" className="font-serif text-lg font-semibold tracking-tight text-navy">
          Sharpen this report
        </h2>
        <p className="text-xs text-muted-foreground">
          {known} of {items.length} inputs known
        </p>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Anything we do not know is left out of the findings, not counted against you. Each answer below changes a specific part of this report the moment you save it.
      </p>
      <ul className="divide-y divide-border">
        {open.map((i) => (
          <li key={i.key} className="space-y-1.5 py-3">
            <p className="text-sm font-medium text-foreground">{i.label}</p>
            <p className="text-sm text-muted-foreground">{i.unlocks}</p>
            {i.control?.kind === 'answer' && <InlineAnswer field={i.control.field} />}
            {i.control?.kind === 'link' && (
              <p className="text-sm">
                <ReportLink href={i.control.href} event="market_reality_sharpen_clicked" properties={{ key: i.key }}>
                  {i.control.cta}
                </ReportLink>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── What changed ───────────────────────────────────────────────────────────

const MOVE_WORD = { up: 'Moved up', learned: 'Now known', down: 'Slipped' } as const

/** The report's movement since the last saved read. Says "nothing moved" plainly when that is true. */
export function WhatChangedCard({ change, brief }: { change: WeeklyChange | null; brief: MarketRealityBrief }) {
  const next = firstStep(brief.launchpad)
  if (!change) {
    return (
      <p className="border-l-2 border-navy/30 pl-4 text-sm text-muted-foreground print:hidden">
        This is your first saved read. Next week this space shows what moved: which of the reasons an employer would hire you changed, what the market did, and how your pace compared.
      </p>
    )
  }
  const since = new Date(change.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <section id="changed" aria-labelledby="changed-title" className="space-y-3 break-inside-avoid border border-navy/20 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="changed-title" className="font-serif text-lg font-semibold tracking-tight text-navy">
          What changed since {since}
        </h2>
        {change.inputsKnown && (
          <p className="text-xs text-muted-foreground">
            Inputs known: {change.inputsKnown.from} to {change.inputsKnown.to} of {change.inputsKnown.total}
          </p>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{change.headline}</p>
      {change.moves.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {change.moves.map((m) => (
            <li key={m.key} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-sm">
              <span className="text-foreground">{m.line}</span>
              <span className={m.kind === 'down' ? 'text-xs font-semibold text-foreground' : 'text-xs text-muted-foreground'}>{MOVE_WORD[m.kind]}</span>
            </li>
          ))}
        </ul>
      )}
      {change.market && <p className="text-sm text-foreground">{change.market}</p>}
      {change.activity && <p className="text-sm text-foreground">{change.activity}</p>}
      {change.grade && (
        <p className="text-sm text-foreground">
          Market Reality Grade moved from {change.grade.from} to {change.grade.to}.<span className="ml-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">estimate</span>
        </p>
      )}
      {next && (
        <p className="text-sm print:hidden">
          <span className="font-semibold">Next:</span> {next.title}.{' '}
          <ReportLink href={next.href} event="market_reality_start_clicked" properties={{ key: next.key, phase: next.phase, area: next.area, surface: 'what_changed' }}>
            Do it now
          </ReportLink>
        </p>
      )}
    </section>
  )
}
