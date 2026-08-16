// Shared contract for the three non-Record Market Reality components
// (Evidence, Market, Channels). The Record component has its own richer
// result type (src/lib/scoring/resume-analysis/compute.ts) — this is
// deliberately thinner, since these components don't carry findings/fixes,
// only a score and the plain-language drivers Phase 4/7 will quote in the
// headline explanation ("your network is unused").

export interface ComponentComputation {
  // 0-100, or null when there is genuinely no signal for this component yet
  // (day one, nothing measured/attempted ever) — composite.ts's own §3.6
  // design already documents this as the intended contract ("a day-one
  // candidate with zero Evidence and zero Effort is graded on Experience +
  // Resume alone"): null excludes the component and its weight is
  // redistributed across whatever IS measured, rather than scoring an
  // unearned floor. Never return 0 to mean "no data" — 0 means "measured,
  // and it's bad."
  score: number | null
  // 1-3 short, factual, first-person-avoidant sentences citing real counts
  // or data — never generic filler. Consumed by the Phase 4 headline
  // template and the Phase 7 report, so these must read as finished prose,
  // not internal labels.
  drivers: string[]
}
