// Which kinds of employees a reported layoff hit, when the headlines say. Pure; no model call, so it costs nothing per row.
// A state filing carries no job titles, so this is for reported layoffs only, and a headline that names no group yields none.

const RULES: { label: string; re: RegExp }[] = [
  { label: 'Engineers', re: /\b(software |hardware |data )?(engineers?|engineering|developers?|programmers?)\b/i },
  { label: 'Sales', re: /\b(sales|account executives?|business development)\b/i },
  { label: 'Customer support', re: /\b(customer (support|service|success)|call[- ]cent(er|re)|support (staff|agents?))\b/i },
  { label: 'Marketing', re: /\b(marketing|marketers|advertising|communications staff)\b/i },
  { label: 'HR and recruiting', re: /\b(recruiters?|recruiting|human resources|hr (staff|team))\b/i },
  { label: 'Managers', re: /\b(managers?|management|middle[- ]management|directors?)\b/i },
  { label: 'Executives', re: /\b(executives?|c-suite|vice presidents?|vps?)\b/i },
  { label: 'Corporate staff', re: /\b(corporate (staff|employees|workers|jobs|roles|positions)|headquarters (staff|employees)|office (staff|workers|employees)|white[- ]collar|salaried)\b/i },
  { label: 'Warehouse and logistics', re: /\b(warehouse|distribution cent(er|re)|fulfil?lment|logistics)\b/i },
  { label: 'Factory and plant', re: /\b(factory|plant (workers|employees)|manufacturing (workers|employees|jobs)|production (workers|employees)|assembly|blue[- ]collar)\b/i },
  { label: 'Retail and store', re: /\b(retail (workers|employees|staff|jobs)|store (workers|employees|staff|associates|managers)|stores? closing|store closures?)\b/i },
  { label: 'Drivers', re: /\b(drivers?|truckers?|couriers?)\b/i },
  { label: 'Healthcare', re: /\b(nurses?|nursing|clinicians?|clinical|physicians?|hospital (staff|workers|employees)|healthcare workers)\b/i },
  { label: 'Faculty and staff', re: /\b(faculty|professors?|teachers?|university staff|school staff)\b/i },
  { label: 'Researchers', re: /\b(researchers?|scientists?|research (staff|team|roles))\b/i },
  { label: 'Contractors', re: /\b(contractors?|contract (workers|staff|employees)|temp(orary)? workers|gig workers)\b/i },
  { label: 'Remote workers', re: /\b(remote (workers|employees|staff|roles)|work[- ]from[- ]home)\b/i },
]

const MAX = 3

/** Employee groups named in the headlines, in a fixed order, at most three. Empty when none is named. */
export function affectedRoles(headlines: (string | null | undefined)[]): string[] {
  const text = headlines.filter((h): h is string => !!h).join(' | ')
  if (!text) return []
  return RULES.filter((r) => r.re.test(text)).map((r) => r.label).slice(0, MAX)
}
