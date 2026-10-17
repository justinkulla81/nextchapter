// The AI skills layer: the AI-specific skills job postings ask for, three levels, and the
// role tier a posting falls in. Sits beside the O*NET taxonomy (src/lib/careers), which
// has almost nothing on AI. Deterministic text matching, no model calls, so it costs
// nothing per posting or per view. Pure and client-safe.
//
// The vocabulary is a first cut written from how AI roles are described; run
// scripts/ai-skills/analyze-postings.ts against the live board to see what it catches
// and what it misses, then edit AI_SKILLS here.

export type AiLevel = 'aware' | 'practitioner' | 'builder'
export type AiRoleTier = 'builder' | 'embedded' | 'adjacent'

export const AI_LEVELS: { key: AiLevel; label: string; help: string }[] = [
  { key: 'aware', label: 'Aware', help: 'You know what it is and what it can and can’t do.' },
  { key: 'practitioner', label: 'Practitioner', help: 'You use it in your own work, reliably, and can show examples.' },
  { key: 'builder', label: 'Builder', help: 'You build, configure or evaluate it for others to rely on.' },
]
export const AI_LEVEL_RANK: Record<AiLevel, number> = { aware: 1, practitioner: 2, builder: 3 }

export const AI_ROLE_TIERS: { key: AiRoleTier; label: string; help: string }[] = [
  { key: 'builder', label: 'Builds AI', help: 'AI and machine-learning engineers, data scientists, forward-deployed engineers.' },
  { key: 'embedded', label: 'Uses AI in the job', help: 'Any other role (product, marketing, finance, ops, HR…) that now expects AI in the daily work.' },
  { key: 'adjacent', label: 'Governs and trains AI', help: 'Governance, risk, trust and safety, evaluation, data annotation and AI training.' },
]

export type AiSkill = {
  key: string
  label: string
  // One line a candidate reads: what the skill is in practice.
  summary: string
  // Skills a builder-tier role needs at 'builder' level; everyone else defaults to practitioner.
  buildLevel: boolean
  // Case-insensitive patterns, matched on normalised text with word boundaries.
  patterns: RegExp[]
}

const w = (...parts: string[]) => new RegExp(`\\b(?:${parts.join('|')})\\b`, 'i')

