// Fictional people and companies for demos. Nothing here is a real person.
export const FIRST_NAMES = ['Avery', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Rowan', 'Harper', 'Emerson', 'Finley', 'Sawyer', 'Reese', 'Dakota', 'Hayden', 'Parker', 'Logan', 'Elliot', 'Blair', 'Cameron', 'Drew', 'Priya', 'Marcus', 'Dana', 'Tom', 'Lena', 'Omar', 'Sofia', 'Ben'] as const
export const LAST_NAMES = ['Abernathy', 'Bellweather', 'Castellano', 'Drummond', 'Ellsworth', 'Fairbanks', 'Galloway', 'Hollister', 'Iverson', 'Kincaid', 'Lockhart', 'Merriweather', 'Northcott', 'Oakridge', 'Pemberton', 'Quillfeather', 'Ravensworth', 'Sterling', 'Thistlewood', 'Underhill', 'Nair', 'Bell', 'Whitfield', 'Alvarez'] as const
export const TITLES = ['Director of Operations', 'Senior Analyst', 'VP Finance', 'Product Manager', 'Plant Manager', 'Account Executive', 'Nurse Manager', 'Software Engineer', 'Controller', 'Marketing Manager', 'HR Business Partner', 'Head of Delivery'] as const
export const FUNCTIONS = ['Operations', 'Finance', 'Product', 'Sales', 'Marketing', 'Engineering', 'People', 'Healthcare'] as const
export const LEVELS = ['IC', 'Manager', 'Director', 'VP', 'C-Suite'] as const
export const COMPANIES = ['Northwind Industries', 'Harbor Health', 'Lattice Labs', 'Beacon Analytics', 'Summit Logistics', 'Meridian Foods', 'Copperline Energy', 'Bluefin Software'] as const
export const ROLE_TITLES = ['Head of Delivery', 'VP Operations', 'Director of Finance', 'Senior Product Manager', 'Plant Manager', 'Controller', 'Chief of Staff', 'Director of People', 'Account Director', 'Engineering Manager'] as const
export const CITIES: ReadonlyArray<readonly [string, string]> = [['Pittsburgh', 'PA'], ['Philadelphia', 'PA'], ['Columbus', 'OH'], ['Louisville', 'KY'], ['Charlotte', 'NC'], ['Austin', 'TX']]

export function demoEmail(orgSlug: string, kind: string): string {
  return `demo+${orgSlug}-${kind}@nextchapter.test`
}

/** Prefix for the sample candidates' userId, so reset and delete can find exactly them. */
export function sampleCandidatePrefix(orgSlug: string): string {
  return `demo-org-${orgSlug}-`
}
