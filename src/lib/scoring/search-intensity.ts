// Derived from the existing jobSearchIntensity 4-stop slider (Desire step,
// values 10/40/70/100 — see DesireSlider.tsx) rather than a second onboarding
// question, since that slider already captures this exact signal. Only the
// bottom stop ("Casually looking") represents a candidate who isn't actively
// racing a clock — the other three stops are all gradients of active urgency.
const CASUAL_THRESHOLD = 10

export function isCasuallySearching(jobSearchIntensity: number | null): boolean {
  return jobSearchIntensity !== null && jobSearchIntensity <= CASUAL_THRESHOLD
}
