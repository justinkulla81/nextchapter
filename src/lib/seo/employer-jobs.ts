import 'server-only'
import { getConfirmedGhostIds } from '@/lib/jobs/job-dismiss-server'

export { PUBLIC_JOB_SELECT } from '@/lib/jobs/public-job-page-server'

export const getConfirmedGhostIdsForPage = getConfirmedGhostIds
