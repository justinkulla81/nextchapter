// Infers the job functions a conference serves from the roles it is tagged for, when no function is tagged.
// About 1,480 catalog events have roles but no function. Rule-based (no model): each function has a role pattern, the
// functions matched by the most roles win, and at most two are kept. Checked against events tagged by hand it agrees
// with their tags about 60 percent of the time, so inferred functions place a conference on function pages and are
// never shown as the organizer's own tags. Pure.

const RULES: [string, RegExp][] = [
  ['Finance', /\b(cfo|controller|treasur\w*|accountant|auditor|fp&a|finance|financial|actuar\w*|cpa|tax|bookkeep\w*|lender|banker|bank executive|credit)\b/i],
  ['Engineering', /\b(engineer\w*|developer|devops|sre|architect|software|embedded|robotics|mechanic\w*|chemist|technician)\b/i],
  ['Data & Analytics', /\b(data|analytics|analyst|machine learning|bi developer|statistic\w*)\b/i],
  ['Security', /\b(security|ciso|cyber\w*|threat|grc|fraud)\b/i],
  ['Legal', /\b(counsel|attorney|lawyer|paralegal|legal|compliance|privacy|ethics|judge|regulatory)\b/i],
  ['Marketing', /\b(marketing|brand|communications?|pr|advertis\w*|content|growth|public relations|media buyer)\b/i],
  ['Sales', /\b(sales|account executive|business development|revenue|dealer|producer|agent|broker)\b/i],
  ['Customer Success', /\b(customer success|customer service|customer support|member services|support specialist)\b/i],
  ['Human Resources', /\b(hr|human resources|talent|recruit\w*|benefits|compensation|people|learning and development|training|organizational development)\b/i],
  ['Product', /\b(product manager|product management|product owner|product operations|product lead|chief product)\b/i],
  ['Design', /\b(designer|ux|design systems|creative director|architectural designer)\b/i],
  ['Operations', /\b(operations?|supply chain|logistics|facilities|procurement|purchasing|project manager|program manager|pmo|plant manager|fleet|warehouse|production|quality|lean)\b/i],
  ['Executive Leadership', /\b(ceo|coo|cxo|chief|president|executive director|founder|superintendent|general manager|board member|trustee)\b/i],
  ['Clinical', /\b(physician|nurse|nursing|clinical|pharmac\w*|therapist|medical director|dentist|practice manager|healthcare administrator|surgeon)\b/i],
  ['Strategy', /\b(strategy|strategist|strategic|corporate development|m&a|consultant|advisor)\b/i],
  ['Investment', /\b(investor|portfolio|trader|venture|private equity|investment|deal professional|fund)\b/i],
  ['Research', /\b(researcher|scientist|research)\b/i],
  ['Academic', /\b(professor|faculty|dean|provost|department chair|academic|registrar|enrollment|teacher|instructor|librarian|principal|superintendent)\b/i],
  ['Fundraising & development', /\b(fundrais\w*|development director|donor|philanthrop\w*|grant\w*|advancement)\b/i],
  ['Programs', /\b(program director|program officer|case manager|nonprofit|community|outreach|social worker)\b/i],
  ['Administration', /\b(administrator|executive assistant|office manager|administrative|secretary|clerk|registrar)\b/i],
]

export const MAX_INFERRED_FUNCTIONS = 2

export function inferFunctions(roles: readonly string[]): string[] {
  const scored: [number, string][] = []
  for (const [fn, re] of RULES) {
    const n = roles.filter((r) => re.test(r)).length
    if (n > 0) scored.push([n, fn])
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, MAX_INFERRED_FUNCTIONS).map(([, fn]) => fn)
}

/** The functions to place a conference under: its own tags, else those inferred from its roles. */
export function effectiveFunctions(c: { functions: readonly string[]; roles: readonly string[] }): string[] {
  return c.functions.length > 0 ? [...c.functions] : inferFunctions(c.roles)
}
