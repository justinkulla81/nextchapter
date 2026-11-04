// What the page's one ask says when it is a network join, per kind of network. Pure, so the box, its preview and the tests share it.

export type NetworkKind = 'role' | 'function' | 'industry'

export interface NetworkCopy {
  headline: string
  /** One sentence: who the network is for and what a member gets. */
  sentence: string
}

/** `name` is the short form ("CRO", "Sales", "Health care"); `spelled` is the role spelled out and is ignored for functions and industries. */
export function networkCopy(kind: NetworkKind, name: string, spelled: string): NetworkCopy {
  if (kind === 'role') {
    return {
      headline: `Job hunting as a ${name}? Do not do it alone.`,
      sentence: `The ${name} network is for people in ${spelled} roles who are thinking about their next step: a weekly email with the ${spelled} openings and what they pay, what other members post, and a peer group in the same role.`,
    }
  }
  return {
    headline: `Job hunting in ${name}? Do not do it alone.`,
    sentence: `The ${name} network is for people working in ${name} who are thinking about their next step: a weekly email with the ${name} openings and what they pay, what other members post, and a peer group in the same ${kind === 'industry' ? 'industry' : 'function'}.`,
  }
}

export interface NetworkAsk {
  /** `<kind>:<slug>`, as networkInfo reads it. */
  key: string
  kind: NetworkKind
  name: string
  spelled: string
}
