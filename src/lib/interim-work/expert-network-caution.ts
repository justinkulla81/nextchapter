// Prompt 68 section 3 calls for a caution note before Expert Networks when
// the candidate's "Coach Admin Sensitive Intake" (Prompt 57) flagged a legal
// restriction (e.g. a non-compete or NDA that would make paid expert-network
// consulting calls a real legal risk). That intake feature does not exist
// anywhere in this codebase — confirmed via grep, and consistent with an
// earlier-session finding recorded in PRODUCT_VISION_CANDIDATE.md. Rather
// than fabricate a data source, this returns false unconditionally so the
// caution note is structurally wired up but never fires until Prompt 57
// actually exists and a real field can replace this stub.
export function hasLegalRestrictionFlag(): boolean {
  return false
}
