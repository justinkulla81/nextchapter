import { isInWorkMember } from '@/lib/in-work/constants'

// "A hard situation at work" is for members who currently have a job. It uses the same check as the in-work
// workspace, so the two always agree on who is employed. Every question and reply is shown to people at other
// companies, so each member in it needs a current employer.
export const canUseWorkHelp = isInWorkMember