export const AI_SKILLS: AiSkill[] = [
  {
    key: 'ai-tools',
    label: 'Working with AI assistants',
    summary: 'Using ChatGPT, Claude, Gemini or Copilot daily to draft, research, summarise and analyse.',
    buildLevel: false,
    patterns: [
      w('generative ai', 'gen ?ai', 'genai', 'chatgpt', 'gpt-?4\\w*', 'gemini', 'microsoft copilot', 'm365 copilot', 'copilot for microsoft 365', 'claude (?:ai|code|api|sonnet|opus|haiku)', 'ai assistants?', 'ai tools?', 'ai-powered tools?', 'large language models?', 'llms?'),
    ],
  },
  {
    key: 'prompting',
    label: 'Prompt design',
    summary: 'Writing and refining instructions that get reliable, repeatable output from a model.',
    buildLevel: false,
    patterns: [w('prompt engineering', 'prompt design', 'prompt writing', 'prompt crafting', 'prompting', 'prompts? library', 'system prompts?')],
  },
  {
    key: 'ai-automation',
    label: 'AI workflow automation',
    summary: 'Wiring AI into recurring work with Zapier, Make, n8n, Power Automate or similar, so tasks run without you.',
    buildLevel: false,
    patterns: [w('zapier', 'n8n', 'make\\.com', 'power automate', 'copilot studio', 'workato', 'ai workflows?', 'ai automation', 'automate (?:\\w+ ){0,3}with ai', 'intelligent automation', 'hyperautomation')],
  },
  {
    key: 'ai-agents',
    label: 'AI agents',
    summary: 'Designing agents that call tools, take multi-step actions and hand off to people when they should.',
    buildLevel: true,
    patterns: [w('ai agents?', 'agentic', 'multi-?agent', 'llm agents?', 'autonomous agents?', 'langgraph', 'crewai', 'autogen', 'model context protocol', 'mcp servers?', 'function calling')],
  },
  {
    key: 'rag',
    label: 'Retrieval and knowledge grounding',
    summary: 'Connecting a model to company documents and data so answers are grounded and cited (RAG, vector search).',
    buildLevel: true,
    patterns: [w('rag', 'retrieval[- ]augmented', 'vector (?:database|db|store|search)s?', 'embeddings?', 'pinecone', 'pgvector', 'weaviate', 'chroma', 'semantic search', 'knowledge base (?:for|with) ai')],
  },
  {
    key: 'llm-apps',
    label: 'Building LLM applications',
    summary: 'Shipping software on model APIs: orchestration, fine-tuning, cost and latency control.',
    buildLevel: true,
    patterns: [w('openai api', 'anthropic api', 'claude api', 'llm apis?', 'llm applications?', 'llm-powered', 'langchain', 'llamaindex', 'hugging ?face', 'fine-?tuning', 'ai sdk', 'ai applications?', 'ai-powered (?:products?|applications?|features?)', 'applied ai', 'foundation models?')],
  },
  {
    key: 'ml-foundations',
    label: 'Machine learning foundations',
    summary: 'Classical and deep learning: modelling, training, features, NLP and computer vision.',
    buildLevel: true,
    patterns: [w('machine learning', 'deep learning', 'neural networks?', 'scikit-?learn', 'pytorch', 'tensorflow', 'xgboost', 'natural language processing', 'nlp', 'computer vision', 'reinforcement learning', 'ml models?')],
  },
  {
    key: 'mlops',
    label: 'Deploying and running models',
    summary: 'Getting models into production and keeping them healthy: MLOps, monitoring, pipelines, GPUs.',
    buildLevel: true,
    patterns: [w('mlops', 'llmops', 'model deployment', 'model serving', 'sagemaker', 'vertex ai', 'azure machine learning', 'azure openai', 'bedrock', 'databricks', 'mlflow', 'kubeflow', 'feature stores?', 'ml pipelines?', 'inference (?:infrastructure|optimization)')],
  },
  {
    key: 'ai-evals',
    label: 'Evaluating AI output',
    summary: 'Testing whether a model or workflow is right: evals, red-teaming, spotting hallucinations, human review.',
    buildLevel: true,
    patterns: [w('evals?', 'ai evaluation', 'model evaluation', 'llm evaluation', 'red[- ]team\\w*', 'hallucinations?', 'human[- ]in[- ]the[- ]loop', 'ai quality', 'benchmarking models?', 'output quality', 'ai testing')],
  },
  {
    key: 'ai-governance',
    label: 'AI governance and risk',
    summary: 'Policy, privacy, bias and compliance for AI: frameworks, audits, responsible-AI practice.',
    buildLevel: false,
    patterns: [w('ai governance', 'responsible ai', 'ethical ai', 'ai ethics', 'ai policy', 'ai risk', 'ai compliance', 'ai safety', 'trust and safety', 'nist ai', 'ai rmf', 'eu ai act', 'model risk', 'algorithmic (?:bias|fairness|audits?)', 'bias audits?', 'ai act')],
  },
  {
    key: 'ai-product',
    label: 'AI product and strategy',
    summary: 'Choosing where AI creates value, scoping use cases, measuring results and leading adoption.',
    buildLevel: false,
    patterns: [w('ai strategy', 'ai roadmap', 'ai product', 'ai use cases?', 'ai adoption', 'ai transformation', 'ai initiatives?', 'ai programs?', 'ai enablement', 'ai champions?', 'ai literacy', 'ai upskilling', 'ai center of excellence')],
  },
  {
    key: 'ai-coding',
    label: 'AI-assisted software work',
    summary: 'Building and shipping faster with Cursor, Copilot, Claude Code and similar, and reviewing what they write.',
    buildLevel: false,
    patterns: [w('github copilot', 'cursor', 'claude code', 'codex', 'windsurf', 'ai pair programming', 'ai-assisted (?:coding|development|engineering)', 'vibe cod\\w+', 'copilot')],
  },
  {
    key: 'ai-content',
    label: 'AI for content and creative',
    summary: 'Producing and editing text, images, audio and video with AI while keeping brand and accuracy.',
    buildLevel: false,
    patterns: [w('midjourney', 'dall-?e', 'stable diffusion', 'runway', 'sora', 'elevenlabs', 'ai[- ]generated (?:content|images?|video|copy)', 'generative (?:content|design|media)', 'ai copywriting', 'ai image generation')],
  },
  {
    key: 'ai-conversational',
    label: 'Conversational and customer AI',
    summary: 'Chatbots, voice agents and AI in support and sales: design, tuning, and when to escalate.',
    buildLevel: false,
    patterns: [w('conversational ai', 'chatbots?', 'voice agents?', 'virtual assistants?', 'ai agents? (?:for|in) (?:customer|support|sales)', 'contact center ai', 'ai sdr', 'intelligent virtual agents?')],
  },
  {
    key: 'ai-data-training',
    label: 'Training data and human feedback',
    summary: 'Labelling, rating and writing examples that teach models (RLHF, annotation, expert review).',
    buildLevel: false,
    patterns: [w('rlhf', 'data annotation', 'data labell?ing', 'ai trainer', 'model training data', 'training data', 'human feedback', 'annotation guidelines?', 'ai tutor', 'expert reviewers?', 'content raters?')],
  },
]

