// AI skills as first-class skills: the 24 items of the AI-skills taxonomy (analysis of
// 2026-10-16, findings.md), in three groups — builder (build / train / ship AI), applied
// (use AI tools inside a non-AI job) and leadership (strategy, adoption, governance, AI
// product). The crawler reads which ones a posting asks for from its FULL text
// (ncrawl/ai_skills.py, same ids) and the import stores them on
// ExclusiveJobPosting.aiSkillItems. Here: the member-facing label of each item and the
// words that show a member has it (their skills matrix), so the skills gap and the
// "Why this job" line can name an AI gap. Pure and client-safe; tested in
// src/test/ai-skills.test.ts.

export type AiSkillGroup = 'builder' | 'applied' | 'leadership'

export const AI_SKILL_GROUPS: { key: AiSkillGroup; label: string }[] = [
  { key: 'applied', label: 'Using AI in your work' },
  { key: 'leadership', label: 'Leading AI: strategy, adoption, governance' },
  { key: 'builder', label: 'Building AI systems' },
]

export interface AiSkillItem {
  id: string
  group: AiSkillGroup
  /** Short name, used in the skills gap and as a skill on the member's matrix. */
  label: string
  /**
   * Words in a member's skills (résumé keywords, confirmed skills, certifications) that show
   * they have it. Matched as whole words, lower case; hyphens and slashes read as spaces.
   */
  aliases: string[]
}

