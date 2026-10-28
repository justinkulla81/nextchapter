import 'server-only'
import { getAnthropicClient } from '@/lib/anthropic'

// One question to one assistant with web search switched on, reduced to what matters: which sources it cited and what it
// said. Each adapter returns null when its API key is missing, so a provider switches on the day its key is added.
export type ProviderAnswer = { text: string; sources: string[] }
export type Provider = {
  id: 'claude' | 'perplexity' | 'openai' | 'gemini'
  /** Conservative per-question cost in USD (search fees dominate). Used for the monthly cap, not for billing. */
  estCostUsd: number
  enabled: () => boolean
  ask: (prompt: string) => Promise<ProviderAnswer>
}

const SYSTEM = 'Answer the question the way you would for a real person. Use web search. Name specific sites and tools.'

export const PROVIDERS: Provider[] = [
  {
    id: 'claude',
    estCostUsd: 0.03,
    enabled: () => !!process.env.ANTHROPIC_API_KEY,
    async ask(prompt) {
      const res = await getAnthropicClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: SYSTEM,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: prompt }],
      })
      const sources: string[] = []
      let text = ''
      for (const block of res.content as unknown as Record<string, unknown>[]) {
        if (block.type === 'text') {
          text += block.text as string
          for (const c of (block.citations as { url?: string }[] | undefined) ?? []) if (c.url) sources.push(c.url)
        } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content as { url?: string }[]) if (r.url) sources.push(r.url)
        }
      }
      return { text, sources }
    },
  },
  {
    id: 'perplexity',
    estCostUsd: 0.012,
    enabled: () => !!process.env.PERPLEXITY_API_KEY,
    async ask(prompt) {
      const r = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'sonar', messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], max_tokens: 700 }),
      })
      if (!r.ok) throw new Error(`perplexity ${r.status}`)
      const j = await r.json()
      const sources: string[] = [...(j.citations ?? []), ...(j.search_results ?? []).map((s: { url?: string }) => s.url).filter(Boolean)]
      return { text: j.choices?.[0]?.message?.content ?? '', sources }
    },
  },
  {
    id: 'openai',
    estCostUsd: 0.03,
    enabled: () => !!process.env.OPENAI_API_KEY,
    async ask(prompt) {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.AI_CITATION_OPENAI_MODEL || 'gpt-5-mini', tools: [{ type: 'web_search' }], instructions: SYSTEM, input: prompt, max_output_tokens: 900 }),
      })
      if (!r.ok) throw new Error(`openai ${r.status}`)
      const j = await r.json()
      const sources: string[] = []
      let text = ''
      for (const item of j.output ?? []) {
        if (item.type !== 'message') continue
        for (const part of item.content ?? []) {
          text += part.text ?? ''
          for (const a of part.annotations ?? []) if (a.url) sources.push(a.url)
        }
      }
      return { text, sources }
    },
  },
  {
    id: 'gemini',
    estCostUsd: 0.035,
    enabled: () => !!process.env.GEMINI_API_KEY,
    async ask(prompt) {
      const model = process.env.AI_CITATION_GEMINI_MODEL || 'gemini-2.5-flash'
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY as string, 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
      })
      if (!r.ok) throw new Error(`gemini ${r.status}`)
      const j = await r.json()
      const cand = j.candidates?.[0]
      const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
      // Gemini sources arrive as vertexaisearch redirect links; the readable domain is the chunk title.
      const sources: string[] = (cand?.groundingMetadata?.groundingChunks ?? []).map((c: { web?: { uri?: string; title?: string } }) => (c.web?.title && c.web.title.includes('.') ? `https://${c.web.title}` : c.web?.uri)).filter(Boolean)
      return { text, sources }
    },
  },
]