export const AI_SKILL_BY_KEY: Record<string, AiSkill> = Object.fromEntries(AI_SKILLS.map((s) => [s.key, s]))

const normalise = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ')

const BUILDER_TITLE = w(
  'ai engineers?', 'ml engineers?', 'machine learning', 'applied scientists?', 'research scientists?', 'research engineers?', 'data scientists?',
  'forward[- ]deployed', 'llm engineers?', 'ai architects?', 'ai developers?', 'deep learning', 'nlp', 'computer vision', 'mlops', 'prompt engineers?', 'applied ai', 'ai/ml', 'ml/ai',
)
const ADJACENT_TITLE = w(
  'ai governance', 'responsible ai', 'ai ethics', 'ai policy', 'ai risk', 'ai safety', 'trust (?:and|&) safety', 'ai trainer', 'ai tutor', 'data annotator', 'annotation',
  'model risk', 'ai compliance', 'ai auditor', 'rlhf', 'content rater', 'ai quality', 'evaluation specialist',
)
const FAMILIAR = /\b(?:familiarity|familiar with|exposure to|awareness of|interest in|curious|basic understanding|working knowledge of)\b/i

/** Which AI skills a piece of text names (a resume keyword, a course description, a posting). */
export function matchAiSkills(text: string | null | undefined): AiSkill[] {
  const t = normalise(text ?? '')
  return t ? AI_SKILLS.filter((s) => s.patterns.some((p) => p.test(t))) : []
}

export type PostingAiSkill = { key: string; level: AiLevel }
export type PostingAiRead = { tier: AiRoleTier | null; skills: PostingAiSkill[] }

/**
 * The AI skills a posting asks for, the level it implies, and its role tier.
 * Level is a heuristic: a builder-tier role asking for a build skill is 'builder'; text near the
 * mention saying "familiarity/exposure" is 'aware'; everything else 'practitioner'.
 */
export function readPostingAi(title: string | null | undefined, ...texts: (string | null | undefined)[]): PostingAiRead {
  const t = normalise(title ?? '')
  const body = normalise(texts.filter(Boolean).join(' \n '))
  const all = `${t} \n ${body}`
  const hits: AiSkill[] = []
  for (const s of AI_SKILLS) if (s.patterns.some((p) => p.test(all))) hits.push(s)

  const titleSkills = AI_SKILLS.filter((s) => s.patterns.some((p) => p.test(t)))
  const adjacent = ADJACENT_TITLE.test(t)
  const builder = !adjacent && BUILDER_TITLE.test(t)
  // "Copilot" and "evals" alone can appear in non-AI text; require a second signal for the weakest skills.
  const strong = hits.filter((s) => !(s.key === 'ai-coding' && hits.length === 1 && !titleSkills.length))
  if (strong.length === 0 && !builder && !adjacent) return { tier: null, skills: [] }

  const tier: AiRoleTier = adjacent ? 'adjacent' : builder ? 'builder' : 'embedded'
  const skills = strong.map((s) => {
    const re = s.patterns.find((p) => p.test(all))
    const m = re ? all.match(re) : null
    const near = m?.index != null ? all.slice(Math.max(0, m.index - 80), m.index + 80) : ''
    const level: AiLevel = FAMILIAR.test(near) ? 'aware' : tier === 'builder' && s.buildLevel ? 'builder' : 'practitioner'
    return { key: s.key, level }
  })
  return { tier, skills }
}

// How the tiers read when a person sets a target: which AI skills matter for roles like the one they want.
export const AI_TIER_FOR_LABEL = Object.fromEntries(AI_ROLE_TIERS.map((t) => [t.key, t.label])) as Record<AiRoleTier, string>
