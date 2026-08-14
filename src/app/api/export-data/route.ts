import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'

// GDPR/CCPA data-portability: lets a candidate download everything we hold
// on them as a single JSON file, on demand, without asking us for it.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getOrCreateCandidateProfile(user.id)

  const data = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      workHistory: true,
      references: true,
      workSamples: true,
      interviewResponses: true,
      assessmentResponses: true,
      resumes: true,
      jobPostings: true,
      communityPosts: true,
      marketRealityReports: true,
      linkedInActivityLogs: true,
      dailyCheckIns: true,
      weeklySprints: true,
      sundayNightReports: true,
      supportNetworkContacts: true,
      outreachLogs: true,
      coachConversation: { include: { messages: true } },
    },
  })

  const exportedAt = new Date().toISOString()

  return new NextResponse(JSON.stringify({ exportedAt, email: user.email, data }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nextchapter-data-export-${exportedAt.slice(0, 10)}.json"`,
    },
  })
}
