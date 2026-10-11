// Invites a college staff member to its NextChapter workspace (emails them a magic link).
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/invite-institution-user.ts <institution-slug> <email> <ROLE> ["Full Name"]
// ROLE: INSTITUTION_ADMIN | CAREER_SERVICES | EMPLOYER_RELATIONS | ALUMNI_RELATIONS | DEVELOPMENT | VIEWER
import { prisma } from '../src/lib/prisma'
import { inviteInstitutionUser } from '../src/lib/institution/invite'
import type { InstitutionUserRole } from '@prisma/client'

const [slug, email, role, fullName] = process.argv.slice(2)
if (!slug || !email || !role) throw new Error('usage: invite-institution-user.ts <slug> <email> <ROLE> ["Full Name"]')

inviteInstitutionUser({ institutionSlug: slug, email, role: role as InstitutionUserRole, fullName })
  .then((r) => console.log(r.error ? `error: ${r.error}` : `invited ${email}`))
  .finally(() => prisma.$disconnect())
