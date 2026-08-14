import { NextResponse, type NextRequest } from 'next/server'
import { Packer } from 'docx'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { buildResumeDocumentData } from '@/lib/resume/export/document-data'
import { isResumeTemplateId, RESUME_TEMPLATES } from '@/lib/resume/export/templates'
import { captureServerEvent } from '@/lib/posthog/server'

const CONTENT_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
} as const

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'resume'
}

// Generates a formatted resume (.docx or .pdf) from the candidate's real
// profile data and streams it back for download — Master Build Script
// §13.2. Both formats render from the exact same buildResumeDocumentData()
// object via the same template's two independent renderers; neither
// format is a conversion of the other.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const templateId = typeof body?.templateId === 'string' ? body.templateId : null
  const format: 'docx' | 'pdf' | null =
    body?.format === 'docx' ? 'docx' : body?.format === 'pdf' ? 'pdf' : null
  // null means "no accent" (explicit candidate choice); omitting the key
  // entirely means "use the template's default" — undefined vs null both
  // need to survive the JSON round-trip, so we check `in` rather than a
  // falsy check.
  const accentColor: string | null | undefined =
    body && 'accentColor' in body ? (typeof body.accentColor === 'string' ? body.accentColor : null) : undefined

  if (!templateId || !isResumeTemplateId(templateId)) {
    return NextResponse.json({ error: 'Unknown resume template.' }, { status: 400 })
  }
  if (!format) {
    return NextResponse.json({ error: 'Format must be "docx" or "pdf".' }, { status: 400 })
  }

  const profile = await getOrCreateCandidateProfile(user.id)
  const data = await buildResumeDocumentData(profile.id)
  const template = RESUME_TEMPLATES[templateId]

  const fileBaseName = `${slugify(data.name)}-resume-${templateId}`

  let fileBuffer: Buffer
  if (format === 'docx') {
    const document = template.buildDocx(data, accentColor)
    fileBuffer = await Packer.toBuffer(document)
  } else {
    const pdfDocument = template.buildPdfDocument(data, accentColor)
    fileBuffer = await renderToBuffer(pdfDocument)
  }

  captureServerEvent(profile.id, 'resume_exported', { candidateId: profile.id, templateId, format })

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="${fileBaseName}.${format}"`,
    },
  })
}
