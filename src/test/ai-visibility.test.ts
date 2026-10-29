import { describe, expect, it } from 'vitest'
import { matchAiCrawler } from '@/lib/http/ai-crawlers'
import { classifyTrafficSource, trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'

describe('matchAiCrawler', () => {
  it('names the OpenAI, Anthropic and Perplexity fetchers', () => {
    expect(matchAiCrawler('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot')?.bot).toBe('GPTBot')
    expect(matchAiCrawler('Mozilla/5.0 ... ChatGPT-User/1.0')?.purpose).toBe('USER_FETCH')
    expect(matchAiCrawler('Claude-SearchBot/1.0')?.vendor).toBe('Anthropic')
    expect(matchAiCrawler('PerplexityBot/1.0')?.purpose).toBe('SEARCH')
  })
  it('ignores ordinary browsers and empty agents', () => {
    expect(matchAiCrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBeNull()
    expect(matchAiCrawler(null)).toBeNull()
  })
})

describe('AI assistant traffic sources', () => {
  it('groups Grok, Meta AI and Mistral with the other assistants', () => {
    for (const [referrer, label] of [['https://grok.com/', 'Grok'], ['https://www.meta.ai/', 'Meta AI'], ['https://chat.mistral.ai/chat', 'Mistral']] as const) {
      expect(classifyTrafficSource('/jobs', referrer)).toBe(label)
      expect(trafficSourceGroup(label)).toBe('AI assistants')
    }
  })
  it('reads the tag ChatGPT adds to cited links', () => {
    expect(classifyTrafficSource('/jobs/abc?utm_source=chatgpt.com', null)).toBe('ChatGPT')
  })
})
