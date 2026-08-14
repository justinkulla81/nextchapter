import type { Document as DocxDocument } from 'docx'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice } from '../style-tokens'
import { modernTokens } from './modern-tokens'
import { buildResumeDocx } from './docx-render'
import { buildResumePdfDocument } from './pdf-render'

export { modernTokens }

export function buildModernDocx(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined): DocxDocument {
  return buildResumeDocx(data, modernTokens, accentColor)
}

export function ModernPdfDocument(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined) {
  return buildResumePdfDocument(data, modernTokens, accentColor)
}
