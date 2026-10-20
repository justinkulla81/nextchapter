import { escapeHtml } from '@/lib/mailing/render'
import { showCount } from './area-brief'
import type { AreaBrief } from './area-brief-data'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function boardBriefPeriod(now: Date): { key: string; label: string } {
  return { key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}` }
}

// The monthly board brief as mailing-editor HTML (p, ul, li, b, a only), made from
// the same anonymous brief the board sees on its own page. Null when there is
// nothing worth a board's time, so a quiet month sends nothing. Members appear
// only as counts that already passed the minimum-group rule. Funding is listed
// because it is for organizations like a board.
export function boardBriefHtml(brief: AreaBrief, label: string): string | null {
  const parts: string[] = []
  const c = brief.candidates
  const where = brief.candidatesScope === 'area' ? brief.area.name : brief.area.stateName

  if (c.total !== null) {
    const line = `<p><b>NextChapter members in ${escapeHtml(where)}:</b> ${c.total.toLocaleString('en-US')}, and ${escapeHtml(showCount(c.landedRecently).toLowerCase())} started a new job in the last ${c.windowDays} days.</p>`
    const shown = c.byJourney.filter((x) => x.count !== null)
    parts.push(line + (shown.length ? `<ul>${shown.map((x) => `<li>${escapeHtml(x.label)}: ${x.count!.toLocaleString('en-US')}</li>`).join('')}</ul>` : ''))
  }
  if (brief.boardMembers?.connected != null) {
    parts.push(`<p><b>Members who told us they work with you:</b> ${brief.boardMembers.connected.toLocaleString('en-US')}.</p>`)
  }
  if (brief.layoffs.companies.length > 0) {
    parts.push(
      `<p><b>Layoff notices, last ${brief.layoffs.windowDays} days:</b></p><ul>${brief.layoffs.companies
        .slice(0, 5)
        .map((x) => `<li>${escapeHtml(x.employer)}${x.workers ? `: ${x.workers.toLocaleString('en-US')} workers` : ''}</li>`)
        .join('')}</ul>`
    )
  }
  if (brief.hiring.openRoles > 0) {
    parts.push(
      `<p><b>Open roles on the NextChapter job board:</b> ${brief.hiring.openRoles.toLocaleString('en-US')}.</p>` +
        (brief.hiring.companies.length ? `<ul>${brief.hiring.companies.slice(0, 5).map((x) => `<li>${escapeHtml(x.name)}: ${x.roles}</li>`).join('')}</ul>` : '')
    )
  }
  if (brief.news.length > 0) {
    parts.push(`<p><b>In the news:</b></p><ul>${brief.news.slice(0, 4).map((n) => `<li><a href="${escapeHtml(n.url)}">${escapeHtml(n.title)}</a></li>`).join('')}</ul>`)
  }
  if (brief.funding.length > 0) {
    parts.push(`<p><b>Funding open to organizations like yours:</b></p><ul>${brief.funding.slice(0, 4).map((f) => `<li><a href="${escapeHtml(f.url)}">${escapeHtml(f.title)}</a>, ${escapeHtml(f.agency)}</li>`).join('')}</ul>`)
  }
  if (parts.length === 0) return null
  return `<p>Here is your ${escapeHtml(label)} brief for ${escapeHtml(brief.area.name)}. Counts only, never names, and no group smaller than 10 is shown.</p>${parts.join('')}`
}
