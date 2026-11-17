import type { Prisma } from '@prisma/client'

/**
 * Uploads that count as a resume: classified as one, or not classified yet. Written as an explicit OR because
 * a Prisma `not: false` filter on this column becomes SQL `<> false`, which also drops the NULL (never classified)
 * rows: those people were told they had no resume and the studio hid "Import my resume" from them.
 */
export const RESUME_NOT_REJECTED = { OR: [{ looksLikeResume: null }, { looksLikeResume: true }] } satisfies Prisma.ResumeWhereInput
