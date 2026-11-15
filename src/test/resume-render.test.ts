// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Packer } from 'docx'
import mammoth from 'mammoth'
import { renderToBuffer } from '@react-pdf/renderer'
import { extractText, getDocumentProxy } from 'unpdf'
import { RESUME_TEMPLATES } from '@/lib/resume/export/templates'
import { compareTexts } from '@/lib/resume/studio/fidelity'
import { parseResumeDocument } from '@/lib/resume/studio/document'
import { sampleDocument } from './fixtures/resume-sample-document'

const source = readFileSync(join(__dirname, 'fixtures/resume-executive-sample.txt'), 'utf8')

// What an applicant tracking system does: read the text back out of the file. Every word, figure and date of the
// upload must still be there after the resume has been through a template, in both formats, for every template.
describe.each(Object.keys(RESUME_TEMPLATES))('template %s', (id) => {
  const parsed = parseResumeDocument(sampleDocument())
  if (!parsed.ok) throw new Error(parsed.error)
  const template = RESUME_TEMPLATES[id]

  it('reads back from the PDF with nothing lost', async () => {
    const buffer = await renderToBuffer(template.buildPdfDocument(parsed.data))
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    const r = compareTexts(source, text)
    expect(r.missing).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('reads back from the Word file with nothing lost', async () => {
    const buffer = await Packer.toBuffer(template.buildDocx(parsed.data))
    const { value } = await mammoth.extractRawText({ buffer })
    const r = compareTexts(source, value)
    expect(r.missing).toEqual([])
    expect(r.ok).toBe(true)
  })
})
