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

export function getOutreachScript(warmth: ContactWarmth, anxiety: NetworkingAnxiety | null, ctx: ScriptContext): string {
  const tier = anxiety ? ANXIETY_TIER_FOR[anxiety] : 'MEDIUM'
  return fill(TEMPLATES[warmth][tier], ctx)
}
