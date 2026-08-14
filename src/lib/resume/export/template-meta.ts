// Client-safe template metadata for the export picker UI. Deliberately
// does NOT import ./templates/index.ts (or any of the individual template
// files' build functions) — those pull in `docx` and
// `@react-pdf/renderer`, which are Node-oriented document-generation
// libraries with no business being in a browser bundle. This file only
// re-exports the plain-data style tokens, which is all the picker UI
// needs (id, name, description, default accent color).
import { classicTokens } from './templates/classic-tokens'
import { modernTokens } from './templates/modern-tokens'
import { minimalTokens } from './templates/minimal-tokens'
import { ACCENT_COLOR_OPTIONS } from './style-tokens'

export const RESUME_TEMPLATE_META = [classicTokens, modernTokens, minimalTokens]
export { ACCENT_COLOR_OPTIONS }