export const AI_SKILL_ITEMS: AiSkillItem[] = [
  // ── builder ──
  {
    id: 'b_ml_frameworks',
    group: 'builder',
    label: 'ML frameworks (PyTorch, TensorFlow)',
    aliases: ['pytorch', 'tensorflow', 'keras', 'scikit learn', 'sklearn', 'hugging face', 'huggingface', 'xgboost', 'lightgbm', 'ml frameworks'],
  },
  {
    id: 'b_llm_eng',
    group: 'builder',
    label: 'LLM application engineering',
    aliases: [
      'llm',
      'llms',
      'large language models',
      'large language model',
      'langchain',
      'langgraph',
      'llamaindex',
      'openai api',
      'azure openai',
      'aws bedrock',
      'amazon bedrock',
      'llm application engineering',
      'llm applications',
    ],
  },
  {
    id: 'b_rag',
    group: 'builder',
    label: 'RAG and vector search',
    aliases: [
      'retrieval augmented generation',
      'rag pipelines',
      'rag and vector search',
      'vector search',
      'vector databases',
      'vector database',
      'pinecone',
      'pgvector',
      'weaviate',
      'embeddings',
    ],
  },
  { id: 'b_finetune', group: 'builder', label: 'Model fine-tuning', aliases: ['fine tuning', 'model fine tuning', 'finetuning', 'lora', 'rlhf', 'peft'] },
  {
    id: 'b_model_training',
    group: 'builder',
    label: 'Model training and deep learning',
    aliases: [
      'deep learning',
      'neural networks',
      'natural language processing',
      'nlp',
      'computer vision',
      'reinforcement learning',
      'model training',
      'model training and deep learning',
    ],
  },
  {
    id: 'b_mlops',
    group: 'builder',
    label: 'MLOps',
    aliases: ['mlops', 'ml ops', 'mlflow', 'kubeflow', 'sagemaker', 'vertex ai', 'model deployment', 'model monitoring'],
  },
  {
    id: 'b_eval',
    group: 'builder',
    label: 'AI evaluation and guardrails',
    aliases: ['llm evaluation', 'ai evaluation', 'evals', 'red teaming', 'ai red teaming', 'ai guardrails', 'ai evaluation and guardrails'],
  },
  { id: 'b_gpu', group: 'builder', label: 'GPU and CUDA', aliases: ['cuda', 'gpu programming', 'distributed training', 'gpu and cuda'] },
  {
    id: 'b_ml_general',
    group: 'builder',
    label: 'Machine learning engineering',
    aliases: ['machine learning', 'machine learning engineering', 'ml engineering', 'applied machine learning'],
  },
  // ── applied ──
  {
    id: 'a_tool_use',
    group: 'applied',
    label: 'AI tools in daily work',
    aliases: [
      'ai tools',
      'ai tools in daily work',
      'generative ai',
      'genai',
      'gen ai',
      'ai fluency',
      'ai literacy',
      'chatgpt',
      'microsoft copilot',
      'copilot',
      'claude',
      'gemini',
    ],
  },
  {
    id: 'a_assistants',
    group: 'applied',
    label: 'Gen-AI assistants (ChatGPT, Copilot, Claude)',
    aliases: ['chatgpt', 'microsoft copilot', 'm365 copilot', 'copilot', 'claude', 'gemini', 'perplexity'],
  },
  { id: 'a_prompt', group: 'applied', label: 'Prompt design', aliases: ['prompt engineering', 'prompt design', 'prompting', 'prompt writing'] },
  {
    id: 'a_coding_assist',
    group: 'applied',
    label: 'AI coding assistants',
    aliases: ['github copilot', 'cursor', 'claude code', 'codex', 'ai coding assistants', 'ai assisted coding', 'windsurf'],
  },
  {
    id: 'a_agentic_automation',
    group: 'applied',
    label: 'AI workflow automation',
    aliases: [
      'ai workflow automation',
      'ai automation',
      'ai agents',
      'ai agent',
      'agentic workflows',
      'agentic ai',
      'copilot studio',
      'intelligent automation',
    ],
  },
  {
    id: 'a_automation_tools',
    group: 'applied',
    label: 'Automation platforms (Zapier, n8n, Power Automate)',
    aliases: ['zapier', 'n8n', 'make.com', 'workato', 'power automate', 'uipath', 'automation anywhere', 'blue prism', 'rpa', 'robotic process automation'],
  },
  {
    id: 'a_ai_analytics',
    group: 'applied',
    label: 'AI-enabled analytics',
    aliases: ['ai analytics', 'ai enabled analytics', 'copilot in excel', 'copilot in power bi', 'thoughtspot', 'snowflake cortex', 'tableau pulse'],
  },
  {
    id: 'a_enterprise_ai',
    group: 'applied',
    label: 'AI in business apps (Agentforce, Now Assist)',
    aliases: [
      'agentforce',
      'salesforce einstein',
      'einstein ai',
      'now assist',
      'workday ai',
      'sap joule',
      'glean',
      'hubspot breeze',
      'dax copilot',
      'ambient ai',
    ],
  },
  {
    id: 'a_creative',
    group: 'applied',
    label: 'Gen-AI content tools',
    aliases: ['midjourney', 'dall e', 'adobe firefly', 'firefly', 'synthesia', 'elevenlabs', 'runway', 'ai generated content'],
  },
  // ── leadership ──
  {
    id: 'l_strategy',
    group: 'leadership',
    label: 'AI strategy and use cases',
    aliases: ['ai strategy', 'ai roadmap', 'ai use cases', 'ai strategy and use cases', 'ai use case portfolio'],
  },
  {
    id: 'l_transformation',
    group: 'leadership',
    label: 'AI adoption and change management',
    aliases: ['ai adoption', 'ai transformation', 'ai enablement', 'ai change management', 'ai adoption and change management'],
  },
  { id: 'l_responsible', group: 'leadership', label: 'Responsible AI', aliases: ['responsible ai', 'ai ethics', 'ethical ai', 'trustworthy ai'] },
  {
    id: 'l_governance',
    group: 'leadership',
    label: 'AI governance and risk',
    aliases: [
      'ai governance',
      'ai risk',
      'ai risk management',
      'model risk',
      'model risk management',
      'nist ai rmf',
      'eu ai act',
      'iso 42001',
      'aigp',
      'aaia',
      'ai policy',
      'ai governance and risk',
    ],
  },
  { id: 'l_ai_product', group: 'leadership', label: 'AI product management', aliases: ['ai product management', 'ai product manager', 'ai products'] },
  { id: 'l_ai_org_lead', group: 'leadership', label: 'Leading AI teams', aliases: ['leading ai teams', 'head of ai', 'ai team leadership'] },
]

const BY_ID = new Map(AI_SKILL_ITEMS.map((i) => [i.id, i]))
const GROUP_KEYS = new Set<string>(AI_SKILL_GROUPS.map((g) => g.key))

export function aiSkillItem(id: string): AiSkillItem | undefined {
  return BY_ID.get(id)
}

/** The item ids a label names (case-insensitive), so a gap label can be traced back to its item. */
export function aiSkillIdForLabel(label: string): string | null {
  const l = label.trim().toLowerCase()
  return AI_SKILL_ITEMS.find((i) => i.label.toLowerCase() === l)?.id ?? null
}

// ── import ──

