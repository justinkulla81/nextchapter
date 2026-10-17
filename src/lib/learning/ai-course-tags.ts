// Which AI skill items (src/lib/skills/ai-skills.ts) each Learning catalog course covers, by
// course URL, so an AI gap ("asks for AI governance and risk") links to a course that closes
// it. Tags are ours, from each course's own syllabus page; a course not listed covers none.
// Pure and client-safe; tested in src/test/ai-skills.test.ts.
//
// AI_LEARNING_PATHS are the catalog entries added for the analysis' training ladder
// (findings.md section 4): a governance path and tool-specific paths by function, each
// linking to the vendor's own official learning page. Every URL was checked with one fetch
// on 2026-10-17. No prices: `free` is true only where the vendor's learning page is free.
// The last ten paths are the catalog additions of the retired 16-skill draft (2026-10-16),
// merged in here so there is one AI course list. ServiceNow Now Assist (IT) was left out: ServiceNow University's pages need a sign-in, so
// no public page could be checked.

import { aiSkillIdForLabel, aiSkillItem } from '@/lib/skills/ai-skills'

export const AI_COURSE_TAGS: Record<string, { title: string; items: string[] }> = {
  'https://www.coursera.org/learn/ai-for-everyone': { title: 'AI For Everyone', items: ['a_tool_use', 'l_strategy'] },
  'https://www.coursera.org/learn/generative-ai-for-everyone': { title: 'Generative AI for Everyone', items: ['a_tool_use', 'a_assistants', 'a_prompt'] },
  'https://www.coursera.org/learn/google-ai-essentials': { title: 'Google AI Essentials', items: ['a_tool_use', 'a_assistants', 'a_prompt'] },
  'https://www.coursera.org/learn/google-prompting-essentials': { title: 'Google Prompting Essentials', items: ['a_prompt', 'a_assistants'] },
  'https://www.cloudskillsboost.google/course_templates/536': { title: 'Introduction to Generative AI', items: ['a_tool_use'] },
  'https://www.edx.org/learn/artificial-intelligence/ibm-ai-for-everyone-master-the-basics': {
    title: 'AI for Everyone: Master the Basics',
    items: ['a_tool_use'],
  },
  'https://www.coursera.org/specializations/ai-for-business-wharton': {
    title: 'AI for Business Specialization',
    items: ['l_strategy', 'l_transformation', 'l_responsible'],
  },
  'https://www.coursera.org/learn/prompt-engineering': { title: 'Prompt Engineering for ChatGPT', items: ['a_prompt', 'a_assistants'] },
  'https://www.coursera.org/learn/generative-ai-for-executives': { title: 'Generative AI for Executives', items: ['l_strategy', 'l_transformation'] },
  'https://www.coursera.org/specializations/ai-product-management-duke': {
    title: 'AI Product Management Specialization',
    items: ['l_ai_product', 'l_responsible'],
  },
  'https://www.coursera.org/learn/generative-ai-for-hr-professionals': { title: 'Generative AI for HR Professionals', items: ['a_tool_use', 'a_prompt'] },
  'https://www.edx.org/certificates/professional-certificate/ibm-generative-ai-fundamentals': {
    title: 'Generative AI Fundamentals Professional Certificate',
    items: ['a_prompt', 'a_tool_use', 'a_assistants'],
  },
  'https://www.edx.org/learn/artificial-intelligence/harvard-university-cs50-s-introduction-to-artificial-intelligence-with-python': {
    title: "CS50's Introduction to Artificial Intelligence with Python",
    items: ['b_model_training', 'b_ml_general'],
  },
  'https://www.coursera.org/specializations/deep-learning': { title: 'Deep Learning Specialization', items: ['b_model_training', 'b_ml_frameworks'] },
  'https://www.coursera.org/professional-certificates/ai-engineer': {
    title: 'IBM AI Engineering Professional Certificate',
    items: ['b_ml_frameworks', 'b_model_training', 'b_ml_general'],
  },
  'https://www.coursera.org/specializations/machine-learning-introduction': {
    title: 'Machine Learning Specialization',
    items: ['b_ml_general', 'b_ml_frameworks'],
  },
  'https://www.edx.org/learn/machine-learning/massachusetts-institute-of-technology-machine-learning-with-python-from-linear-models-to-deep-learning': {
    title: 'Machine Learning with Python',
    items: ['b_ml_general', 'b_model_training'],
  },
  // The paths below (AI_LEARNING_PATHS).
  'https://www.nist.gov/itl/ai-risk-management-framework': { title: 'NIST AI Risk Management Framework (AI RMF)', items: ['l_governance', 'l_responsible'] },
  'https://iapp.org/certify/aigp/': { title: 'Artificial Intelligence Governance Professional (AIGP)', items: ['l_governance', 'l_responsible'] },
  'https://www.isaca.org/credentialing/aaia': { title: 'Advanced in AI Audit (AAIA)', items: ['l_governance'] },
  'https://learn.microsoft.com/en-us/training/paths/draft-analyze-present-microsoft-365-copilot/': {
    title: 'Draft, Analyze, and Present with Microsoft Copilot',
    items: ['a_assistants', 'a_ai_analytics', 'a_tool_use'],
  },
  'https://learn.microsoft.com/en-us/training/paths/automate-process-power-automate/': {
    title: 'Automate a business process using Power Automate',
    items: ['a_automation_tools', 'a_agentic_automation'],
  },
  'https://trailhead.salesforce.com/content/learn/trails/become-an-agentblazer-champion-2026': {
    title: 'Become an Agentblazer Champion',
    items: ['a_enterprise_ai', 'a_agentic_automation'],
  },
  'https://trailhead.salesforce.com/credentials/agentforcespecialist': { title: 'Salesforce Certified Agentforce Specialist', items: ['a_enterprise_ai'] },
  // Merged from the retired 16-skill draft's catalog additions (2026-10-16; AI_LEARNING_PATHS below).
  'https://anthropic.skilljar.com/claude-101': { title: 'Claude 101', items: ['a_assistants', 'a_prompt'] },
  'https://anthropic.skilljar.com/ai-fluency-framework-foundations': { title: 'AI Fluency: Framework & Foundations', items: ['a_tool_use', 'l_responsible'] },
  'https://www.deeplearning.ai/courses/chatgpt-prompt-engineering-for-developers': {
    title: 'ChatGPT Prompt Engineering for Developers',
    items: ['a_prompt', 'b_llm_eng'],
  },
  'https://www.deeplearning.ai/courses/langchain': { title: 'LangChain for LLM Application Development', items: ['b_llm_eng'] },
  'https://www.deeplearning.ai/courses/ai-agents-in-langgraph': { title: 'AI Agents in LangGraph', items: ['b_llm_eng'] },
  'https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai': { title: 'Multi AI Agent Systems with crewAI', items: ['b_llm_eng'] },
  'https://www.deeplearning.ai/courses/mcp-build-rich-context-ai-apps-with-anthropic': { title: 'MCP: Build Rich-Context AI Apps with Anthropic', items: ['b_llm_eng'] },
  'https://www.deeplearning.ai/courses/vector-databases-embeddings-applications': { title: 'Vector Databases: from Embeddings to Applications', items: ['b_rag'] },
  'https://www.deeplearning.ai/courses/evaluating-ai-agents': { title: 'Evaluating AI Agents', items: ['b_eval'] },
  'https://www.deeplearning.ai/courses/red-teaming-llm-applications': { title: 'Red Teaming LLM Applications', items: ['b_eval'] },
}

