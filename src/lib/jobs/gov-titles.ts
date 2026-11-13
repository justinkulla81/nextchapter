import type { SitemapJob } from '@/lib/jobs/gov-feed-core'

// The title screen shared by the government job feeds, and the NEOGOV sitemap reader. No database access.

// A title must name a professional or management role and must not be a trade, service, protective, clerical or labor role.
// Quality over volume: a white-collar job with an unusual title is skipped rather than let a blue-collar one in.
const NOT_WHITE_COLLAR = new RegExp(String.raw`\b(custodi\w+|janitor\w*|housekeep\w*|groundskeep\w*|labor\w*|mechanic\w*|welder|carpent\w*|painter|plumb\w*|electrician|hvac|line ?(man|worker|crew)|operator|operations? (aide|assistant)|heavy equipment|driver|chauffeur|refuse|sanitation|landfill|solid waste|crew|tree|arborist|forest(er)? (tech|aide)|firefighter|fire ?fighter|police|patrol|deputy|sheriff|correction\w*|detention|jail\w*|dispatch\w*|telecommunicator|lifeguard|cook|chef|baker|food|dietary|cafeteria|cashier|server|bartender|usher|seasonal|temporary|part[- ]time|substitute|sub|crossing guard|aide|attendant|assistant|clerk|clerical|receptionist|secretary|typist|data entry|mail|warehouse|stock\w*|courier|trades?|utility|maintenance|repair\w*|facilit\w*|custody|guard|security|ranger|lookout|laundry|meter|kennel|animal (care|control|shelter)|field (tech|worker|aide)|technician|tech|installer|inspector aide|worker|helper|apprentice|trainee|intern|student|volunteer|pool|on call|on-call|parking|gym|fitness|activities|pt|extra help|stipend|coach|referee|umpire|scorekeeper|paraprofessional|paraeducator|nursing assistant|cna|lpn|medical (assistant|records)|patient (care|support)|orderly|phlebotom\w*|pharmacy tech\w*|radiologic tech\w*|sterile)\b`, 'i')
const PROFESSIONAL = new RegExp(String.raw`\b(analyst|engineer\w*|manager|director|administrator|accountant|accounting|auditor|actuary|economist|statistician|planner|coordinator|specialist|architect|attorney|counsel|paralegal|legal|judge|magistrate|nurse|physician|psychiatrist|psychologist|pharmacist|dentist|veterinarian|therapist|dietitian|epidemiologist|social worker|counselor|clinician|librarian|archivist|curator|teacher|professor|lecturer|faculty|instructor|dean|provost|principal|superintendent|programmer|developer|software|devops|cyber\w*|network|database|gis|data|web|systems?|scientist|biologist|chemist|geologist|hydrologist|researcher|research|investigator|appraiser|assessor|surveyor|designer|writer|editor|producer|buyer|procurement|purchasing|contract\w*|grants?|budget|fiscal|finance|financial|treasurer|controller|payroll|human resources|hr|recruiter|compliance|risk|policy|program|project|consultant|advisor|adviser|liaison|executive|chief|president|vice president|administrator|supervisor|officer|communications?|public information|marketing|outreach|public health|health educator|caseworker|case manager|probation|parole|registrar|recorder|commissioner|ombudsman|strategist|strategy|operations)\b`, 'i')
const STILL_PROFESSIONAL = /\b(director|manager|chief|superintendent|attorney|counsel|engineer\w*|analyst|administrator|principal|dean|professor|teacher|librarian|accountant|physician|nurse)\b/
const SUPPORT_ROLE = /\b(police|fire|correction\w*|detention|jail\w*|sheriff|deputy|custodi\w+|mechanic\w*|maintenance|operator|driver|laborer|assistant)\b.*\b(officer|supervisor|technician|worker|specialist|aide|assistant|operator)\b/

export function isRelevantTitle(title: string): boolean {
  const t = title.toLowerCase()
  if (NOT_WHITE_COLLAR.test(t) && !STILL_PROFESSIONAL.test(t)) return false
  if (SUPPORT_ROLE.test(t)) return false
  return PROFESSIONAL.test(t)
}

export function parseSitemap(xml: string): SitemapJob[] {
  const out: SitemapJob[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.governmentjobs\.com\/jobs\/(\d+-\d+)\/([^<]*))<\/loc>/g)) {
    out.push({ id: m[2], url: m[1], title: m[3].replace(/-/g, ' ') })
  }
  return out
}


