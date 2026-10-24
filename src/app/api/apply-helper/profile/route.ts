import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { candidateFromAuthHeader } from '@/lib/apply-helper/token'

export async function GET(req: NextRequest) {
  const candidateId = candidateFromAuthHeader(req.headers.get('authorization'))
  if (!candidateId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const p = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { userId: true, firstName: true, lastName: true, phone: true, email: true, currentCity: true, currentState: true },
  })
  if (!p) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [work, resume] = await Promise.all([
    prisma.workHistoryEntry.findFirst({ where: { candidateId }, orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }], select: { companyName: true, roleTitle: true } }),
    prisma.resume.findFirst({ where: { candidateId, looksLikeResume: { not: false } }, orderBy: { uploadedAt: 'desc' }, select: { id: true } }),
  ])
  let email = p.email
  if (!email) {
    const { data } = await createAdminClient().auth.admin.getUserById(p.userId)
    email = data.user?.email ?? null
  }
  return NextResponse.json({
    firstName: p.firstName,
    lastName: p.lastName,
    email,
    phone: p.phone,
    location: [p.currentCity, p.currentState].filter(Boolean).join(', ') || null,
    currentCompany: work?.companyName ?? null,
    currentTitle: work?.roleTitle ?? null,
    hasResume: !!resume,
  })
}
