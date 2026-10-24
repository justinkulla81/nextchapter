import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { candidateFromAuthHeader } from '@/lib/apply-helper/token'

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

// The member's newest résumé, for the extension to attach to the employer's form.
export async function GET(req: NextRequest) {
  const candidateId = candidateFromAuthHeader(req.headers.get('authorization'))
  if (!candidateId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const resume = await prisma.resume.findFirst({
    where: { candidateId, looksLikeResume: { not: false } },
    orderBy: { uploadedAt: 'desc' },
    select: { filePath: true, fileName: true, fileType: true },
  })
  if (!resume) return NextResponse.json({ error: 'no_resume' }, { status: 404 })
  const { data, error } = await createAdminClient().storage.from('resumes').download(resume.filePath)
  if (error || !data) return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      'Content-Type': TYPES[resume.fileType] ?? 'application/octet-stream',
      'X-File-Name': encodeURIComponent(resume.fileName),
      'Cache-Control': 'private, no-store',
    },
  })
}