/** Known item ids only, deduped, in taxonomy order. */
export function cleanAiSkillItems(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set(v.filter((x): x is string => typeof x === 'string'))
  return AI_SKILL_ITEMS.map((i) => i.id).filter((id) => seen.has(id))
}

/** The fields the import stores, from what the crawler sent. Left out when not sent, so a row keeps what it holds. */
export function importAiSkillFields(job: { aiSkillGroups?: unknown; aiSkillItems?: unknown; aiToolsNamed?: unknown; aiCertsNamed?: unknown }): {
  aiSkillGroups?: string[]
  aiSkillItems?: string[]
  aiToolsNamed?: string[]
  aiCertsNamed?: string[]
} {
  if (!('aiSkillItems' in job) || job.aiSkillItems === undefined) return {}
  const items = cleanAiSkillItems(job.aiSkillItems)
  // Groups follow from the items (never trusted on their own).
  const groups = AI_SKILL_GROUPS.map((g) => g.key).filter((g) => items.some((i) => BY_ID.get(i)!.group === g))
  const names = (v: unknown, max: number, len: number) =>
    Array.isArray(v)
      ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim().slice(0, len)))].slice(0, max)
      : []
  return {
    aiSkillGroups: groups.filter((g) => GROUP_KEYS.has(g)),
    aiSkillItems: items,
    aiToolsNamed: names(job.aiToolsNamed, 40, 60),
    aiCertsNamed: names(job.aiCertsNamed, 20, 80),
  }
}

// ── member side ──

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9.+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Item ids the member's skills show (whole-word alias matches). */
export function memberAiSkillIds(memberKeywords: string[]): Set<string> {
  const keys = memberKeywords.map(norm).filter((k) => k.length >= 2)
  const out = new Set<string>()
  for (const item of AI_SKILL_ITEMS) {
    for (const alias of item.aliases) {
      const a = norm(alias)
      const re = new RegExp(`(?:^| )${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`)
      if (keys.some((k) => k === a || re.test(k))) {
        out.add(item.id)
        break
      }
    }
  }
  return out
}

// The broadest asks go last, so a gap names the most specific AI skill a job wants.
const GENERIC = new Set(['a_tool_use', 'a_assistants'])

export interface AiSkillGap {
  /** Labels of the AI skills the job asks for, most specific first. */
  asked: string[]
  have: string[]
  missing: string[]
}

/** The AI skills a job asks for (ExclusiveJobPosting.aiSkillItems) against the member's skills. */
export function aiSkillGap(jobItems: string[] | null | undefined, memberKeywords: string[]): AiSkillGap {
  const ids = cleanAiSkillItems(jobItems ?? [])
  if (ids.length === 0) return { asked: [], have: [], missing: [] }
  const ordered = [...ids.filter((i) => !GENERIC.has(i)), ...ids.filter((i) => GENERIC.has(i))]
  const mine = memberAiSkillIds(memberKeywords)
  const label = (id: string) => BY_ID.get(id)!.label
  return {
    asked: ordered.map(label),
    have: ordered.filter((i) => mine.has(i)).map(label),
    missing: ordered.filter((i) => !mine.has(i)).map(label),
  }
}

/** Is this term (as a posting skill) one of the job's AI items said another way? Keeps "machine learning" from showing twice. */
export function isAiAlias(term: string, jobItems: string[]): boolean {
  const t = norm(term)
  return cleanAiSkillItems(jobItems).some((id) => BY_ID.get(id)!.aliases.some((a) => norm(a) === t))
}

// ── tools named in postings (crawler TOOLS keys) → what a member would call them ──

export const AI_TOOL_DISPLAY: Record<string, string> = {
  'Microsoft Copilot (M365)': 'Microsoft Copilot',
  'OpenAI API/GPT': 'OpenAI API',
  'LangChain/LangGraph': 'LangChain',
  'XGBoost/LightGBM': 'XGBoost',
  'Vector DBs (Pinecone etc.)': 'Vector databases',
  'Midjourney/DALL-E/Firefly': 'Midjourney / Firefly',
  'Power BI Copilot / Tableau AI': 'Copilot in Power BI',
  'Harvey/CoCounsel (legal AI)': 'Harvey / CoCounsel',
  'Ambient clinical AI (DAX, Abridge)': 'Ambient clinical AI (DAX, Abridge)',
  'ServiceNow Now Assist': 'Now Assist',
}

export function aiToolDisplayName(tool: string): string {
  return AI_TOOL_DISPLAY[tool] ?? tool
}
