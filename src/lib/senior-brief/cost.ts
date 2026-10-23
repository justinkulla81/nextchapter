// Claude Haiku 4.5 list price, dollars per million tokens. Update here if the model or the price changes.
export const DRAFT_MODEL = 'claude-haiku-4-5-20251001'
const INPUT_PER_MTOK = 1
const OUTPUT_PER_MTOK = 5

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_PER_MTOK + outputTokens * OUTPUT_PER_MTOK) / 1_000_000
}
