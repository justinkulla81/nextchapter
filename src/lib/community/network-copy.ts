// What a network block says, per kind of network. Pure, so the page block, its preview and the tests share it.

export type NetworkKind = 'role' | 'function' | 'industry'

export interface NetworkCopy {
  headline: string
  intro: string
  bullets: string[]
  /** "what is open for ..." in the joined state. */
  scope: string
}

/** `name` is the short form ("CRO", "Sales", "Health care"); `spelled` is the role spelled out and is ignored for functions and industries. */
export function networkCopy(kind: NetworkKind, name: string, spelled: string): NetworkCopy {
  if (kind === 'role') {
    return {
      headline: `Are you a ${name}? Join your peers.`,
      intro: `The ${name} network is for people in ${spelled} roles who are thinking about their next step. Members get:`,
      bullets: [
        `A weekly email with the ${spelled} openings and what they pay`,
        `What other members in ${spelled} roles are posting about their search`,
        'A peer group of people in the same role',
      ],
      scope: `${spelled} roles`,
    }
  }
  return {
    headline: `Work in ${name}? Join your peers.`,
    intro: `The ${name} network is for people working in ${name} who are thinking about their next step. Members get:`,
    bullets: [
      `A weekly email with the ${name} openings and what they pay`,
      `What other members in ${name} are posting about their search`,
      kind === 'industry' ? 'A peer group of people in the same industry' : 'A peer group of people in the same function',
    ],
    scope: `${name} roles`,
  }
}
