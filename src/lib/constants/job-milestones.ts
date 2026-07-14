export const INTERVIEW_LANDED_POINTS_PER_JOB = 10
export const INTERVIEW_LANDED_CAP = 20

export const OFFER_RECEIVED_POINTS_PER_JOB = 15
export const OFFER_RECEIVED_CAP = 30

export const APPLIED_POINTS_PER_JOB = 1
export const APPLIED_CAP = 5

// Once a posting has landed an interview or offer it's a "won" historical
// record and no longer occupies one of the active fit-check slots — a real
// job search involves applying to far more than 5 jobs over time.
export const MAX_ACTIVE_FIT_CHECK_SLOTS = 5
