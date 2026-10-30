// The three numbers for the AI-assistant channel: tool calls per day per tool (AnalyticsEvent mcp_tool_called), directory
// listing status, and citation share on the weekly citation prompts grouped by what the person is trying to do.

export const MCP_TOOL_EVENT = 'mcp_tool_called'

export type CitationGroup = 'job_search' | 'career' | 'resume'

export const CITATION_GROUP_LABEL: Record<CitationGroup, string> = { job_search: 'Job search', career: 'Career', resume: 'Résumé' }

// Keys of CITATION_PROMPTS (src/lib/ai-visibility/prompts.ts). A key in no group is a layoff-data or other question and is not counted here.
const GROUPS: Record<CitationGroup, string[]> = {
  resume: ['resume-after-layoff', 'resume-ai-ats', 'resume-help-senior', 'cover-letter-ai'],
  job_search: ['executive-job-sites', 'companies-hiring-senior', 'hidden-job-market', 'job-search-tracker', 'jobs-over-50', 'job-search-scams'],
  career: ['job-transition-platform', 'career-change-ai', 'career-coach-transition', 'skills-gap', 'ai-retraining', 'ai-skills-jobs', 'interview-prep-senior', 'networking-laid-off', 'linkedin-laid-off', 'salary-check'],
}

export function citationGroupOf(promptKey: string): CitationGroup | null {
  for (const g of Object.keys(GROUPS) as CitationGroup[]) if (GROUPS[g].includes(promptKey)) return g
  return null
}

export function citationShare(results: { promptKey: string; cited: boolean; error: string | null }[]): Record<CitationGroup, { asked: number; cited: number }> {
  const out: Record<CitationGroup, { asked: number; cited: number }> = { job_search: { asked: 0, cited: 0 }, career: { asked: 0, cited: 0 }, resume: { asked: 0, cited: 0 } }
  for (const r of results) {
    const g = citationGroupOf(r.promptKey)
    if (!g || r.error) continue
    out[g].asked++
    if (r.cited) out[g].cited++
  }
  return out
}

/** Where each directory submission stands. Edit by hand when a status changes; nothing is submitted until the owner approves. */
export const DIRECTORY_LISTINGS: { name: string; where: string; status: 'not_submitted' | 'submitted' | 'in_review' | 'listed' | 'rejected' }[] = [
  { name: 'Claude connectors directory', where: 'https://claude.ai/directory/manage', status: 'not_submitted' },
  { name: 'ChatGPT apps directory', where: 'https://platform.openai.com/apps-manage', status: 'not_submitted' },
]
