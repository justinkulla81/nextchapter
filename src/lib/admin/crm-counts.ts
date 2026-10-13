import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// Counts the admin layout badges and the CRM People page both show. React
// cache() dedupes them within one request, so the layout and the page issue
// each count once instead of twice.
export const countPeopleNeedingCompletion = cache(() =>
  prisma.crmPerson.count({ where: { needsCompletion: true, deletedAt: null } }),
)

export const countRemovedPeople = cache(() => prisma.crmPerson.count({ where: { deletedAt: { not: null } } }))
