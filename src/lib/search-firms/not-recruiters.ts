// Crawler sources that are an employer's own careers page, not a recruiting firm: the crawler's firm list names them, but
// their postings are one organization's own roles (Keystone Automotive Operations' sales jobs, a New York non-profit's
// after-school and social-work jobs). They are left out of the directory, the role pages and the member recommendations.
// Add a source id here only after reading its postings; the sync keeps updating the row, so this list is what makes it stick.
export const NOT_RECRUITER_SOURCES: readonly string[] = ['sf:keystonerecruiting', 'sf:partnershipwithchildren']

export const isNotRecruiterSource = (sourceKey: string | null | undefined): boolean => !!sourceKey && NOT_RECRUITER_SOURCES.includes(sourceKey)

// Organizations with no crawled row that the company-industry field still files under "Staffing & Human Capital", and so lists as a
// firm: a payroll and HR software company is not one. By canonicalNameNormalized (the stored, lower-cased name). Only the ones the
// owner named; the rest of that group is left alone, since many are real staffing companies.
export const NOT_RECRUITER_ORGS: readonly string[] = ['justworks']

export const isNotRecruiterOrg = (canonicalName: string | null | undefined): boolean => !!canonicalName && NOT_RECRUITER_ORGS.includes(canonicalName)
