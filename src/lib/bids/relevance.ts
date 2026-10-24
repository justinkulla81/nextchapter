// Which bids and awards are about what NextChapter sells: workforce services, career and training programs,
// job-seeker technology. Pure; used to sort the CRM lists so a roof repair or a loan-servicing contract does not
// sit above a one-stop operator RFP. Tested in src/test/bid-relevance.test.ts.

const FIT = /\b(career|careers|workforce|one[- ]?stop|wioa|youth|adult|dislocated|reemploy|re-employ|employment|employer|job|jobs|training|trainer|skills?|ai|artificial|platform|software|app|apps|digital|website|web|technology|case management|assessment|outreach|marketing|education|apprentice\w*|navigation|reentry|re-entry|scsep|rapid response|resume|coaching|counsel\w*|transition|upskill\w*|reskill\w*)\b/i
const MISFIT = /\b(roof|hvac|window|windows|snow|ice removal|janitorial|tennis|tree|trees|lease|office space|real estate|audit|auditing|tax|insurance|legal|appraisal|engineering|construction|renovation|renovations|food|dining|lodging|bus|shelter|landfill|remedial|hydraulic|mystery shopping|title insurance|property|pest|paving)\b/i

export function bidFitsUs(title: string): boolean {
  return FIT.test(title) && !MISFIT.test(title)
}

const AWARD_FIT = /(employ|workforce|job|career|training|reentry|re-entry|apprentice|scsep|wioa|dislocated|unemploy|older workers|transition)/i

export function awardIsWorkforce(a: { agency: string | null; description: string | null }): boolean {
  return /labor/i.test(a.agency ?? '') || AWARD_FIT.test(a.description ?? '')
}
