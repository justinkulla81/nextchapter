import type { Document as DocxDocument } from 'docx'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice } from '../style-tokens'
import { executiveTokens } from './executive-tokens'
import { buildResumeDocx } from './docx-render'
import { buildResumePdfDocument } from './pdf-render'

export { executiveTokens }

export function buildExecutiveDocx(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined): DocxDocument {
  return buildResumeDocx(data, executiveTokens, accentColor)
}

export function ExecutivePdfDocument(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined) {
  return buildResumePdfDocument(data, executiveTokens, accentColor)
}
