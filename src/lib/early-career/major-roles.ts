// Major → entry-level roles. Pure and client-safe.
//
// O*NET has no major-to-occupation crosswalk we import, so this is a short
// curated map from common US majors to the entry-level titles new grads
// actually apply to, each tied to its O*NET-SOC occupation where one fits.
// The page joins the SOC code to the imported Occupation / OccupationSkill
// tables for skills, so the skill lists stay O*NET's, not ours.

export type EntryRole = { title: string; soc?: string }
export type MajorEntry = { key: string; label: string; aliases: string[]; roles: EntryRole[] }

export const MAJORS: MajorEntry[] = [
  {
    key: 'accounting',
    label: 'Accounting',
    aliases: ['accountancy'],
    roles: [
      { title: 'Staff accountant', soc: '13-2011.00' },
      { title: 'Audit associate', soc: '13-2011.00' },
      { title: 'Tax associate', soc: '13-2011.00' },
      { title: 'Financial analyst', soc: '13-2051.00' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance or economics',
    aliases: ['finance', 'economics', 'econ', 'financial', 'business economics'],
    roles: [
      { title: 'Financial analyst', soc: '13-2051.00' },
      { title: 'Credit analyst', soc: '13-2041.00' },
      { title: 'Budget analyst', soc: '13-2031.00' },
      { title: 'Investment banking analyst', soc: '13-2051.00' },
      { title: 'Risk analyst', soc: '13-2054.00' },
    ],
  },
  {
    key: 'business',
    label: 'Business or management',
    aliases: ['business', 'business administration', 'management', 'bba', 'commerce', 'entrepreneurship'],
    roles: [
      { title: 'Business analyst', soc: '13-1111.00' },
      { title: 'Operations analyst', soc: '13-1111.00' },
      { title: 'Project coordinator', soc: '13-1082.00' },
      { title: 'Management consulting analyst', soc: '13-1111.00' },
      { title: 'Sales development representative', soc: '41-4012.00' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing or communications',
    aliases: ['marketing', 'communications', 'communication', 'advertising', 'public relations', 'pr', 'journalism', 'media'],
    roles: [
      { title: 'Marketing coordinator', soc: '13-1161.00' },
      { title: 'Digital marketing specialist', soc: '13-1161.01' },
      { title: 'Public relations coordinator', soc: '27-3031.00' },
      { title: 'Content writer', soc: '27-3043.00' },
      { title: 'Market research analyst', soc: '13-1161.00' },
    ],
  },
  {
    key: 'computer_science',
    label: 'Computer science or software',
    aliases: ['computer science', 'cs', 'software engineering', 'computer engineering', 'computing'],
    roles: [
      { title: 'Software engineer', soc: '15-1252.00' },
      { title: 'QA engineer', soc: '15-1253.00' },
      { title: 'Systems analyst', soc: '15-1211.00' },
      { title: 'Web developer', soc: '15-1255.00' },
      { title: 'Database administrator', soc: '15-1242.00' },
    ],
  },
  {
    key: 'information_systems',
    label: 'Information systems or IT',
    aliases: ['mis', 'information technology', 'it', 'cybersecurity', 'cyber security', 'information science'],
    roles: [
      { title: 'IT support specialist', soc: '15-1231.00' },
      { title: 'Security analyst', soc: '15-1212.00' },
      { title: 'Systems analyst', soc: '15-1211.00' },
      { title: 'Network administrator', soc: '15-1231.00' },
    ],
  },
  {
    key: 'data',
    label: 'Data science, statistics or math',
    aliases: ['data science', 'statistics', 'mathematics', 'math', 'applied math', 'analytics', 'actuarial science'],
    roles: [
      { title: 'Data analyst', soc: '15-2051.01' },
      { title: 'Business intelligence analyst', soc: '15-2051.01' },
      { title: 'Junior data scientist', soc: '15-2051.00' },
      { title: 'Actuarial analyst', soc: '15-2011.00' },
      { title: 'Operations research analyst', soc: '15-2031.00' },
    ],
  },
  {
    key: 'mechanical_engineering',
    label: 'Mechanical or aerospace engineering',
    aliases: ['mechanical engineering', 'aerospace engineering', 'me'],
    roles: [
      { title: 'Mechanical engineer', soc: '17-2141.00' },
      { title: 'Manufacturing engineer', soc: '17-2112.03' },
      { title: 'Aerospace engineer', soc: '17-2011.00' },
      { title: 'Robotics engineer', soc: '17-2199.08' },
    ],
  },
  {
    key: 'electrical_engineering',
    label: 'Electrical engineering',
    aliases: ['electrical and computer engineering', 'ece', 'ee'],
    roles: [
      { title: 'Electrical engineer', soc: '17-2071.00' },
      { title: 'Electronics engineer', soc: '17-2072.00' },
      { title: 'Hardware engineer', soc: '17-2061.00' },
      { title: 'Controls engineer', soc: '17-2199.05' },
    ],
  },
  {
    key: 'civil_engineering',
    label: 'Civil or environmental engineering',
    aliases: ['civil engineering', 'environmental engineering', 'construction management'],
    roles: [
      { title: 'Civil engineer', soc: '17-2051.00' },
      { title: 'Environmental engineer', soc: '17-2081.00' },
      { title: 'Transportation engineer', soc: '17-2051.01' },
      { title: 'Project engineer', soc: '11-9021.00' },
    ],
  },
  {
    key: 'industrial_engineering',
    label: 'Industrial engineering or supply chain',
    aliases: ['industrial engineering', 'supply chain', 'operations management', 'logistics'],
    roles: [
      { title: 'Supply chain analyst', soc: '13-1081.02' },
      { title: 'Industrial engineer', soc: '17-2112.00' },
      { title: 'Logistics coordinator', soc: '13-1081.00' },
      { title: 'Buyer', soc: '13-1023.00' },
    ],
  },
  {
    key: 'chemistry_bio',
    label: 'Biology, chemistry or life sciences',
    aliases: ['biology', 'chemistry', 'biochemistry', 'life sciences', 'neuroscience', 'biomedical', 'biomedical engineering', 'chemical engineering'],
    roles: [
      { title: 'Clinical research coordinator', soc: '11-9121.01' },
      { title: 'Regulatory affairs associate', soc: '13-1041.07' },
      { title: 'Biomedical engineer', soc: '17-2031.00' },
      { title: 'Chemical engineer', soc: '17-2041.00' },
      { title: 'Bioinformatics technician', soc: '15-2099.01' },
    ],
  },
  {
    key: 'environmental',
    label: 'Environmental science or sustainability',
    aliases: ['environmental science', 'environmental studies', 'sustainability', 'geography', 'geology'],
    roles: [
      { title: 'Sustainability analyst', soc: '13-1199.05' },
      { title: 'Environmental compliance specialist', soc: '13-1041.01' },
      { title: 'GIS analyst', soc: '15-1299.02' },
      { title: 'Water resources specialist', soc: '11-9121.02' },
    ],
  },
  {
    key: 'psychology',
    label: 'Psychology or sociology',
    aliases: ['psychology', 'sociology', 'social work', 'human development', 'anthropology'],
    roles: [
      { title: 'Human resources coordinator', soc: '13-1071.00' },
      { title: 'Recruiting coordinator', soc: '13-1071.00' },
      { title: 'Market research analyst', soc: '13-1161.00' },
      { title: 'Training coordinator', soc: '13-1151.00' },
      { title: 'Program coordinator', soc: '11-9151.00' },
    ],
  },
  {
    key: 'political_science',
    label: 'Political science, public policy or pre-law',
    aliases: ['political science', 'public policy', 'government', 'international relations', 'pre-law', 'prelaw', 'history', 'legal studies'],
    roles: [
      { title: 'Policy analyst', soc: '13-1111.00' },
      { title: 'Compliance analyst', soc: '13-1041.00' },
      { title: 'Paralegal' },
      { title: 'Legislative aide' },
      { title: 'Fundraising coordinator', soc: '13-1131.00' },
    ],
  },
  {
    key: 'english',
    label: 'English, writing or humanities',
    aliases: ['english', 'writing', 'creative writing', 'philosophy', 'humanities', 'liberal arts', 'languages', 'linguistics'],
    roles: [
      { title: 'Content writer', soc: '27-3043.00' },
      { title: 'Editorial assistant', soc: '27-3041.00' },
      { title: 'Technical writer', soc: '27-3042.00' },
      { title: 'Communications coordinator', soc: '27-3031.00' },
      { title: 'Translator', soc: '27-3091.00' },
    ],
  },
  {
    key: 'design',
    label: 'Design or fine arts',
    aliases: ['graphic design', 'design', 'fine arts', 'art', 'industrial design', 'ux', 'architecture'],
    roles: [
      { title: 'Graphic designer', soc: '27-1024.00' },
      { title: 'UX/UI designer', soc: '15-1255.00' },
      { title: 'Product designer', soc: '27-1021.00' },
      { title: 'Junior architect', soc: '17-1011.00' },
    ],
  },
  {
    key: 'hr',
    label: 'Human resources',
    aliases: ['human resources', 'hr', 'human resource management', 'organizational behavior'],
    roles: [
      { title: 'HR coordinator', soc: '13-1071.00' },
      { title: 'Recruiter', soc: '13-1071.00' },
      { title: 'Compensation analyst', soc: '13-1141.00' },
      { title: 'Training coordinator', soc: '13-1151.00' },
    ],
  },
  {
    key: 'health_admin',
    label: 'Public health or health administration',
    aliases: ['public health', 'health administration', 'health sciences', 'healthcare management', 'nursing', 'kinesiology'],
    roles: [
      { title: 'Health services coordinator', soc: '11-9111.00' },
      { title: 'Clinical data coordinator', soc: '15-2051.02' },
      { title: 'Health informatics analyst', soc: '15-1211.01' },
      { title: 'Wellness coordinator', soc: '11-9179.01' },
    ],
  },
  {
    key: 'hospitality',
    label: 'Hospitality, events or sport management',
    aliases: ['hospitality', 'hotel management', 'event management', 'sport management', 'sports management', 'tourism'],
    roles: [
      { title: 'Event coordinator', soc: '13-1121.00' },
      { title: 'Hotel operations associate', soc: '11-9081.00' },
      { title: 'Account coordinator', soc: '41-3091.00' },
      { title: 'Recreation program coordinator', soc: '11-9072.00' },
    ],
  },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The major entry for a field of study as written on a résumé or typed in
 * ("B.S. Mechanical Engineering" → mechanical_engineering), or null. Longest
 * matching alias wins so "biomedical engineering" is not read as "engineering".
 */
export function majorForFieldOfStudy(field: string | null | undefined): MajorEntry | null {
  if (!field?.trim()) return null
  const f = ` ${norm(field)} `
  let best: { m: MajorEntry; len: number } | null = null
  for (const m of MAJORS) {
    for (const a of [m.label, ...m.aliases]) {
      const n = norm(a)
      if (n && f.includes(` ${n} `) && (!best || n.length > best.len)) best = { m, len: n.length }
    }
  }
  return best?.m ?? null
}

export function majorByKey(key: string | null | undefined): MajorEntry | null {
  return MAJORS.find((m) => m.key === key) ?? null
}
