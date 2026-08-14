import type { Document as DocxDocument } from 'docx'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice } from '../style-tokens'
import { minimalTokens } from './minimal-tokens'
import { buildResumeDocx } from './docx-render'
import { buildResumePdfDocument } from './pdf-render'

export { minimalTokens }

export function buildMinimalDocx(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined): DocxDocument {
  return buildResumeDocx(data, minimalTokens, accentColor)
}

export function MinimalPdfDocument(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined) {
  return buildResumePdfDocument(data, minimalTokens, accentColor)
}
