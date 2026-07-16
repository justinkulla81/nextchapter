// Varied self-intro templates so the "introduce yourself" gate post doesn't
// read identically for every candidate — deterministic per candidate (same
// wording every time they see the prefilled draft, different candidate to
// candidate), not random.

function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

interface SelfIntroInput {
  candidateId: string
  firstName: string | null
  primaryFunction: string | null
  targetRoleType: string | null
  currentCity: string | null
}

export function buildSelfIntroDraft({
  candidateId,
  firstName,
  primaryFunction,
  targetRoleType,
  currentCity,
}: SelfIntroInput): string {
  const name = firstName || 'there'
  const background = primaryFunction || 'my field'
  const target = targetRoleType || 'my next role'
  const location = currentCity ? ` in ${currentCity}` : ''

  const templates = [
    `Hi, I'm ${name}. I've been in ${background}, and I'm looking for a ${target} role${location}. Happy to be helpful if I can be.`,
    `Hey — ${name} here. My background's in ${background}, targeting ${target} work${location}. Always glad to lend a hand if I can.`,
    `I'm ${name}. Spent my career in ${background}, now searching for a ${target} role${location}. If I can help someone else here, just ask.`,
    `${name} here, background in ${background}. Looking for my next ${target} role${location} — reach out if there's ever something I can help with.`,
  ]

  return templates[hashSeed(candidateId) % templates.length]
}
