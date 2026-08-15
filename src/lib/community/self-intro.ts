import { generateCommunityHandle } from '@/lib/community/identity'

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
  confidentialSearchMode: boolean
}

export function buildSelfIntroDraft({
  candidateId,
  firstName,
  primaryFunction,
  targetRoleType,
  currentCity,
  confidentialSearchMode,
}: SelfIntroInput): string {
  const background = primaryFunction || 'my field'
  const target = targetRoleType || 'my next role'

  // §4.2 — a Confidential Search Mode candidate posts under a generated
  // handle with no employer/title/location. The default draft used to bake
  // the real firstName and currentCity straight into freeform text, which
  // defeated that even though every structural field (postCity, etc.) was
  // already stripped — this is the fix. It's still just a starting point
  // the candidate can edit before posting, same as before.
  if (confidentialSearchMode) {
    const handle = generateCommunityHandle(candidateId)
    const confidentialTemplates = [
      `Hi, I go by ${handle} here. I've been in ${background}, exploring what's next. Happy to be helpful if I can be.`,
      `${handle} here. Background's in ${background}. Always glad to lend a hand if I can.`,
      `I'm posting here as ${handle}. Spent my career in ${background}. If I can help someone else here, just ask.`,
      `${handle} here, background in ${background}. Reach out if there's ever something I can help with.`,
    ]
    return confidentialTemplates[hashSeed(candidateId) % confidentialTemplates.length]
  }

  const name = firstName || 'there'
  const location = currentCity ? ` in ${currentCity}` : ''

  const templates = [
    `Hi, I'm ${name}. I've been in ${background}, and I'm looking for a ${target} role${location}. Happy to be helpful if I can be.`,
    `Hey — ${name} here. My background's in ${background}, targeting ${target} work${location}. Always glad to lend a hand if I can.`,
    `I'm ${name}. Spent my career in ${background}, now searching for a ${target} role${location}. If I can help someone else here, just ask.`,
    `${name} here, background in ${background}. Looking for my next ${target} role${location} — reach out if there's ever something I can help with.`,
  ]

  return templates[hashSeed(candidateId) % templates.length]
}
