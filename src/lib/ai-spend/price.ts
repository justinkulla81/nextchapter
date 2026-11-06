// List prices in dollars per million tokens (Anthropic API, checked 2026-10-06). Update here when a model or its price changes.
// Used to put a dollar figure on a model call's reported token usage (model_call_cost events), so "what does a report cost us" is a query.
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

export interface ModelUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/** Dollars for one call, or null for a model with no listed price. Cache writes bill at 1.25x input and cache reads at 0.1x. */
export function estimateCallCostUsd(model: string, usage: ModelUsage): number | null {
  const price = PRICES[model]
  if (!price) return null
  const input = usage.input_tokens * price.input + (usage.cache_creation_input_tokens ?? 0) * price.input * 1.25 + (usage.cache_read_input_tokens ?? 0) * price.input * 0.1
  return (input + usage.output_tokens * price.output) / 1_000_000
}
