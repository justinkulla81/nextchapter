import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

/** Log prompt-cache usage for a call so cache hit rate is visible in runtime logs. */
export function logCacheUsage(label: string, usage: Anthropic.Usage): void {
  console.log(
    `[anthropic-cache] ${label} read=${usage.cache_read_input_tokens ?? 0} write=${usage.cache_creation_input_tokens ?? 0} uncached=${usage.input_tokens}`,
  )
}
