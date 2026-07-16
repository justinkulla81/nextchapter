import type { ContactWarmth, NetworkingAnxiety } from '@prisma/client'

// Templated, not LLM-generated — deterministic and free, same pattern as
// the existing single help-script template. 3 warmth levels x 3 anxiety
// tiers = 9 variants. The 5 onboarding-style anxiety answers collapse to 3
// tiers here (the spec calls for "3 anxiety" variants, not 5).
export type AnxietyTier = 'LOW' | 'MEDIUM' | 'HIGH'

export const ANXIETY_TIER_FOR: Record<NetworkingAnxiety, AnxietyTier> = {
  NOT_SURE_WHAT_TO_SAY: 'LOW',
  BURDEN_PEOPLE: 'MEDIUM',
  NETWORK_NOT_STRONG: 'MEDIUM',
  DONT_LIKE_ASKING_FOR_HELP: 'MEDIUM',
  ALREADY_USED_UP_NETWORK: 'HIGH',
  SEEM_DESPERATE: 'HIGH',
  OTHER: 'HIGH',
}

export interface ScriptContext {
  contactName: string
  candidateFirstName: string | null
  targetRoleType: string | null
  knownFor: string | null
}

function fill(template: string, ctx: ScriptContext): string {
  return template
    .replace(/\{contactName\}/g, ctx.contactName)
    .replace(/\{firstName\}/g, ctx.candidateFirstName || 'there')
    .replace(/\{targetRole\}/g, ctx.targetRoleType || 'a new role')
    .replace(/\{knownFor\}/g, ctx.knownFor || "what I've been working on")
}

const TEMPLATES: Record<ContactWarmth, Record<AnxietyTier, string>> = {
  HOT: {
    LOW: `Hey {contactName} — quick one. I'm actively looking for {targetRole} roles right now. Any chance you know of something, or someone worth talking to? No pressure either way — just figured I'd ask since we go back.`,
    MEDIUM: `Hi {contactName}, hope you're doing well. I wanted to reach out because I'm in the middle of a search for {targetRole} roles, and you're one of the first people I thought of. If anything comes to mind — a role, a person, anything — I'd genuinely appreciate it. And if not, no worries at all, just wanted to say hi too.`,
    HIGH: `Hi {contactName} — it's been a bit! I've been meaning to reach out. I'm currently exploring {targetRole} opportunities and would love to catch up sometime, even just for 15 minutes. If anything comes up on your end that seems relevant, I'd love to hear about it — but mostly I just wanted to reconnect.`,
  },
  WARM: {
    LOW: `Hi {contactName}, it's {firstName}. I'm currently looking for {targetRole} roles and thought of you given your background. Would you have a few minutes sometime to swap notes, or know anyone I should talk to?`,
    MEDIUM: `Hi {contactName}, this is {firstName} — we've connected before around {knownFor}. I'm currently in a job search focused on {targetRole} roles, and I wanted to reach out in case you had any thoughts, leads, or people worth connecting with. Totally understand if now isn't a good time — appreciate you either way.`,
    HIGH: `Hi {contactName}, {firstName} here. I hope this isn't out of the blue — I'm currently searching for {targetRole} roles and remembered our past connection around {knownFor}. If you happen to know of anything or anyone worth a conversation, I'd really appreciate it. No pressure at all if not — just wanted to reach out.`,
  },
  COLD: {
    LOW: `Hi {contactName}, I'm {firstName}, currently searching for {targetRole} roles. I came across your background and thought it was worth reaching out directly — would you be open to a brief conversation, or have any pointers?`,
    MEDIUM: `Hi {contactName}, my name is {firstName}. I'm reaching out because I'm searching for {targetRole} roles and your experience stood out to me. I know this is a cold message, so no worries if you're not able to respond — but if you have 10-15 minutes sometime, I'd value hearing your perspective.`,
    HIGH: `Hi {contactName}, my name is {firstName} — we haven't connected before, so I want to be upfront: I'm reaching out because I'm searching for {targetRole} roles and admire your path. I know unsolicited messages aren't always welcome, so please feel free to ignore this if it's not a good fit. If you are open to a short conversation, I'd be grateful.`,
  },
}

// The highest anxiety tier among a candidate's selected concerns — a
// candidate with any HIGH-tier concern gets the more careful framing, even
// if they also selected lower-tier ones.
export function highestAnxietyTier(concerns: NetworkingAnxiety[]): AnxietyTier {
  const tiers = concerns.map((c) => ANXIETY_TIER_FOR[c])
  if (tiers.includes('HIGH')) return 'HIGH'
  if (tiers.includes('MEDIUM')) return 'MEDIUM'
  if (tiers.includes('LOW')) return 'LOW'
  return 'MEDIUM'
}

export function getOutreachScript(warmth: ContactWarmth, concerns: NetworkingAnxiety[], ctx: ScriptContext): string {
  const tier = highestAnxietyTier(concerns)
  return fill(TEMPLATES[warmth][tier], ctx)
}

const TIMING_BY_METHOD: Record<string, string> = {
  'In-person': 'Coffee or lunch, Tuesday–Thursday — avoids Monday catch-up chaos and Friday wind-down.',
  Zoom: "Late morning (10–11am) on a Tuesday–Thursday — people are focused but not yet in their post-lunch slump.",
  Phone: 'Early afternoon (1–3pm) on a weekday — past the morning inbox rush, before people start winding down.',
  Email: "Tuesday–Thursday morning — Monday inboxes are flooded, and it'll get buried if sent Friday afternoon.",
  Text: 'Weekday between 9am–6pm — treat it like a work-hours channel, not an anytime one.',
}

export interface OutreachPlan {
  timing: string
  agenda: string[]
}

// Templated, not LLM-generated — same reasoning as the message scripts
// above (deterministic, free, and this doesn't need generation quality to
// be useful). Combines the candidate's stated contact preference with their
// highest anxiety tier to produce a concrete day/time + a 3-part talking
// point structure for the actual conversation, not just the opening message.
export function getOutreachPlan(concerns: NetworkingAnxiety[], connectPreferences: string[]): OutreachPlan {
  const preferredMethod = connectPreferences[0]
  const timing = preferredMethod && TIMING_BY_METHOD[preferredMethod]
    ? TIMING_BY_METHOD[preferredMethod]
    : 'Tuesday–Thursday, mid-morning or early afternoon — avoids Monday catch-up and Friday wind-down for most people.'

  const tier = highestAnxietyTier(concerns)
  const agenda =
    tier === 'HIGH'
      ? [
          'Open by reconnecting, not asking — mention something specific and genuine before anything else.',
          "Name what you're looking for in one sentence, framed as sharing information rather than a favor.",
          "Close with a low-pressure ask: 'no worries either way' — and mean it.",
        ]
      : tier === 'MEDIUM'
        ? [
            'Open with the specific reason you thought of them.',
            "State your target clearly: what role, what you're looking for.",
            'Ask directly for one thing — an intro, a lead, or 15 minutes — and thank them either way.',
          ]
        : [
            'Lead with your ask — you already know each other, no need to over-soften it.',
            "Be specific about the target role so they can actually think of someone.",
            'End with a concrete next step: a time to talk, or a name to follow up with.',
          ]

  return { timing, agenda }
}
