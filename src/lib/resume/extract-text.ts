import 'server-only'
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'

export interface ExtractResult {
  text: string | null
  error: string | null
}

export async function extractResumeText(file: File, fileType: 'pdf' | 'docx'): Promise<ExtractResult> {
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    if (fileType === 'pdf') {
      // unpdf ships a serverless-optimized PDF.js build with no DOM/canvas
      // dependencies — pdf-parse (via pdfjs-dist's full build) throws
      // "DOMMatrix is not defined" in Vercel's Node.js serverless runtime,
      // even though it works fine locally via `next start` or plain tsx.
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await extractPdfText(pdf, { mergePages: true })
      return { text, error: null }
    }

    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value, error: null }
  } catch (error) {
    return {
      text: null,
      error: error instanceof Error ? error.message : 'Failed to extract text from the file.',
    }
  }
}
