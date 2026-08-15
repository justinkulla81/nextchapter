import type { Document as DocxDocument } from 'docx'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ResumeDocumentData } from '../document-data'
import type { AccentColorChoice, ResumeTemplateStyleTokens } from '../style-tokens'
import { buildClassicDocx, ClassicPdfDocument } from './classic'
import { classicTokens } from './classic-tokens'
import { buildModernDocx, ModernPdfDocument } from './modern'
import { modernTokens } from './modern-tokens'
import { buildMinimalDocx, MinimalPdfDocument } from './minimal'
import { minimalTokens } from './minimal-tokens'

export interface ResumeTemplateDefinition {
  tokens: ResumeTemplateStyleTokens
  buildDocx: (data: ResumeDocumentData, accentColor?: AccentColorChoice) => DocxDocument
  buildPdfDocument: (data: ResumeDocumentData, accentColor?: AccentColorChoice) => ReactElement<DocumentProps>
}

export const RESUME_TEMPLATES: Record<string, ResumeTemplateDefinition> = {
  classic: { tokens: classicTokens, buildDocx: buildClassicDocx, buildPdfDocument: ClassicPdfDocument },
  modern: { tokens: modernTokens, buildDocx: buildModernDocx, buildPdfDocument: ModernPdfDocument },
  minimal: { tokens: minimalTokens, buildDocx: buildMinimalDocx, buildPdfDocument: MinimalPdfDocument },
}

export type ResumeTemplateId = keyof typeof RESUME_TEMPLATES

export function isResumeTemplateId(value: string): value is ResumeTemplateId {
  return value in RESUME_TEMPLATES
}
