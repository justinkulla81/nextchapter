// Colleges and universities are not "companies" for the employer index, outlook or rankings: they have their own pages
// under /higher-education. Matched by name, because the industry label ("Education & EdTech") also holds edtech firms.
// A university's health system or medical center is an employer, so those stay.

const NAME = /\b(universit(?:y|ies)|college|community college|polytechnic)\b/i
const KEEP = /\b(hospitals?|health|medical|bank|credit union|insurance|press|bookstore|capital|partners|ventures|collegiate|college board)\b/i

export function isHigherEdName(name: string): boolean {
  return NAME.test(name) && !KEEP.test(name)
}

/** The same rule as `isHigherEdName`, as a SQL condition on a company-name expression. */
export function higherEdSql(nameExpr: string): string {
  return `(${nameExpr} ~* '\\m(universit(y|ies)|college|community college|polytechnic)\\M'
    AND ${nameExpr} !~* '\\m(hospitals?|health|medical|bank|credit union|insurance|press|bookstore|capital|partners|ventures|collegiate|college board)\\M')`
}