export interface AiLearningPath {
  title: string
  sponsor: string
  description: string
  url: string
  provider: string
  free: boolean
  category: 'AI_TRAINING' | 'CERTIFICATION' | 'FUNCTION_TRAINING'
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  /** CERTIFICATION: member functions (PRIMARY_FUNCTION_OPTIONS) it applies to. */
  targetFunctions?: string[]
  /** FUNCTION_TRAINING: matched against the member's function (build-learning-plan.ts). */
  keywords?: string[]
}

export const AI_LEARNING_PATHS: AiLearningPath[] = [
  {
    title: 'NIST AI Risk Management Framework (AI RMF)',
    sponsor: 'NIST',
    description:
      'The free, public framework most AI policies cite: Govern, Map, Measure, Manage. Read it to write or review an AI use policy or a use-case risk review.',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    provider: 'certificationBody',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'INTERMEDIATE',
  },
  {
    title: 'Artificial Intelligence Governance Professional (AIGP)',
    sponsor: 'IAPP',
    description: 'The AI governance certification postings name most, mostly in legal, risk, security and financial services roles.',
    url: 'https://iapp.org/certify/aigp/',
    provider: 'certificationBody',
    free: false,
    category: 'CERTIFICATION',
    skillLevel: 'ADVANCED',
    targetFunctions: ['Legal', 'Finance', 'Data & Analytics', 'Operations', 'Executive Leadership'],
  },
  {
    title: 'Advanced in AI Audit (AAIA)',
    sponsor: 'ISACA',
    description: 'An AI audit certification for audit, risk and security professionals; named in AI governance postings.',
    url: 'https://www.isaca.org/credentialing/aaia',
    provider: 'certificationBody',
    free: false,
    category: 'CERTIFICATION',
    skillLevel: 'ADVANCED',
    targetFunctions: ['Finance', 'Legal', 'Data & Analytics', 'Operations'],
  },
  {
    title: 'Draft, Analyze, and Present with Microsoft Copilot',
    sponsor: 'Microsoft',
    description: 'Microsoft Learn’s free path for Copilot in Word, Excel and PowerPoint. Microsoft Copilot is the AI tool finance postings name most.',
    url: 'https://learn.microsoft.com/en-us/training/paths/draft-analyze-present-microsoft-365-copilot/',
    provider: 'microsoftLearn',
    free: true,
    category: 'FUNCTION_TRAINING',
    skillLevel: 'BEGINNER',
    keywords: ['finance', 'accounting'],
  },
  {
    title: 'Automate a business process using Power Automate',
    sponsor: 'Microsoft',
    description: 'Microsoft Learn’s free path for building approval and data flows in Power Automate, the automation tool operations postings name.',
    url: 'https://learn.microsoft.com/en-us/training/paths/automate-process-power-automate/',
    provider: 'microsoftLearn',
    free: true,
    category: 'FUNCTION_TRAINING',
    skillLevel: 'BEGINNER',
    keywords: ['operations'],
  },
  {
    title: 'Become an Agentblazer Champion',
    sponsor: 'Salesforce',
    description: 'Trailhead’s free Agentforce trail: what AI agents do in Salesforce and how sales and service teams use them.',
    url: 'https://trailhead.salesforce.com/content/learn/trails/become-an-agentblazer-champion-2026',
    provider: 'trailhead',
    free: true,
    category: 'FUNCTION_TRAINING',
    skillLevel: 'BEGINNER',
    keywords: ['sales', 'customer success'],
  },
  {
    title: 'Salesforce Certified Agentforce Specialist',
    sponsor: 'Salesforce',
    description: 'The Agentforce certification postings name for sales and customer roles; Trailhead’s learning for it is free.',
    url: 'https://trailhead.salesforce.com/credentials/agentforcespecialist',
    provider: 'trailhead',
    free: false,
    category: 'CERTIFICATION',
    skillLevel: 'INTERMEDIATE',
    targetFunctions: ['Sales', 'Customer Success'],
  },
  // From the retired 16-skill draft (2026-10-16): URLs checked then; they fill the builder gaps
  // (LLM apps, RAG, evaluation) and two assistant basics. Already in the live catalog.
  {
    title: 'Claude 101',
    sponsor: 'Anthropic',
    description: 'Everyday use of Claude as an AI assistant for writing, research and analysis, with the prompt writing habits that make it reliable.',
    url: 'https://anthropic.skilljar.com/claude-101',
    provider: 'Anthropic Academy',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'BEGINNER',
  },
  {
    title: 'AI Fluency: Framework & Foundations',
    sponsor: 'Anthropic',
    description: 'A framework for working with AI assistants effectively, ethically and safely, built around responsible AI practice you can apply in any role.',
    url: 'https://anthropic.skilljar.com/ai-fluency-framework-foundations',
    provider: 'Anthropic Academy',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'INTERMEDIATE',
  },
  {
    title: 'ChatGPT Prompt Engineering for Developers',
    sponsor: 'DeepLearning.AI',
    description: 'Prompt engineering patterns, then using LLM APIs to summarise, classify, transform and expand text inside your own applications.',
    url: 'https://www.deeplearning.ai/courses/chatgpt-prompt-engineering-for-developers',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'INTERMEDIATE',
  },
  {
    title: 'LangChain for LLM Application Development',
    sponsor: 'DeepLearning.AI',
    description: 'Build LLM applications with LangChain: models, prompts, memory and chains, then AI agents that call tools, on top of an LLM API.',
    url: 'https://www.deeplearning.ai/courses/langchain',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
  {
    title: 'AI Agents in LangGraph',
    sponsor: 'DeepLearning.AI',
    description: 'Design AI agents and agentic workflows in LangGraph: tool calling, persistence and human-in-the-loop control.',
    url: 'https://www.deeplearning.ai/courses/ai-agents-in-langgraph',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
  {
    title: 'Multi AI Agent Systems with crewAI',
    sponsor: 'DeepLearning.AI',
    description: 'Build multi-agent systems with crewAI where AI agents divide a task, use tools and hand work to each other.',
    url: 'https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
  {
    title: 'MCP: Build Rich-Context AI Apps with Anthropic',
    sponsor: 'DeepLearning.AI',
    description: 'Build AI applications that reach tools and data through the Model Context Protocol, including MCP servers and AI agents that use them.',
    url: 'https://www.deeplearning.ai/courses/mcp-build-rich-context-ai-apps-with-anthropic',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
  {
    title: 'Vector Databases: from Embeddings to Applications',
    sponsor: 'DeepLearning.AI',
    description: 'How embeddings and vector databases power semantic search and retrieval-augmented applications, with hands-on builds.',
    url: 'https://www.deeplearning.ai/courses/vector-databases-embeddings-applications',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
  {
    title: 'Evaluating AI Agents',
    sponsor: 'DeepLearning.AI',
    description: 'Test whether AI agents do the right thing: AI evaluation methods, spotting hallucinations and measuring output quality.',
    url: 'https://www.deeplearning.ai/courses/evaluating-ai-agents',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
  {
    title: 'Red Teaming LLM Applications',
    sponsor: 'DeepLearning.AI',
    description: 'Red team an LLM application to find safety and security failures, then use model evaluation to measure and fix them.',
    url: 'https://www.deeplearning.ai/courses/red-teaming-llm-applications',
    provider: 'DeepLearning.AI',
    free: true,
    category: 'AI_TRAINING',
    skillLevel: 'ADVANCED',
  },
]

const norm = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase()
const TAGS = new Map(Object.entries(AI_COURSE_TAGS).map(([u, t]) => [norm(u), t.items]))

/** AI skill item ids a course covers (by its URL). */
export function aiSkillsForCourse(url: string | null | undefined): string[] {
  return url ? (TAGS.get(norm(url)) ?? []) : []
}

/** Labels of the AI skills a course covers, for the course card. */
export function aiSkillLabelsForCourse(url: string | null | undefined): string[] {
  return aiSkillsForCourse(url).map((id) => aiSkillItem(id)!.label)
}

/**
 * The course that closes an AI gap, from the courses on offer: the first (in the order given —
 * the catalog's own order) that covers the item. Takes an item id or its gap label.
 */
export function courseForAiSkill<C extends { url: string }>(itemOrLabel: string, courses: C[]): C | null {
  const id = aiSkillItem(itemOrLabel) ? itemOrLabel : aiSkillIdForLabel(itemOrLabel)
  if (!id) return null
  return courses.find((c) => aiSkillsForCourse(c.url).includes(id)) ?? null
}

/** Without the live catalog: the first tagged course for the item, in the order above (beginner first). */
export function defaultCourseForAiSkill(itemOrLabel: string): { id: string; url: string; title: string } | null {
  const id = aiSkillItem(itemOrLabel) ? itemOrLabel : aiSkillIdForLabel(itemOrLabel)
  if (!id) return null
  const hit = Object.entries(AI_COURSE_TAGS).find(([, t]) => t.items.includes(id))
  return hit ? { id, url: hit[0], title: hit[1].title } : null
}
