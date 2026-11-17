// One-line Dossier summaries for workforce demo participants (the employer Hiring page shows them), written per job title
// so a line fits the person, and enough per title that no two people in a demo share one. Fictional; no real companies.

export const DOSSIER_LINES_BY_TITLE: Record<string, string[]> = {
  'Operations Manager': [
    'Operations manager who ran a 200-person distribution center; strongest at cutting cost without cutting service.',
    'Operations manager who opened a second shift in six weeks and kept safety incidents at zero.',
    'Operations manager who took on-time delivery from 81% to 98% inside a year.',
    'Operations manager who rebuilt scheduling for three plants; wants a site where process matters.',
    'Operations manager who cut overtime by a quarter by fixing how work was handed between shifts.',
  ],
  'Senior Financial Analyst': [
    'Financial analyst moving into FP&A; turns messy data into a budget people trust.',
    'Senior analyst who built the monthly forecast a 600-person company planned around.',
    'Financial analyst who found $1.2M in duplicate vendor spend in one quarter.',
    'Senior analyst who helps close the books in four days and explains the numbers in plain words.',
    'Analyst who modeled a plant consolidation the board approved; looking for an FP&A lead role.',
  ],
  'Customer Experience Director': [
    'Customer experience director who rebuilt a contact center around one number: first-call resolution.',
    'Customer experience director who cut hold times in half while the team shrank by a fifth.',
    'CX director who launched chat and email support in 90 days for 40,000 customers.',
    'Customer experience director who turned complaint calls into a weekly product fix list.',
    'CX leader who built a 60-person team across two sites; wants a company that keeps service local.',
  ],
  'Logistics Supervisor': [
    'Logistics supervisor who cut late shipments by a third; ready for a site lead role.',
    'Logistics supervisor who ran inbound for a 300,000-square-foot warehouse on three shifts.',
    'Logistics supervisor who moved a dock team to scanners and ended lost-pallet write-offs.',
    'Logistics supervisor who trained 40 new hires each peak season and kept most of them through spring.',
  ],
  'HR Business Partner': [
    'HR business partner who led two reorganizations without losing a top performer.',
    'HR partner who cut time-to-hire from 52 to 30 days for hourly and salaried roles.',
    'HR business partner who built the first manager training program at a 900-person plant.',
    'HR partner who handled a union contract renewal with no grievances filed the next year.',
    'HR business partner who set up pay bands so offers stopped being negotiated one by one.',
    'HR partner who ran open enrollment for 1,200 people and moved it fully online.',
  ],
  'Marketing Manager': [
    'Marketing manager who doubled qualified leads on the same budget by dropping two channels.',
    'Marketing manager who relaunched a regional brand and grew repeat customers by a quarter.',
    'Marketing manager who built the email program from nothing to 30% of online sales.',
    'Marketing manager who runs tight launches; wants a product team that ships often.',
  ],
  'Software Engineer': [
    'Software engineer with eight years in claims systems; wants a local product team.',
    'Software engineer who moved a billing system to the cloud without a single missed invoice run.',
    'Engineer who builds internal tools people actually use; strongest in data pipelines.',
    'Software engineer who cut a nightly batch job from six hours to forty minutes.',
  ],
  'Claims Manager': [
    'Claims manager who cleared a 3,000-file backlog in four months without adding staff.',
    'Claims manager who cut average settlement time by nine days across a 25-person team.',
    'Claims manager who built the fraud review step that caught $800K in its first year.',
    'Claims lead who trains adjusters well; looking to run a regional claims office.',
  ],
  'Project Manager': [
    'Project manager who delivered a warehouse system rollout on time across four sites.',
    'Project manager who keeps engineering and finance on one plan; PMP certified.',
    'Project manager who ran a $4M plant upgrade and finished under budget.',
  ],
  'Account Executive': [
    'Account executive who grew a territory from $2M to $3.4M in two years.',
    'Account executive who wins mid-size manufacturing accounts and keeps them renewing.',
    'Account executive who opened 18 new logistics accounts in a year, mostly by referral.',
  ],
  'Data Analyst': [
    'Data analyst who built the dashboards a 300-person operation runs its morning meeting on.',
    'Data analyst who turned five spreadsheets into one weekly report people trust.',
    'Data analyst who forecast seasonal staffing within 3% two years running.',
  ],
  'Recent graduate': [
    'Recent accounting graduate who ran the books for a campus business with a $300K budget.',
    'New graduate in supply chain who interned on a distribution center floor two summers running.',
    'Recent business graduate who led a student consulting project for a local manufacturer.',
    'New computer science graduate who built a scheduling app the campus clinic still uses.',
    'Recent marketing graduate who grew a nonprofit’s volunteer sign-ups by half in one semester.',
    'New finance graduate who placed second in a regional case competition; wants a local start.',
  ],
  'Plant Controller': [
    'Plant controller who brought a standard-cost system to a plant that had none.',
    'Plant controller who cut month-end close from ten days to five.',
    'Plant controller who tracks scrap to the line and cut it by a fifth.',
  ],
}

const FALLBACK = [
  'Experienced professional who wants a local team and a role with room to grow.',
  'Steady performer known for training others and leaving a process better than they found it.',
]

// The n-th line for a title (n counts the people with that title who share, from 0). Wraps only past the list's end.
export function dossierLineFor(title: string, n: number): string {
  const lines = DOSSIER_LINES_BY_TITLE[title] ?? FALLBACK
  return lines[n % lines.length]
}
