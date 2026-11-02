import 'server-only'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'

export { PUBLIC_JOB_LIST_SELECT, PUBLIC_JOB_SELECT, withDescriptionStubs } from '@/lib/jobs/public-job-page-server'

export const getConfirmedGhostIdsForPage = getConfirmedGhostIds
