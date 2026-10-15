// AI and a field: how exposed the work is to AI, whether its jobs are growing
// or shrinking, and whether learning AI tools is critical to staying in it.
// Pure and client-safe. Data: the NextChapter White Collar Employment Report
// (occupation-trends-data.ts): AI exposure is the share of a group's tasks AI
// could do in principle (Eloundou et al. 2024), not measured job loss;
// employment change is 2022-26 (Census CPS).

import { OCCUPATION_TRENDS, OCCUPATION_TRENDS_SOURCE } from '@/lib/market/occupation-trends-data'
import { trendsForFunction } from '@/lib/market/occupation-trends'
import { ROLE_SOC } from '@/lib/pivots/occupation-outlook'
import { ROLES } from '@/lib/pivots/pivot-map'

export type AiNeed = 'critical' | 'important' | 'helpful' | 'optional'
export type AiOutlook = {
  group: string
  socGroup: string
  exposure: number
  employmentChangePct: number
  trend: 'growing' | 'flat' | 'shrinking'
  aiSkills: AiNeed
  // One plain sentence: is learning AI critical to staying in this field?
  line: string
  tools: string
  source: string
}

export const AI_NEED_LABEL: Record<AiNeed, string> = {
  critical: 'Learning AI is critical',
  important: 'Learning AI is important',
  helpful: 'AI skills help',
  optional: 'AI skills are optional here',
}

// What "learning AI" means in each group, concretely.
const TOOLS: Record<string, string> = {
  '11': 'AI for planning, reporting and decisions; leading a team that uses AI tools',
  '13': 'Copilot or Gemini in spreadsheets, AI-assisted analysis and forecasting, automating routine reports',
  '15': 'AI coding assistants, building with LLM APIs, evaluating AI output',
  '17': 'AI-assisted design and simulation, generative design tools',
  '19': 'AI for literature review, data analysis and lab automation',
  '21': 'AI for case notes and finding resources, used with judgment about privacy',
  '23': 'AI contract review, legal research tools and drafting with verification',
  '25': 'AI in lesson design, feedback and grading, and teaching students to use it well',
  '27': 'Generative AI for drafts, images and video, with your own judgment on top',
  '29': 'AI documentation (ambient scribes), clinical decision support',
  '31': 'Scheduling and documentation tools',
  '41': 'AI prospecting and research, CRM copilots, AI-drafted outreach you personalize',
  '43': 'AI assistants for email, scheduling, documents and data entry; automating routine steps',
}

function need(exposure: number): AiNeed {
  if (exposure >= 55) return 'critical'
  if (exposure >= 45) return 'important'
  if (exposure >= 25) return 'helpful'
  return 'optional'
}

function outlook(socGroup: string | undefined): AiOutlook | null {
  const g = socGroup ? OCCUPATION_TRENDS.find((r) => r.socGroup === socGroup) : undefined
  if (!g) return null
  const n = need(g.aiExposure)
  const trend = g.employmentChangePct >= 5 ? 'growing' : g.employmentChangePct <= -1 ? 'shrinking' : 'flat'
  const ex = Math.round(g.aiExposure)
  const line =
    n === 'critical'
      ? `${g.name} work has an AI exposure of ${ex} out of 100: most of its tasks are ones AI can already help with. Employers will expect AI fluency; learning the tools is now part of staying in this field.`
      : n === 'important'
        ? `${g.name} work has an AI exposure of ${ex} out of 100. AI changes how much of the work gets done; people who use it well stand out, and it's becoming a hiring screen.`
        : n === 'helpful'
          ? `${g.name} work has an AI exposure of ${ex} out of 100. AI helps around the edges (documents, research, scheduling); the core of the job stays human.`
          : `${g.name} work has a low AI exposure (${ex} out of 100): the work is hands-on or in person. AI skills are a bonus, not a requirement.`
  return {
    group: g.name,
    socGroup: g.socGroup,
    exposure: g.aiExposure,
    employmentChangePct: g.employmentChangePct,
    trend,
    aiSkills: n,
    line,
    tools: TOOLS[g.socGroup] ?? 'The AI tools people in this field already use day to day',
    source: `${OCCUPATION_TRENDS_SOURCE.title}, ${OCCUPATION_TRENDS_SOURCE.edition}`,
  }
}

export function aiOutlookForRole(roleKey: string): AiOutlook | null {
  const soc = ROLE_SOC[roleKey]
  if (soc) return outlook(soc.slice(0, 2))
  return aiOutlookForFunction(ROLES.get(roleKey)?.fn ?? null)
}

export function aiOutlookForFunction(primaryFunction: string | null | undefined): AiOutlook | null {
  return outlook(trendsForFunction(primaryFunction)[0]?.socGroup)
}
