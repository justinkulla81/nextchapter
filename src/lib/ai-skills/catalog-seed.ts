// Catalog additions that fill the AI skills the original 18 courses don't cover (agents, retrieval,
// evaluation, governance, building on model APIs). Every URL was fetched and resolved when added
// (2026-10-16); other candidates (Microsoft Learn, Google Cloud Skills Boost paths) did not resolve
// and are left out rather than guessed. Descriptions name the skills so courseAi() tags them.
// Seeded by scripts/seed-ai-skill-courses.ts; admins edit them in the Course table afterwards.
import type { AiLevel } from '@/lib/ai-skills/taxonomy'

export type AiSkillCourseSeed = {
  title: string
  sponsor: string
  description: string
  url: string
  provider: string
  free: boolean
  skillLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  // The skills this course is meant to cover; the catalog test checks courseAi() agrees.
  expect: { skills: string[]; level: AiLevel }
}

export const AI_SKILL_COURSE_SEEDS: AiSkillCourseSeed[] = [
  {
    title: 'Claude 101',
    sponsor: 'Anthropic',
    description: 'Everyday use of Claude as an AI assistant for writing, research and analysis, with the prompt writing habits that make it reliable.',
    url: 'https://anthropic.skilljar.com/claude-101',
    provider: 'Anthropic Academy',
    free: true,
    skillLevel: 'BEGINNER',
    expect: { skills: ['ai-tools', 'prompting'], level: 'aware' },
  },
  {
    title: 'AI Fluency: Framework & Foundations',
    sponsor: 'Anthropic',
    description: 'A framework for working with AI assistants effectively, ethically and safely, built around responsible AI practice you can apply in any role.',
    url: 'https://anthropic.skilljar.com/ai-fluency-framework-foundations',
    provider: 'Anthropic Academy',
    free: true,
    skillLevel: 'INTERMEDIATE',
    expect: { skills: ['ai-tools', 'ai-governance'], level: 'practitioner' },
  },
  {
    title: 'ChatGPT Prompt Engineering for Developers',
    sponsor: 'DeepLearning.AI',
    description: 'Prompt engineering patterns, then using LLM APIs to summarise, classify, transform and expand text inside your own applications.',
    url: 'https://www.deeplearning.ai/courses/chatgpt-prompt-engineering-for-developers',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'INTERMEDIATE',
    expect: { skills: ['prompting', 'llm-apps'], level: 'practitioner' },
  },
  {
    title: 'NIST AI Risk Management Framework Playbook',
    sponsor: 'NIST',
    description: 'The U.S. standards body’s practical playbook for AI governance and AI risk: the AI RMF functions with suggested actions for each.',
    url: 'https://airc.nist.gov/airmf-resources/playbook/',
    provider: 'NIST',
    free: true,
    skillLevel: 'INTERMEDIATE',
    expect: { skills: ['ai-governance'], level: 'practitioner' },
  },
  {
    title: 'LangChain for LLM Application Development',
    sponsor: 'DeepLearning.AI',
    description: 'Build LLM applications with LangChain: models, prompts, memory and chains, then AI agents that call tools, on top of an LLM API.',
    url: 'https://www.deeplearning.ai/courses/langchain',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['llm-apps', 'ai-agents'], level: 'builder' },
  },
  {
    title: 'AI Agents in LangGraph',
    sponsor: 'DeepLearning.AI',
    description: 'Design AI agents and agentic workflows in LangGraph: tool calling, persistence and human-in-the-loop control.',
    url: 'https://www.deeplearning.ai/courses/ai-agents-in-langgraph',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['ai-agents', 'ai-evals'], level: 'builder' },
  },
  {
    title: 'Multi AI Agent Systems with crewAI',
    sponsor: 'DeepLearning.AI',
    description: 'Build multi-agent systems with crewAI where AI agents divide a task, use tools and hand work to each other.',
    url: 'https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['ai-agents'], level: 'builder' },
  },
  {
    title: 'MCP: Build Rich-Context AI Apps with Anthropic',
    sponsor: 'DeepLearning.AI',
    description: 'Build AI applications that reach tools and data through the Model Context Protocol, including MCP servers and AI agents that use them.',
    url: 'https://www.deeplearning.ai/courses/mcp-build-rich-context-ai-apps-with-anthropic',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['ai-agents', 'llm-apps'], level: 'builder' },
  },
  {
    title: 'Vector Databases: from Embeddings to Applications',
    sponsor: 'DeepLearning.AI',
    description: 'How embeddings and vector databases power semantic search and retrieval-augmented applications, with hands-on builds.',
    url: 'https://www.deeplearning.ai/courses/vector-databases-embeddings-applications',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['rag'], level: 'builder' },
  },
  {
    title: 'Evaluating AI Agents',
    sponsor: 'DeepLearning.AI',
    description: 'Test whether AI agents do the right thing: AI evaluation methods, spotting hallucinations and measuring output quality.',
    url: 'https://www.deeplearning.ai/courses/evaluating-ai-agents',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['ai-evals', 'ai-agents'], level: 'builder' },
  },
  {
    title: 'Red Teaming LLM Applications',
    sponsor: 'DeepLearning.AI',
    description: 'Red team an LLM application to find safety and security failures, then use model evaluation to measure and fix them.',
    url: 'https://www.deeplearning.ai/courses/red-teaming-llm-applications',
    provider: 'DeepLearning.AI',
    free: true,
    skillLevel: 'ADVANCED',
    expect: { skills: ['ai-evals', 'llm-apps'], level: 'builder' },
  },
]
