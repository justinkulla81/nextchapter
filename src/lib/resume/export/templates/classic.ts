import type { Document as DocxDocument } from 'docx'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice } from '../style-tokens'
import { classicTokens } from './classic-tokens'
import { buildResumeDocx } from './docx-render'
import { buildResumePdfDocument } from './pdf-render'

export { classicTokens }

export function buildClassicDocx(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined): DocxDocument {
  return buildResumeDocx(data, classicTokens, accentColor)
}

export function ClassicPdfDocument(data: ResumeDocumentData, accentColor: AccentColorChoice = undefined) {
  return buildResumePdfDocument(data, classicTokens, accentColor)
}
