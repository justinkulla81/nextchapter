import 'server-only'

/**
 * The value to write for `needsCompletion`, plus its paired timestamp.
 *
 * A human clearing needsCompletion is a decision worth dating — see
 * CrmPerson.completionClearedAt, used by the Ecosystem home page to count
 * "approved by review" separately from a fresh capture. `wasNeeded` is the
 * record's CURRENT value before this write, so the timestamp only moves
 * the first time it clears, not on every later edit to an already-complete
 * person.
 */
export function completionUpdate(clearing: boolean, wasNeeded: boolean) {
  return clearing
    ? { needsCompletion: false, ...(wasNeeded ? { completionClearedAt: new Date() } : {}) }
    : { needsCompletion: true }
}
