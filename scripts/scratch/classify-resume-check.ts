import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const prisma = new PrismaClient()
const client = new Anthropic()

const classificationSchema = z.object({
  isResume: z.boolean(),
  reason: z.string().nullable(),
})

const CLASSIFICATION_PROMPT = `Is this document actually a resume/CV — something describing a person's work history, education, and skills for job-seeking purposes?

Answer isResume: true for anything that is genuinely a resume, even if it's short, unusually formatted, a student/entry-level resume with little experience, or missing a few common sections. Be lenient — only answer false when the document is clearly NOT a resume at all: a cover letter, a blank or near-blank page, an unrelated document (invoice, article, random file), or gibberish/corrupted text.

If isResume is false, set reason to one short, plain sentence describing what the document actually looks like instead (e.g. "This looks like a cover letter, not a resume." or "This document doesn't contain any work history or education."), written for the person who uploaded it. If isResume is true, reason must be null.

Document text:
`

async function classify(text: string) {
  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    thinking: { type: 'disabled' },
    output_config: { format: zodOutputFormat(classificationSchema) },
    messages: [{ role: 'user', content: CLASSIFICATION_PROMPT + text }],
  })
  const message = await stream.finalMessage()
  return message.parsed_output
}

async function main() {
  const real = await prisma.resume.findFirst({
    where: { extractedText: { not: null } },
    orderBy: { uploadedAt: 'desc' },
    select: { extractedText: true, fileName: true },
  })
  if (real?.extractedText) {
    console.log('REAL RESUME:', real.fileName, '->', await classify(real.extractedText))
  }

  const coverLetter = `Dear Hiring Manager,\n\nI am writing to express my strong interest in the Marketing Director position at your company. With over ten years of experience in brand strategy, I believe I would be a great fit for your team.\n\nThroughout my career I have consistently delivered results and built strong relationships with stakeholders. I am excited about the opportunity to bring my skills to your organization.\n\nThank you for considering my application. I look forward to hearing from you.\n\nSincerely,\nJordan Smith`
  console.log('COVER LETTER ->', await classify(coverLetter))

  const blank = 'asdkjaslkdj  \n\n   '
  console.log('BLANK/GIBBERISH ->', await classify(blank))

  const sparseResume = `Jamie Lee\njamie.lee@email.com | (555) 012-3456\n\nEXPERIENCE\nBarista, Blue Bottle Coffee, 2023-Present\n- Made coffee, handled cash register\n\nEDUCATION\nHigh School Diploma, Lincoln High School, 2022`
  console.log('SPARSE ENTRY-LEVEL RESUME ->', await classify(sparseResume))
}

main().finally(() => prisma.$disconnect())
