import {
  matchByFunction,
  SALES_KEYWORDS,
  DESIGN_KEYWORDS,
  CUSTOMER_SUCCESS_KEYWORDS,
  DATA_ANALYTICS_KEYWORDS,
  EXECUTIVE_LEADERSHIP_KEYWORDS,
  ADMINISTRATION_KEYWORDS,
} from '@/lib/constants/match-by-function'

export interface AiToolRecommendation {
  name: string
  description: string
  url: string
}

// Keyed by loose keyword match against primaryFunction — best-in-class,
// function-specific AI tools (not generic "learn to use AI" courses, which
// already live in the AI training category below).
const AI_TOOLS_BY_KEYWORD: { keywords: string[]; tools: AiToolRecommendation[] }[] = [
  {
    keywords: ['finance', 'accounting', 'cfo', 'controller', 'fp&a'],
    tools: [
      { name: 'Stackline / Stacks.AI', description: 'AI-driven FP&A modeling and scenario planning.', url: 'https://www.stacks.ai' },
      { name: 'Vena Insights', description: 'AI copilot layered on top of Excel-based FP&A workflows.', url: 'https://www.venasolutions.com/products/vena-insights' },
      { name: 'Datarails FP&A Genius', description: 'AI financial analyst that answers questions against your own numbers.', url: 'https://www.datarails.com/fpa-genius/' },
    ],
  },
  {
    keywords: ['marketing', 'brand', 'growth', 'demand'],
    tools: [
      { name: 'Jasper', description: 'AI content and campaign copy generation built for marketing teams.', url: 'https://www.jasper.ai' },
      { name: 'HubSpot AI', description: 'AI features built into the CRM/marketing stack you likely already touch.', url: 'https://www.hubspot.com/artificial-intelligence' },
      { name: 'Copy.ai', description: 'Fast-turnaround AI copywriting for ads, emails, and landing pages.', url: 'https://www.copy.ai' },
    ],
  },
  {
    keywords: SALES_KEYWORDS,
    tools: [
      { name: 'Gong', description: 'AI-analyzed call recordings that surface what actually moves deals.', url: 'https://www.gong.io' },
      { name: 'Clari', description: 'AI-driven revenue forecasting and pipeline risk detection.', url: 'https://www.clari.com' },
      { name: 'Apollo.io', description: 'AI-assisted prospecting and outreach sequencing.', url: 'https://www.apollo.io' },
    ],
  },
  {
    keywords: ['product', 'pm ', 'product manager'],
    tools: [
      { name: 'ChatPRD', description: 'AI copilot purpose-built for writing product requirement docs.', url: 'https://www.chatprd.ai' },
      { name: 'Productboard AI', description: 'AI-assisted feedback synthesis and roadmap prioritization.', url: 'https://www.productboard.com' },
    ],
  },
  {
    keywords: ['engineer', 'developer', 'software', 'technical'],
    tools: [
      { name: 'GitHub Copilot', description: 'The standard AI pair-programmer, now expected baseline fluency.', url: 'https://github.com/features/copilot' },
      { name: 'Cursor', description: 'An AI-native code editor built around agentic coding workflows.', url: 'https://cursor.com' },
    ],
  },
  {
    keywords: ['human resources', 'hr', 'talent', 'recruit', 'people'],
    tools: [
      { name: 'Eightfold AI', description: 'AI-driven talent matching and workforce planning.', url: 'https://eightfold.ai' },
      { name: 'HireVue', description: 'AI-assisted interview and assessment platform recruiters actually use.', url: 'https://www.hirevue.com' },
    ],
  },
  {
    keywords: ['operations', 'supply chain', 'logistics'],
    tools: [
      { name: 'Microsoft Copilot for Operations', description: 'AI assistance layered into the operations tools you likely already run on.', url: 'https://www.microsoft.com/en-us/microsoft-365/copilot' },
    ],
  },
  {
    keywords: ['legal', 'counsel', 'compliance'],
    tools: [
      { name: 'Harvey', description: 'AI built specifically for legal research and drafting workflows.', url: 'https://www.harvey.ai' },
      { name: 'Spellbook', description: 'AI contract review and drafting inside Word.', url: 'https://www.spellbook.legal' },
    ],
  },
  {
    keywords: DESIGN_KEYWORDS,
    tools: [
      { name: 'Figma AI', description: 'AI features built directly into the design tool most teams already use.', url: 'https://www.figma.com/ai/' },
      { name: 'Midjourney', description: 'AI image generation for concepting and visual exploration.', url: 'https://www.midjourney.com' },
    ],
  },
  {
    keywords: CUSTOMER_SUCCESS_KEYWORDS,
    tools: [
      { name: 'Intercom Fin', description: 'AI customer-support agent built into a platform CS teams already run on.', url: 'https://www.intercom.com/fin' },
      { name: 'Gainsight AI', description: 'AI-driven health scoring and renewal-risk detection for customer success teams.', url: 'https://www.gainsight.com' },
    ],
  },
  {
    keywords: DATA_ANALYTICS_KEYWORDS,
    tools: [
      { name: 'Julius AI', description: 'AI data-analysis assistant that answers questions directly against your own datasets.', url: 'https://julius.ai' },
      { name: 'Microsoft Copilot for Power BI', description: 'AI assistance layered into a BI tool many analysts already use.', url: 'https://www.microsoft.com/en-us/microsoft-365/copilot' },
    ],
  },
  {
    keywords: EXECUTIVE_LEADERSHIP_KEYWORDS,
    tools: [
      { name: 'Claude', description: "Anthropic's assistant, strong for synthesizing board materials and strategic memos.", url: 'https://claude.ai' },
      { name: 'Glean', description: 'AI search across a company\'s own internal knowledge — useful for getting oriented fast.', url: 'https://www.glean.com' },
    ],
  },
  {
    keywords: ADMINISTRATION_KEYWORDS,
    tools: [
      { name: 'Motion', description: 'AI-driven calendar and task scheduling for busy executive-support roles.', url: 'https://www.usemotion.com' },
      { name: 'Otter.ai', description: 'AI meeting transcription and summarization.', url: 'https://otter.ai' },
    ],
  },
]

const GENERAL_FALLBACK: AiToolRecommendation[] = [
  { name: 'ChatGPT', description: 'The broadest general-purpose AI assistant — a safe default starting point.', url: 'https://chat.openai.com' },
  { name: 'Claude', description: "Anthropic's assistant, strong for writing, analysis, and reasoning through documents.", url: 'https://claude.ai' },
  { name: 'Gemini', description: "Google's assistant, tightly integrated with Gmail, Docs, and Sheets.", url: 'https://gemini.google.com' },
]

export function getAiToolsForFunction(primaryFunction: string | null): AiToolRecommendation[] {
  return matchByFunction(primaryFunction, AI_TOOLS_BY_KEYWORD.map((g) => ({ keywords: g.keywords, value: g.tools }))) ?? GENERAL_FALLBACK
}
