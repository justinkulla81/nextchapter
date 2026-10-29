// What a state's own unemployment agency says about taking a voluntary buyout, for the "offered a buyout" answer on a company page.
// Only states where an official page was read and says something about it are listed; every other state gets the general line and a link
// to that state's filing page (filingFacts). Checked October 2026. Wording is ours, each line names the agency and links the page it came from.
// To add a state: read the agency's own page, summarize it in one plain sentence, and add the URL. Never from a law-firm blog or news story.

export interface StateBuyoutRule { agency: string; text: string; url: string }

export const BUYOUT_UNEMPLOYMENT_CHECKED = 'October 2026'

export const BUYOUT_UNEMPLOYMENT: Record<string, StateBuyoutRule> = {
  AK: { agency: 'Alaska Department of Labor', url: 'https://labor.alaska.gov/unemployment/bpm/Voluntary_Leaving.pdf',
    text: 'Its policy manual says a bonus or severance payment offered for leaving does not by itself count as good cause for quitting, and its example is a worker who took a voluntary employer buyout.' },
  CA: { agency: 'California Employment Development Department', url: 'https://edd.ca.gov/en/UIBDG/Voluntary_Quit_VQ_360',
    text: 'Its decision guide says leaving to collect a pension or a payment the employer offers for leaving is generally not good cause. Severance pay by itself does not stop benefits.' },
  IN: { agency: 'Indiana Department of Workforce Development', url: 'https://www.in.gov/dwd/files/Claimant_Handbook.pdf',
    text: 'Its claimant handbook says employees who accept payment in exchange for voluntarily resigning or retiring are not eligible for benefits.' },
  MI: { agency: 'Michigan Unemployment Insurance Agency', url: 'https://www.michigan.gov/leo/bureaus-agencies/uia/tools/fact-sheets/accepting-a-buyout',
    text: 'It says accepting a buyout means choosing to end your employment, and it reviews the reason for leaving and the buyout terms case by case. There is no automatic answer.' },
  NY: { agency: 'New York Unemployment Insurance Appeal Board', url: 'https://uiappeals.ny.gov/bench-manual-part-2-chapter-1',
    text: 'Its manual treats taking an early retirement or voluntary workforce-reduction plan as leaving voluntarily. It can still count as good cause in some downsizing situations, so the facts matter.' },
  OK: { agency: 'Oklahoma Employment Security Commission', url: 'https://oklahoma.gov/content/dam/ok/en/oesc/documents/forms/OES-402.pdf',
    text: 'In one of its precedent decisions, taking an optional early retirement incentive when layoffs were not imminent was a voluntary quit without good cause.' },
  TX: { agency: 'Texas Workforce Commission', url: 'https://efte.twc.texas.gov/ui_law_qualification_issues.html',
    text: 'It notes that an early-leave or resignation incentive can lead to a voluntary-leaving disqualification, depending on the facts.' },
  WI: { agency: 'Wisconsin Department of Workforce Development', url: 'https://dwd.wisconsin.gov/uiben/reductions.htm',
    text: 'It says a voluntary retirement may be treated as a quit and can disqualify you even if no retirement payment is made.' },
}

export const buyoutRuleFor = (state: string | null | undefined): StateBuyoutRule | null => (state ? BUYOUT_UNEMPLOYMENT[state] ?? null : null)
