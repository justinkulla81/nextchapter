// Shared contract for the three non-Record Market Reality components
// (Evidence, Market, Channels). The Record component has its own richer
// result type (src/lib/scoring/resume-analysis/compute.ts) — this is
// deliberately thinner, since these components don't carry findings/fixes,
// only a score and the plain-language drivers Phase 4/7 will quote in the
// headline explanation ("your network is unused").

export interface ComponentComputation {
  score: number // 0-100
  // 1-3 short, factual, first-person-avoidant sentences citing real counts
  // or data — never generic filler. Consumed by the Phase 4 headline
  // template and the Phase 7 report, so these must read as finished prose,
  // not internal labels.
  drivers: string[]
}
