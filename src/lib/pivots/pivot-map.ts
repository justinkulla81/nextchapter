// Market-based pivot paths: the map of where each kind of work can go next.
//
// Pure data plus a few lookups — no database, no LLM. Two kinds of entries:
//
// - ROLES: every role the map knows, with the title patterns that find it on the
//   board (market-stats.ts counts open jobs per role with these) and how
//   people-facing it is. Source roles (where a member comes from) and target
//   roles (where they could go) share this one catalog, so a target can be a
//   source too ("customer success" is both).
// - SOURCES: for each source role, its pivot edges — target, the skills that
//   carry over, which of the target's skill gaps the source already covers, a
//   time-to-pivot label, the pay path, how close the fit is, and one plain
//   sentence on why it works.
//
// Skills to add live on the target (`needs`), with the usual way to close each
// one, so every edge into a target shows the same gaps unless the source
// already covers them. pivot-map.test.ts checks the whole map for integrity.

import type { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

export type PrimaryFunction = (typeof PRIMARY_FUNCTION_OPTIONS)[number]

/** How much of the day is live contact with people. */
export type PeopleContact = 'HIGH' | 'MIXED' | 'LOW'

/** How a skill gap is usually closed. */
export type GapWay = 'certificate' | 'course' | 'portfolio' | 'practice'

export interface SkillGap {
  key: string
  label: string
  way: GapWay
  /** A typical, concrete way to close it ("Salesforce Trailhead admin trail, free"). */
  example: string
  /** Lowercase words that, in a member's skills/keywords/certifications, show they already have it. */
  evidence: string[]
}

export interface PivotRole {
  key: string
  label: string
  /** Our function taxonomy (PRIMARY_FUNCTION_OPTIONS), or null when the role sits outside it. */
  fn: PrimaryFunction | null
  /** Matched against lowercased job titles. */
  titles: RegExp
  /** Titles that must match `titles` (checked in tests). */
  examples: string[]
  people: PeopleContact
  /** Lots of "no" on the way to a big win: quota, commission, placements, gifts. */
  highRejectionHighUpside?: boolean
  /** Skills a newcomer usually has to add. Only meaningful for roles used as targets. */
  needs: SkillGap[]
  /** A plain caution about the role itself (e.g. being automated). */
  caution?: string
}

export type TimeToPivot = 'quick' | 'months' | 'longer'
export type PayPath = 'KEEP_SENIORITY' | 'RESET'
export type EdgeFit = 'close' | 'adjacent' | 'stretch'

export interface PivotEdge {
  to: string
  /** Skills that carry over, in plain words. */
  brings: string[]
  /** Keys of the target's `needs` this background already covers. */
  covers?: string[]
  time: TimeToPivot
  path: PayPath
  fit: EdgeFit
  why: string
}

export interface PivotSource {
  role: string
  /** Why this kind of work is under pressure, in plain words, when it is (allowlist; no blanket rule). */
  pressure?: string
  edges: PivotEdge[]
}

export const TIME_LABEL: Record<TimeToPivot, string> = {
  quick: 'Quick switch (weeks)',
  months: 'A few months',
  longer: 'Longer (6+ months)',
}

export const GAP_WAY_LABEL: Record<GapWay, string> = {
  certificate: 'Certificate',
  course: 'Course',
  portfolio: 'Portfolio piece',
  practice: 'Practice',
}

// ── Shared skill gaps ───────────────────────────────────────────────────────

const G = {
  crm: { key: 'crm', label: 'CRM fluency (Salesforce or HubSpot)', way: 'course', example: 'Salesforce Trailhead or HubSpot Academy sales courses (free)', evidence: ['salesforce', 'hubspot', 'crm', 'dynamics'] },
  quota: { key: 'quota', label: 'Owning a number (pipeline, forecast, quota)', way: 'practice', example: 'Build a 30/60/90-day pipeline plan for a target company and walk an interviewer through it', evidence: ['quota', 'pipeline', 'forecast', 'revenue target', 'business development'] },
  prospecting: { key: 'prospecting', label: 'Outbound prospecting', way: 'practice', example: 'Write and send a 3-touch outreach sequence to 20 real prospects; keep the reply rate', evidence: ['prospecting', 'cold calling', 'lead generation', 'outbound'] },
  discovery: { key: 'discovery', label: 'Sales discovery and negotiation', way: 'course', example: 'A short sales methodology course (MEDDIC, Challenger or SPIN)', evidence: ['negotiation', 'meddic', 'challenger', 'spin selling', 'closing'] },
  productKnowledge: { key: 'productKnowledge', label: 'Deep product knowledge in one industry', way: 'practice', example: 'Pick one vertical (HR tech, health tech, fintech) and learn its top 3 products hands-on', evidence: ['saas', 'software', 'platform'] },
  csPlatform: { key: 'csPlatform', label: 'Customer success tools and metrics (renewal, churn, NRR)', way: 'certificate', example: 'SuccessCOACHING CCSM Level 1 or Gainsight free courses', evidence: ['gainsight', 'churn', 'renewal', 'net revenue retention', 'nrr', 'customer success'] },
  projectMethod: { key: 'projectMethod', label: 'Project management method', way: 'certificate', example: 'Google Project Management Certificate, then CAPM or PMP', evidence: ['pmp', 'capm', 'project management', 'agile', 'scrum', 'prince2'] },
  agile: { key: 'agile', label: 'Agile delivery (Scrum, Jira)', way: 'certificate', example: 'Scrum.org PSM I or a Jira fundamentals course', evidence: ['scrum', 'agile', 'jira', 'kanban', 'psm', 'csm'] },
  sql: { key: 'sql', label: 'SQL and spreadsheet analysis', way: 'course', example: 'A free SQL course (Mode, Khan Academy) plus one analysis you can show', evidence: ['sql', 'excel', 'pivot tables', 'power query'] },
  bi: { key: 'bi', label: 'Dashboards (Tableau or Power BI)', way: 'portfolio', example: 'Publish one Tableau Public or Power BI dashboard on a real dataset', evidence: ['tableau', 'power bi', 'looker', 'dashboard'] },
  stats: { key: 'stats', label: 'Basic statistics', way: 'course', example: 'An intro statistics course (Coursera, Khan Academy)', evidence: ['statistics', 'regression', 'python'] },
  hrisSystem: { key: 'hrisSystem', label: 'HRIS administration (Workday, UKG, ADP)', way: 'certificate', example: 'Workday or UKG admin training, or an ADP/BambooHR admin project at work', evidence: ['workday', 'ukg', 'adp', 'bamboohr', 'successfactors', 'hris', 'oracle hcm'] },
  hrCert: { key: 'hrCert', label: 'HR credential', way: 'certificate', example: 'SHRM-CP or PHR', evidence: ['shrm', 'phr', 'sphr', 'shrm-cp', 'shrm-scp'] },
  compCert: { key: 'compCert', label: 'Compensation design and market pricing', way: 'certificate', example: 'WorldatWork CCP courses', evidence: ['ccp', 'worldatwork', 'compensation', 'total rewards', 'market pricing'] },
  instructional: { key: 'instructional', label: 'Instructional design (ADDIE, e-learning tools)', way: 'portfolio', example: 'Build one short Articulate Rise or Storyline module for a portfolio', evidence: ['articulate', 'storyline', 'instructional design', 'addie', 'e-learning', 'lms'] },
  facilitation: { key: 'facilitation', label: 'Workshop facilitation', way: 'practice', example: 'Run a one-hour workshop for a community group or former team and collect feedback', evidence: ['facilitation', 'training', 'workshop', 'coaching'] },
  financeModel: { key: 'financeModel', label: 'Financial modeling', way: 'course', example: 'A financial modeling course (CFI FMVA or Wall Street Prep basics)', evidence: ['financial modeling', 'fp&a', 'budgeting', 'forecasting', 'fmva'] },
  procurementCert: { key: 'procurementCert', label: 'Sourcing and procurement basics', way: 'certificate', example: 'ISM CPSM or APICS/ASCM CSCP', evidence: ['procurement', 'sourcing', 'cpsm', 'cscp', 'vendor management', 'purchasing'] },
  supplyChain: { key: 'supplyChain', label: 'Supply chain systems (ERP, inventory)', way: 'certificate', example: 'ASCM CPIM or SAP/Oracle ERP fundamentals', evidence: ['sap', 'erp', 'oracle', 'inventory', 'supply chain', 'cpim', 'logistics'] },
  productMethod: { key: 'productMethod', label: 'Product discovery and roadmapping', way: 'portfolio', example: 'Write one product brief: user problem, evidence, solution, metrics', evidence: ['product management', 'roadmap', 'user stories', 'product owner', 'cspo'] },
  uxResearch: { key: 'uxResearch', label: 'User research methods', way: 'portfolio', example: 'Run five user interviews on a real product and write up the findings', evidence: ['user research', 'usability', 'ux research', 'interviews'] },
  technical: { key: 'technical', label: 'Technical fluency (APIs, integrations, data)', way: 'course', example: 'An intro to APIs and SaaS integrations course; set up one Zapier or Postman workflow', evidence: ['api', 'integration', 'sql', 'python', 'javascript', 'technical'] },
  demo: { key: 'demo', label: 'Product demos and technical discovery', way: 'practice', example: 'Record a 10-minute demo of a product you know well', evidence: ['demo', 'presales', 'pre-sales', 'solutions'] },
  compliance: { key: 'compliance', label: 'Compliance framework knowledge', way: 'certificate', example: 'A CCEP, CRCM or CIPP certificate, depending on the industry', evidence: ['compliance', 'ccep', 'crcm', 'cipp', 'regulatory', 'audit', 'sox', 'hipaa'] },
  contracts: { key: 'contracts', label: 'Contract lifecycle management', way: 'certificate', example: 'World Commerce & Contracting fundamentals or NCMA CFCM', evidence: ['contracts', 'contract management', 'cfcm', 'ncma', 'clm'] },
  legalTech: { key: 'legalTech', label: 'Legal tech and e-discovery tools', way: 'course', example: 'Relativity or Ironclad user training', evidence: ['relativity', 'e-discovery', 'ediscovery', 'ironclad', 'clm'] },
  ehr: { key: 'ehr', label: 'EHR systems (Epic, Cerner)', way: 'certificate', example: 'Epic or Cerner analyst certification (often employer-sponsored)', evidence: ['epic', 'cerner', 'ehr', 'emr', 'meditech'] },
  informatics: { key: 'informatics', label: 'Health informatics credential', way: 'certificate', example: 'AMIA 10x10 course or ANCC informatics certification', evidence: ['informatics', 'amia', 'cphims'] },
  clinicalResearch: { key: 'clinicalResearch', label: 'Clinical research basics (GCP)', way: 'certificate', example: 'NIH or CITI Good Clinical Practice training (free or low cost)', evidence: ['gcp', 'clinical research', 'citi', 'irb'] },
  marketingOps: { key: 'marketingOps', label: 'Marketing automation (HubSpot, Marketo)', way: 'certificate', example: 'HubSpot Marketing Hub or Marketo certification', evidence: ['marketo', 'hubspot', 'pardot', 'marketing automation', 'eloqua'] },
  writingSamples: { key: 'writingSamples', label: 'Published writing samples', way: 'portfolio', example: 'Three short pieces for a real company or your own newsletter', evidence: ['content', 'copywriting', 'writing', 'editorial', 'blog'] },
  positioning: { key: 'positioning', label: 'Product positioning and messaging', way: 'portfolio', example: 'A one-page positioning doc for a product you know', evidence: ['positioning', 'messaging', 'product marketing', 'go-to-market', 'gtm'] },
  fundraisingCert: { key: 'fundraisingCert', label: 'Fundraising practice (donor research, CRM)', way: 'certificate', example: 'AFP fundraising courses; CFRE later', evidence: ['cfre', 'fundraising', 'donor', 'raisers edge', 'grant writing'] },
  sourcing: { key: 'sourcing', label: 'Candidate sourcing (LinkedIn Recruiter, Boolean)', way: 'course', example: 'LinkedIn Recruiter training or a Boolean sourcing course', evidence: ['sourcing', 'linkedin recruiter', 'boolean', 'applicant tracking', 'ats', 'greenhouse'] },
  govContracting: { key: 'govContracting', label: 'Federal acquisition basics (FAR, proposals)', way: 'course', example: 'An FAR fundamentals course and one proposal-writing sample (APMP Foundation)', evidence: ['far', 'dfars', 'apmp', 'proposal', 'government contracting', 'capture'] },
  security: { key: 'security', label: 'Security or risk credential', way: 'certificate', example: 'CompTIA Security+ or ASIS PSP, depending on the track', evidence: ['security+', 'cissp', 'psp', 'cpp', 'clearance', 'risk management'] },
  enablement: { key: 'enablement', label: 'Sales methodology and content creation', way: 'portfolio', example: 'Build a short onboarding module or call playbook for a sales team', evidence: ['enablement', 'playbook', 'sales training', 'onboarding'] },
  revopsTools: { key: 'revopsTools', label: 'CRM administration and reporting', way: 'certificate', example: 'Salesforce Administrator certification', evidence: ['salesforce administrator', 'salesforce admin', 'revops', 'sales operations', 'crm administration'] },
  eventsTools: { key: 'eventsTools', label: 'Event platforms and budgets', way: 'certificate', example: 'CMP (Certified Meeting Professional) or Cvent training', evidence: ['cmp', 'cvent', 'event management', 'event planning'] },
  communityTools: { key: 'communityTools', label: 'Community platforms and engagement metrics', way: 'course', example: 'CMX community courses; run a small online group for 60 days', evidence: ['community', 'discord', 'slack community', 'engagement'] },
  consultingFrameworks: { key: 'consultingFrameworks', label: 'Structured problem solving and slides', way: 'practice', example: 'Solve two case interviews and turn one into a 5-slide recommendation', evidence: ['consulting', 'strategy', 'case', 'powerpoint'] },
  cloud: { key: 'cloud', label: 'Cloud and automation (AWS or Azure, scripting, CI/CD)', way: 'certificate', example: 'AWS Certified Cloud Practitioner, then Solutions Architect Associate', evidence: ['aws', 'azure', 'gcp', 'terraform', 'ci/cd', 'python', 'powershell', 'bash', 'kubernetes'] },
  teachingCert: { key: 'teachingCert', label: 'Teaching license or alternative certification', way: 'certificate', example: 'Your state’s alternative certification route (e.g. Teach For America, TEACH-NOW) or a substitute license to start', evidence: ['teaching certificate', 'teaching license', 'certified teacher', 'substitute'] },
  designPortfolio: { key: 'designPortfolio', label: 'A design portfolio (Figma)', way: 'portfolio', example: 'Three case studies in Figma showing the problem, your process and the result', evidence: ['figma', 'portfolio', 'adobe', 'sketch', 'design'] },
  msw: { key: 'msw', label: 'Social work degree and license (MSW, LSW/LCSW)', way: 'certificate', example: 'An MSW program (many are part-time or online), then your state license', evidence: ['msw', 'lcsw', 'lsw', 'social work'] },
  itCert: { key: 'itCert', label: 'IT certification (CompTIA A+, Network+)', way: 'certificate', example: 'CompTIA A+, then Network+ or a Microsoft or Google IT certificate', evidence: ['comptia', 'a+', 'network+', 'help desk', 'active directory', 'it support'] },
  finLicense: { key: 'finLicense', label: 'Advisor licenses (Series 65/66 or 7, then CFP)', way: 'certificate', example: 'Series 65 or 66 to start; many firms sponsor the Series 7 and CFP coursework', evidence: ['series 7', 'series 65', 'series 66', 'cfp', 'finra'] },
  facilitiesCert: { key: 'facilitiesCert', label: 'Facilities or property credential', way: 'certificate', example: 'IFMA Facility Management Professional (FMP) or a state real estate or property management license', evidence: ['fmp', 'ifma', 'property management', 'real estate license', 'facilities'] },
  paralegalCert: { key: 'paralegalCert', label: 'Paralegal certificate', way: 'certificate', example: 'An ABA-approved paralegal certificate (many take under a year)', evidence: ['paralegal', 'legal assistant', 'litigation support'] },
  academy: { key: 'academy', label: 'Academy or certification for the service', way: 'certificate', example: 'Police academy, fire academy or EMT certification; veterans often get credit', evidence: ['academy', 'emt', 'police', 'firefighter', 'law enforcement'] },
  officeTools: { key: 'officeTools', label: 'Office tools and calendar management', way: 'course', example: 'Microsoft 365 or Google Workspace courses; manage a shared calendar and inbox for someone', evidence: ['excel', 'outlook', 'microsoft office', 'google workspace', 'scheduling', 'calendar'] },
  ml: { key: 'ml', label: 'Machine learning and Python', way: 'course', example: 'A machine learning course (fast.ai or Coursera ML) plus one model you can show', evidence: ['machine learning', 'python', 'scikit', 'tensorflow', 'pytorch', 'modeling'] },
  peopleMgmt: { key: 'peopleMgmt', label: 'Managing a team (1:1s, hiring, performance)', way: 'practice', example: 'Lead a project with two or three people, run weekly 1:1s, and mentor a junior colleague', evidence: ['manager', 'managed', 'mentoring', 'team lead', 'tech lead', 'hiring'] },
  mediaRelations: { key: 'mediaRelations', label: 'Media relations and press materials', way: 'portfolio', example: 'Write a press release and a media pitch for a real announcement', evidence: ['press release', 'media relations', 'public relations', 'journalist', 'reporter', 'editor'] },
  esg: { key: 'esg', label: 'Sustainability and impact reporting (GRI, SASB, ESG)', way: 'certificate', example: 'GRI Certified Sustainability Professional or the SASB FSA Level I', evidence: ['esg', 'sustainability', 'gri', 'sasb', 'csr', 'impact report'] },
  publicAdmin: { key: 'publicAdmin', label: 'Government hiring and public programs (USAJOBS, grants, policy memos)', way: 'practice', example: 'Write one two-page policy memo and a federal-style resume for a USAJOBS posting', evidence: ['policy', 'government', 'public administration', 'mpa', 'grants', 'legislative'] },
  programEval: { key: 'programEval', label: 'Program outcomes and evaluation (logic models, metrics)', way: 'course', example: 'A short program evaluation course; write a logic model for one program', evidence: ['program evaluation', 'logic model', 'outcomes', 'impact measurement', 'grants'] },
  studentServices: { key: 'studentServices', label: 'Student services systems and FERPA basics', way: 'course', example: 'NACADA or NASPA short courses; learn the student information system a target school uses', evidence: ['advising', 'admissions', 'student affairs', 'ferpa', 'banner', 'slate', 'registrar'] },
  devrel: { key: 'devrel', label: 'Public technical content (talks, posts, sample apps)', way: 'portfolio', example: 'Publish two technical posts and one sample app', evidence: ['developer relations', 'devrel', 'talks', 'open source', 'blog'] },
} satisfies Record<string, SkillGap>

// ── Role catalog ────────────────────────────────────────────────────────────

const ROLE_LIST: PivotRole[] = [
  // Sources that are mostly sources
  {
    key: 'recruiter', label: 'Recruiter', fn: 'Human Resources', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(recruiter|recruiting|talent acquisition|sourcer|talent partner)\b/,
    examples: ['Senior Technical Recruiter', 'Talent Acquisition Manager', 'Recruiting Coordinator'],
    needs: [G.sourcing, G.crm],
  },
  {
    key: 'hrbp', label: 'HR business partner', fn: 'Human Resources', people: 'HIGH',
    titles: /\b(hrbp|hr business partner|human resources business partner|people partner|people business partner|chief (people|human resources) officer|chro|head of people|vp,? (of )?(people|hr|human resources)|vice president,? (of )?(people|human resources))\b/,
    examples: ['Senior HR Business Partner', 'HRBP, Engineering', 'People Partner'],
    needs: [G.hrCert],
  },
  {
    key: 'hr_generalist', label: 'HR generalist', fn: 'Human Resources', people: 'MIXED',
    titles: /\b(hr|human resources) (generalist|manager|coordinator|specialist|director|administrator|assistant)\b|\bdirector of (hr|human resources)\b/,
    examples: ['HR Generalist', 'Human Resources Manager', 'HR Coordinator', 'Director of Human Resources'],
    needs: [G.hrCert],
  },
  {
    key: 'customer_service', label: 'Customer service and support', fn: 'Customer Success', people: 'HIGH',
    titles: /\b(customer service|customer care|call cent(er|re)|contact cent(er|re)|help ?desk|service desk|customer support (rep|representative|specialist|agent|associate|lead|manager|supervisor)|support (representative|agent|specialist))\b/,
    examples: ['Customer Service Representative', 'Call Center Supervisor', 'Customer Support Specialist', 'Contact Center Manager'],
    needs: [],
    caution: 'Scripted support work is being automated faster than almost any other job.',
  },
  {
    key: 'account_management', label: 'Account management', fn: 'Sales', people: 'HIGH',
    titles: /\b(account manager|key account|client (relationship|account) manager|relationship manager|account director|client partner)\b/,
    examples: ['Strategic Account Manager', 'Key Account Manager', 'Relationship Manager'],
    needs: [G.crm, G.quota],
  },
  {
    key: 'sales', label: 'Sales', fn: 'Sales', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(sales (rep|representative|manager|director|executive|associate|consultant|lead)|inside sales|outside sales|director of sales|head of sales|vp,? sales|vice president,? sales|territory (sales )?manager|vp of sales|vice president of sales|regional vice president,? (of )?sales|chief revenue officer|chief sales officer|account executive|sales executive)\b/,
    examples: ['Sales Manager', 'Inside Sales Representative', 'Director of Sales', 'Territory Sales Manager'],
    needs: [G.crm, G.quota],
  },
  {
    key: 'marketing', label: 'Marketing', fn: 'Marketing', people: 'MIXED',
    titles: /\b(marketing (manager|director|specialist|coordinator|lead|associate)|director of marketing|head of marketing|brand manager|demand generation|growth marketing|chief marketing officer|cmo|vp,? (of )?marketing|vice president,? (of )?marketing|chief growth officer|director of brand marketing|brand marketing)\b/,
    examples: ['Marketing Manager', 'Brand Manager', 'Director of Marketing', 'Demand Generation Manager'],
    needs: [G.positioning, G.marketingOps],
  },
  {
    key: 'operations', label: 'Operations', fn: 'Operations', people: 'MIXED',
    titles: /\b(operations (manager|director|lead|supervisor)|director of operations|head of operations|business operations|ops manager|general manager|vp,? (of )?operations|vice president,? (of )?operations|chief operating officer|chief operations officer|coo)\b/,
    examples: ['Operations Manager', 'Director of Operations', 'Business Operations Lead'],
    needs: [],
  },
  {
    key: 'project_program', label: 'Project and program management', fn: 'Operations', people: 'MIXED',
    titles: /\b(project (manager|coordinator|lead|director)|program (manager|director|lead)|programme manager|scrum master|pmo)\b/,
    examples: ['Project Manager', 'Senior Program Manager', 'Scrum Master'],
    needs: [G.projectMethod],
  },
  {
    key: 'finance_accounting', label: 'Finance and accounting', fn: 'Finance', people: 'LOW',
    titles: /\b(accountant|accounting (manager|supervisor|specialist|clerk)|controller|bookkeeper|auditor|finance manager|financial analyst|fp&a|accounts (payable|receivable)|chief financial officer|cfo|vp,? (of )?finance|vice president,? (of )?(finance|accounting)|head of finance|treasurer|director of finance|finance director|tax (director|manager|accountant)|chief accounting officer)\b/,
    examples: ['Senior Accountant', 'Assistant Controller', 'Financial Analyst', 'Accounts Payable Specialist'],
    needs: [G.financeModel],
  },
  {
    key: 'teaching', label: 'Teaching and education', fn: null, people: 'HIGH',
    titles: /\b(teacher|educator|instructor|professor|lecturer|tutor|school counselor|assistant principal|academic advisor)\b/,
    examples: ['High School Teacher', 'Adjunct Professor', 'Special Education Teacher'],
    needs: [G.teachingCert],
  },
  {
    key: 'nursing_clinical', label: 'Nursing and clinical care', fn: null, people: 'HIGH',
    titles: /\b(registered nurse|nurse|rn|lpn|nurse practitioner|clinician|therapist|medical assistant|pharmacist|physician assistant|chief nursing officer|clinical manager|dietitian|nurse manager|director of nursing|director of pharmacy)\b/,
    examples: ['Registered Nurse', 'ICU Nurse', 'Physical Therapist'],
    needs: [],
  },
  {
    key: 'admin_ea', label: 'Administrative and executive assistant', fn: 'Administration', people: 'MIXED',
    titles: /\b(executive assistant|administrative assistant|office manager|administrative (coordinator|specialist)|receptionist|office administrator)\b/,
    examples: ['Executive Assistant to the CEO', 'Administrative Assistant', 'Office Manager'],
    needs: [G.officeTools],
    caution: 'Office and admin support has some of the highest AI task exposure of any occupation group.',
  },
  {
    key: 'data_analytics', label: 'Data and analytics', fn: 'Data & Analytics', people: 'LOW',
    titles: /\b(data (analyst|scientist|engineer)|analytics (manager|lead|director|engineer)|business intelligence|bi (analyst|developer)|reporting analyst)\b/,
    examples: ['Data Analyst', 'Senior Data Scientist', 'Business Intelligence Developer'],
    needs: [G.sql, G.bi],
  },
  {
    key: 'engineering', label: 'Software engineering', fn: 'Engineering', people: 'LOW',
    titles: /\b(software (engineer|developer)|developer|devops|site reliability|full[- ]stack|front[- ]?end|back[- ]?end|engineering manager|software (development|dev) engineer|vp,? (of )?engineering|vice president,? (of )?engineering|chief technology officer|cto|ai engineer|ml engineer|platform engineer|test engineer|automation engineer|forward deployed engineer|technical architect|head of ai|systems? development engineer|application (engineer|developer))\b/,
    examples: ['Senior Software Engineer', 'Full Stack Developer', 'Engineering Manager'],
    needs: [G.cloud, G.technical],
  },
  {
    key: 'product', label: 'Product management', fn: 'Product', people: 'MIXED',
    titles: /\b(product manager|product owner|product lead|director of product|head of product|group product manager)\b/,
    examples: ['Senior Product Manager', 'Product Owner', 'Director of Product'],
    needs: [G.productMethod, G.agile],
  },
  {
    key: 'design', label: 'Design', fn: 'Design', people: 'LOW',
    titles: /\b(designer|ux|ui|creative director|design (lead|manager|director)|head of design)\b/,
    examples: ['Product Designer', 'UX Designer', 'Creative Director'],
    needs: [G.designPortfolio],
  },
  {
    key: 'legal', label: 'Legal', fn: 'Legal', people: 'MIXED',
    titles: /\b(attorney|lawyer|counsel|paralegal|legal (assistant|secretary|specialist)|general counsel|chief legal officer|head of legal)\b/,
    examples: ['Corporate Attorney', 'Senior Counsel', 'Paralegal'],
    needs: [G.paralegalCert],
  },
  {
    key: 'executive', label: 'Executive and founder', fn: null, people: 'MIXED',
    titles: /\b(chief executive officer|ceo|president|founder|co-founder|owner|general manager|managing director|managing partner|partner|board member|executive vice president|evp|svp|senior vice president|vice president|vp)\b/,
    examples: ['Chief Executive Officer', 'Founder', 'General Manager', 'Senior Vice President'],
    needs: [],
  },
  {
    key: 'physical_engineering', label: 'Engineering (mechanical, electrical, civil, manufacturing)', fn: null, people: 'LOW',
    titles: /\b(mechanical engineer|electrical engineer|civil engineer|manufacturing engineer|process engineer|quality engineer|project engineer|design engineer|industrial engineer|structural engineer|chemical engineer|systems engineer|hardware engineer|product engineer|director of manufacturing|plant (director|manager)|environmental (engineer|specialist))\b/,
    examples: ['Mechanical Engineer', 'Electrical Engineer', 'Manufacturing Engineer', 'Civil Engineer'],
    needs: [],
  },
  {
    key: 'it_infrastructure', label: 'IT and infrastructure', fn: null, people: 'MIXED',
    titles: /\b(it (specialist|manager|director|support|technician|analyst|administrator)|help ?desk|desktop support|network (engineer|administrator)|systems administrator|sysadmin|it operations|technical support (specialist|engineer))\b/,
    examples: ['IT Specialist', 'Network Engineer', 'Systems Administrator', 'Help Desk Technician'],
    needs: [G.itCert],
  },
  {
    key: 'financial_advisor', label: 'Financial advising and wealth management', fn: null, people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(financial (advisor|adviser|planner)|wealth (manager|advisor|management)|private (banker|wealth)|investment advisor|branch manager|relationship banker|insurance (agent|advisor))\b/,
    examples: ['Financial Advisor', 'Wealth Manager', 'Private Banker', 'Relationship Banker'],
    needs: [G.finLicense],
  },
  {
    key: 'social_work', label: 'Social work and counseling', fn: null, people: 'HIGH',
    titles: /\b(social worker|lcsw|msw|mental health counselor|substance abuse counselor|family (advocate|support specialist)|child welfare|behavioral health (specialist|counselor|clinician))\b/,
    examples: ['Social Worker', 'Mental Health Counselor', 'Child Welfare Specialist'],
    needs: [G.msw],
  },
  {
    key: 'facilities_real_estate', label: 'Facilities, property and real estate', fn: null, people: 'MIXED',
    titles: /\b(facilit(y|ies) (manager|director|administrator|coordinator)|property manager|real estate (agent|broker|manager)|leasing (manager|agent|consultant)|maintenance manager|building manager|site manager)\b/,
    examples: ['Facilities Manager', 'Property Manager', 'Real Estate Agent', 'Maintenance Manager'],
    needs: [G.facilitiesCert],
  },
  {
    key: 'physician', label: 'Physicians and medical leadership', fn: null, people: 'HIGH',
    titles: /\b(physician|medical director|chief medical officer|hospitalist|surgeon|psychiatrist|pediatrician|chief clinical officer|medical officer)\b/,
    examples: ['Physician', 'Medical Director', 'Chief Medical Officer', 'Hospitalist'],
    needs: [],
  },
  {
    key: 'clergy', label: 'Clergy and chaplaincy', fn: null, people: 'HIGH',
    titles: /\b(pastor|minister|chaplain|priest|rabbi|imam|clergy|worship leader)\b/,
    examples: ['Pastor', 'Hospital Chaplain', 'Youth Minister'],
    needs: [],
  },
  {
    key: 'public_safety', label: 'Police, fire and emergency services', fn: null, people: 'HIGH',
    titles: /\b(police (officer|sergeant|lieutenant|captain|chief|detective)|chief of police|firefighter|fire (chief|captain|lieutenant|marshal)|paramedic|emt|sheriff|deputy sheriff|corrections officer|state trooper|dispatcher)\b/,
    examples: ['Police Officer', 'Fire Captain', 'Paramedic', 'Chief of Police'],
    needs: [G.academy],
  },
  {
    key: 'scientist', label: 'Science and research', fn: null, people: 'LOW',
    titles: /\b((?<!data )scientist|chemist|biologist|microbiologist|physicist|biostatistician|lab(oratory)? (manager|technician|director)|research associate)\b/,
    examples: ['Research Scientist', 'Chemist', 'Laboratory Manager', 'Biostatistician'],
    needs: [],
  },
  {
    key: 'food_service', label: 'Food service and restaurants', fn: null, people: 'HIGH',
    titles: /\b(food (service )?(manager|director|supervisor)|restaurant (manager|general manager)|chef|sous chef|kitchen manager|dietary (director|manager)|catering (manager|director))\b/,
    examples: ['Restaurant Manager', 'Executive Chef', 'Food Service Director', 'Kitchen Manager'],
    needs: [],
  },
  {
    key: 'data_scientist', label: 'Data science and machine learning', fn: 'Data & Analytics', people: 'LOW',
    titles: /\b(data scientist|machine learning (engineer|scientist)|ml engineer|applied scientist)\b/,
    examples: ['Data Scientist', 'Machine Learning Engineer', 'Applied Scientist'],
    needs: [G.ml, G.stats],
  },
  {
    key: 'engineering_manager', label: 'Engineering management', fn: 'Engineering', people: 'MIXED',
    titles: /\b(engineering manager|software development manager|director of engineering|head of engineering|manager,? software engineering)\b/,
    examples: ['Engineering Manager', 'Director of Engineering', 'Software Development Manager'],
    needs: [G.peopleMgmt],
  },
  {
    key: 'journalism', label: 'Journalism and editorial', fn: null, people: 'MIXED',
    titles: /\b(journalist|reporter|correspondent|news (producer|editor|anchor)|managing editor|editor[- ]in[- ]chief|copy editor|columnist|broadcast producer)\b/,
    examples: ['Reporter', 'Managing Editor', 'News Producer', 'Correspondent'],
    needs: [G.writingSamples],
  },
  {
    key: 'communications', label: 'Communications and PR', fn: 'Marketing', people: 'MIXED',
    titles: /\b(public relations|pr (manager|specialist|director)|media relations|corporate communications|press secretary|spokesperson|director of communications|communications (director|lead))\b/,
    examples: ['Public Relations Manager', 'Corporate Communications Director', 'Media Relations Specialist'],
    needs: [G.mediaRelations, G.writingSamples],
  },
  {
    key: 'nonprofit_programs', label: 'Nonprofit programs and leadership', fn: null, people: 'MIXED',
    titles: /\b(nonprofit|non-profit|executive director|outreach (coordinator|manager|director)|community programs?|case manager|grants? (manager|coordinator|writer)|program (director|coordinator)|chief program officer)\b/,
    examples: ['Nonprofit Program Manager', 'Executive Director', 'Outreach Coordinator', 'Grants Manager'],
    needs: [G.programEval],
  },
  {
    key: 'csr', label: 'Corporate social responsibility and sustainability', fn: null, people: 'MIXED',
    titles: /\b(corporate social responsibility|csr|sustainability (manager|director|lead|analyst|specialist)|esg (manager|analyst|lead)|social impact|community (investment|relations) manager|foundation program officer)\b/,
    examples: ['Corporate Social Responsibility Manager', 'Sustainability Manager', 'Social Impact Lead', 'ESG Analyst'],
    needs: [G.esg, G.programEval],
  },
  {
    key: 'public_sector', label: 'Government programs and policy', fn: null, people: 'MIXED',
    titles: /\b(policy (analyst|advisor|director)|program analyst|public administrator|city manager|government affairs|legislative (aide|assistant|director)|grants management specialist|public health (program|manager|analyst)|county administrator|public works director|deputy director|administrative officer)\b/,
    examples: ['Policy Analyst', 'Program Analyst', 'Legislative Aide', 'Government Affairs Manager'],
    needs: [G.publicAdmin],
  },
  {
    key: 'education_admin', label: 'Education administration and student services', fn: null, people: 'HIGH',
    titles: /\b(academic advis(or|er)|admissions (counselor|officer|director|manager)|student (affairs|services|success)|registrar|dean of|school administrator|principal|career (counselor|advisor|coach)|financial aid (officer|counselor|director)|enrollment (manager|director)|student programs?|dean|director of admissions|chief academic officer)\b/,
    examples: ['Academic Advisor', 'Admissions Counselor', 'Director of Student Affairs', 'Assistant Principal'],
    needs: [G.studentServices],
  },
  {
    key: 'investment', label: 'Investment banking and investing', fn: 'Finance', people: 'MIXED',
    titles: /\b(investment bank(ing|er)|private equity|venture capital|investment (analyst|associate|manager|professional)|portfolio manager|equity research|hedge fund|m&a (analyst|associate))\b/,
    examples: ['Investment Banking Associate', 'Private Equity Associate', 'Equity Research Analyst', 'Portfolio Manager'],
    needs: [G.financeModel],
  },
  {
    key: 'corporate_development', label: 'Corporate development and strategy', fn: 'Finance', people: 'MIXED',
    titles: /\b(corporate development|corp dev|m&a (manager|director|lead)|corporate strategy|strategic finance)\b/,
    examples: ['Corporate Development Manager', 'Director of Corporate Strategy', 'M&A Manager'],
    needs: [G.financeModel, G.consultingFrameworks],
  },
  {
    key: 'consulting', label: 'Consulting', fn: 'Operations', people: 'MIXED',
    titles: /\b(management consultant|strategy consultant|business consultant|transformation consultant|engagement manager|consulting manager)\b/,
    examples: ['Management Consultant', 'Strategy Consultant', 'Engagement Manager'],
    needs: [G.consultingFrameworks],
  },
  {
    key: 'retail_management', label: 'Retail store management', fn: null, people: 'HIGH',
    titles: /\b(store manager|retail (manager|supervisor)|district manager|assistant store manager|store director)\b/,
    examples: ['Store Manager', 'District Manager', 'Assistant Store Manager'],
    needs: [],
  },
  {
    key: 'hospitality', label: 'Hospitality', fn: null, people: 'HIGH',
    titles: /\b(hotel|hospitality|restaurant (manager|general manager)|food (and|&) beverage|front desk|guest services|catering manager)\b/,
    examples: ['Hotel General Manager', 'Restaurant Manager', 'Guest Services Manager'],
    needs: [],
  },
  {
    key: 'military_government', label: 'Military and government', fn: null, people: 'MIXED',
    titles: /\b(army|navy|air force|marine corps|coast guard|military|veteran|federal government|public administrator|government (analyst|program))\b/,
    examples: ['Army Officer', 'Navy Logistics Specialist', 'Government Program Analyst'],
    needs: [],
  },

  // Targets
  {
    key: 'account_executive', label: 'Account executive', fn: 'Sales', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(account executive|sales executive|enterprise sales|mid-market sales|inside sales (rep|representative|executive))\b/,
    examples: ['Account Executive', 'Enterprise Account Executive', 'Mid-Market Sales Executive'],
    needs: [G.crm, G.quota, G.prospecting, G.discovery, G.productKnowledge],
  },
  {
    key: 'sales_development', label: 'Sales development', fn: 'Sales', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(sales development|business development (rep|representative)|sdr|bdr|lead development)\b/,
    examples: ['Sales Development Representative', 'BDR', 'Business Development Representative'],
    needs: [G.crm, G.prospecting],
    caution: 'Entry-level outbound work is being automated quickly; treat it as a 6 to 12 month bridge into a closing role.',
  },
  {
    key: 'business_development', label: 'Business development', fn: 'Sales', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(business development (manager|director|lead|executive|associate)|director of business development|head of business development|biz ?dev|vp,? (of )?business development|vice president,? (of )?business development)\b/,
    examples: ['Business Development Manager', 'Director of Business Development'],
    needs: [G.crm, G.quota, G.prospecting],
  },
  {
    key: 'partnerships', label: 'Partnerships', fn: 'Sales', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(partnerships?|channel (manager|sales|account manager)|alliances? (manager|director)|partner (manager|development))\b/,
    examples: ['Partnerships Manager', 'Channel Sales Manager', 'Strategic Alliances Director', 'Partner Manager'],
    needs: [G.crm, G.quota],
  },
  {
    key: 'search_firm_consultant', label: 'Search-firm or agency recruiting consultant', fn: 'Human Resources', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(executive search|search consultant|search associate|agency recruiter|recruitment consultant|staffing (manager|consultant|account manager)|placement specialist)\b/,
    examples: ['Executive Search Consultant', 'Recruitment Consultant', 'Staffing Account Manager'],
    needs: [G.quota, G.prospecting],
  },
  {
    key: 'fundraising', label: 'Fundraising and development', fn: null, people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(development (officer|director|manager|associate)|director of development|major gifts|fundrais\w*|philanthropy|advancement (officer|director)|annual giving)\b/,
    examples: ['Major Gifts Officer', 'Director of Development', 'Fundraising Manager'],
    needs: [G.fundraisingCert],
  },
  {
    key: 'customer_success', label: 'Customer success', fn: 'Customer Success', people: 'HIGH',
    titles: /\b(customer success|client success|customer experience manager)\b/,
    examples: ['Customer Success Manager', 'Senior Client Success Manager'],
    needs: [G.csPlatform, G.crm, G.productKnowledge],
  },
  {
    key: 'account_manager', label: 'Account manager', fn: 'Sales', people: 'HIGH',
    titles: /\b(account manager|key account|client (relationship|account) manager|relationship manager)\b/,
    examples: ['Account Manager', 'Key Account Manager', 'Client Relationship Manager'],
    needs: [G.crm, G.quota],
  },
  {
    key: 'implementation', label: 'Implementation and onboarding', fn: 'Customer Success', people: 'MIXED',
    titles: /\b(implementation (manager|specialist|consultant|lead|analyst)|onboarding (manager|specialist|consultant)|deployment (manager|specialist)|professional services consultant)\b/,
    examples: ['Implementation Manager', 'Customer Onboarding Specialist', 'Implementation Consultant'],
    needs: [G.technical, G.projectMethod, G.productKnowledge],
  },
  {
    key: 'solutions_consulting', label: 'Solutions consulting and sales engineering', fn: 'Sales', people: 'MIXED',
    titles: /\b(solutions? (consultant|engineer|architect)|sales engineer|pre-?sales)\b/,
    examples: ['Solutions Consultant', 'Sales Engineer', 'Presales Consultant'],
    needs: [G.technical, G.demo, G.productKnowledge],
  },
  {
    key: 'support_operations', label: 'Support operations', fn: 'Customer Success', people: 'LOW',
    titles: /\b(support operations|(customer|client) (support|service|experience) operations|cx operations|workforce management|support (manager|team lead)|quality analyst)\b/,
    examples: ['Support Operations Manager', 'Workforce Management Analyst', 'CX Operations Lead'],
    needs: [G.sql, G.bi, G.technical],
  },
  {
    key: 'people_operations', label: 'People operations', fn: 'Human Resources', people: 'MIXED',
    titles: /\b(people operations|hr operations|people ops|employee experience|hr shared services)\b/,
    examples: ['People Operations Manager', 'HR Operations Specialist', 'Employee Experience Lead'],
    needs: [G.hrisSystem, G.hrCert],
  },
  {
    key: 'hris', label: 'HRIS and people systems', fn: 'Human Resources', people: 'LOW',
    titles: /\b(hris|hr systems|hr technology|people systems|workday (analyst|consultant|administrator)|hcm (analyst|consultant))\b/,
    examples: ['HRIS Analyst', 'Workday Analyst', 'People Systems Manager'],
    needs: [G.hrisSystem, G.sql],
  },
  {
    key: 'people_analytics', label: 'People analytics', fn: 'Data & Analytics', people: 'LOW',
    titles: /\b(people analytics|workforce (analytics|planning)|hr analytics|talent analytics|hr data analyst)\b/,
    examples: ['People Analytics Manager', 'Workforce Planning Analyst', 'HR Data Analyst'],
    needs: [G.sql, G.bi, G.stats],
  },
  {
    key: 'learning_development', label: 'Learning and development', fn: 'Human Resources', people: 'MIXED',
    titles: /\b(learning (and|&) development|l&d|training (manager|specialist|coordinator|director)|talent development|learning (manager|specialist|partner))\b/,
    examples: ['Learning and Development Manager', 'Training Specialist', 'Talent Development Lead'],
    needs: [G.instructional, G.facilitation],
  },
  {
    key: 'instructional_design', label: 'Instructional design', fn: 'Human Resources', people: 'LOW',
    titles: /\b(instructional design\w*|learning experience design\w*|curriculum (developer|designer)|e-?learning (developer|designer))\b/,
    examples: ['Instructional Designer', 'Learning Experience Designer', 'Curriculum Developer'],
    needs: [G.instructional],
  },
  {
    key: 'compensation', label: 'Compensation and total rewards', fn: 'Human Resources', people: 'LOW',
    titles: /\b(compensation (analyst|manager|partner|specialist|director)|total rewards|benefits (manager|analyst|specialist))\b/,
    examples: ['Compensation Analyst', 'Total Rewards Manager', 'Benefits Manager'],
    needs: [G.compCert, G.sql],
  },
  {
    key: 'talent_acquisition', label: 'Recruiting (in-house)', fn: 'Human Resources', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(recruiter|talent acquisition|recruiting (manager|coordinator|lead)|campus recruit\w*)\b/,
    examples: ['Corporate Recruiter', 'Talent Acquisition Partner', 'Campus Recruiter'],
    needs: [G.sourcing],
  },
  {
    key: 'sales_enablement', label: 'Sales enablement', fn: 'Sales', people: 'MIXED',
    titles: /\b(sales enablement|revenue enablement|enablement (manager|lead|specialist|director)|sales trainer)\b/,
    examples: ['Sales Enablement Manager', 'Revenue Enablement Lead'],
    needs: [G.enablement, G.crm],
  },
  {
    key: 'revenue_operations', label: 'Revenue and sales operations', fn: 'Sales', people: 'LOW',
    titles: /\b(revenue operations|revops|sales operations|salesforce (administrator|admin)|crm (manager|administrator|analyst)|go-to-market operations)\b/,
    examples: ['Revenue Operations Manager', 'Sales Operations Analyst', 'Salesforce Administrator'],
    needs: [G.revopsTools, G.sql],
  },
  {
    key: 'program_management', label: 'Program management', fn: 'Operations', people: 'MIXED',
    titles: /\b(program manager|programme manager|program director|pmo (manager|lead|director)|portfolio manager, (programs|projects))\b/,
    examples: ['Program Manager', 'Senior Program Manager', 'PMO Lead'],
    needs: [G.projectMethod, G.agile],
  },
  {
    key: 'project_management', label: 'Project management', fn: 'Operations', people: 'MIXED',
    titles: /\b(project manager|project coordinator|project lead|delivery manager|scrum master)\b/,
    examples: ['Project Manager', 'IT Project Coordinator', 'Delivery Manager'],
    needs: [G.projectMethod],
  },
  {
    key: 'technical_program_management', label: 'Technical program management', fn: 'Operations', people: 'MIXED',
    titles: /\b(technical program manager|tpm|technical project manager)\b/,
    examples: ['Technical Program Manager', 'Senior Technical Project Manager'],
    needs: [G.agile, G.projectMethod],
  },
  {
    key: 'operations_management', label: 'Operations management and chief of staff', fn: 'Operations', people: 'MIXED',
    titles: /\b(operations manager|business operations|director of operations|head of operations|chief of staff|strategy (and|&) operations|vp,? (of )?operations|vice president,? (of )?operations|chief operating officer|coo)\b/,
    examples: ['Operations Manager', 'Chief of Staff', 'Business Operations Manager'],
    needs: [G.sql, G.projectMethod],
  },
  {
    key: 'procurement', label: 'Procurement and vendor management', fn: 'Operations', people: 'MIXED',
    titles: /\b(procurement|purchasing (manager|agent|specialist)|sourcing (manager|specialist|analyst)|buyer|vendor management|category manager)\b/,
    examples: ['Procurement Manager', 'Strategic Sourcing Specialist', 'Senior Buyer'],
    needs: [G.procurementCert],
  },
  {
    key: 'logistics_supply_chain', label: 'Logistics and supply chain', fn: 'Operations', people: 'MIXED',
    titles: /\b(logistics|supply chain|distribution|fulfillment|inventory|transportation) (manager|analyst|coordinator|specialist|director|planner|supervisor)\b|\bdemand planner\b|\bdirector of (supply chain|transportation|logistics)\b|\blogistics management specialist\b/,
    examples: ['Logistics Manager', 'Supply Chain Analyst', 'Demand Planner'],
    needs: [G.supplyChain, G.sql],
  },
  {
    key: 'fpa', label: 'Financial planning and analysis', fn: 'Finance', people: 'LOW',
    titles: /\b(fp&a|financial planning|financial analyst|finance (manager|business partner)|budget analyst)\b/,
    examples: ['FP&A Manager', 'Senior Financial Analyst', 'Finance Business Partner'],
    needs: [G.financeModel, G.sql],
  },
  {
    key: 'business_analyst', label: 'Business analysis', fn: 'Data & Analytics', people: 'MIXED',
    titles: /\b(business analyst|business systems analyst|process analyst|operations analyst|business process (analyst|manager))\b/,
    examples: ['Business Analyst', 'Business Systems Analyst', 'Operations Analyst'],
    needs: [G.sql, G.bi],
  },
  {
    key: 'data_analyst', label: 'Data analyst', fn: 'Data & Analytics', people: 'LOW',
    titles: /\b(data analyst|bi analyst|business intelligence (analyst|developer)|reporting analyst|analytics (analyst|manager))\b/,
    examples: ['Data Analyst', 'BI Analyst', 'Reporting Analyst'],
    needs: [G.sql, G.bi, G.stats],
  },
  {
    key: 'product_management', label: 'Product management', fn: 'Product', people: 'MIXED',
    titles: /\b(product manager|product owner|associate product manager)\b/,
    examples: ['Product Manager', 'Associate Product Manager', 'Product Owner'],
    needs: [G.productMethod, G.agile, G.technical],
  },
  {
    key: 'product_operations', label: 'Product operations', fn: 'Product', people: 'MIXED',
    titles: /\b(product operations|product ops|release manager)\b/,
    examples: ['Product Operations Manager', 'Release Manager'],
    needs: [G.agile, G.sql],
  },
  {
    key: 'ux_research', label: 'UX research', fn: 'Design', people: 'MIXED',
    titles: /\b(ux research\w*|user research\w*|design research\w*|usability (analyst|researcher))\b/,
    examples: ['UX Researcher', 'User Research Lead'],
    needs: [G.uxResearch],
  },
  {
    key: 'compliance', label: 'Compliance and risk', fn: 'Legal', people: 'LOW',
    titles: /\b(compliance (analyst|manager|officer|specialist|director)|risk (analyst|manager)|regulatory (affairs|specialist|analyst)|privacy (analyst|manager|officer)|director of (compliance|quality)|quality assurance (specialist|manager)|chief (risk|compliance) officer)\b/,
    examples: ['Compliance Manager', 'Risk Analyst', 'Regulatory Affairs Specialist'],
    needs: [G.compliance],
  },
  {
    key: 'contracts_management', label: 'Contracts management', fn: 'Legal', people: 'MIXED',
    titles: /\b(contracts? (manager|administrator|specialist|negotiator|analyst)|contract management)\b/,
    examples: ['Contract Manager', 'Contracts Administrator', 'Contract Negotiator'],
    needs: [G.contracts],
  },
  {
    key: 'legal_operations', label: 'Legal operations', fn: 'Legal', people: 'LOW',
    titles: /\b(legal operations|legal ops|e-?discovery|legal project manager|litigation support)\b/,
    examples: ['Legal Operations Manager', 'eDiscovery Analyst', 'Legal Project Manager'],
    needs: [G.legalTech, G.projectMethod],
  },
  {
    key: 'clinical_operations', label: 'Clinical operations and care coordination', fn: null, people: 'MIXED',
    titles: /\b(clinical operations|clinical research (coordinator|associate)|care coordinat\w*|utilization (review|management)|case manager|patient experience|revenue cycle|director of rehab\w*)\b/,
    examples: ['Clinical Research Coordinator', 'Care Coordinator', 'Utilization Review Nurse'],
    needs: [G.clinicalResearch],
  },
  {
    key: 'clinical_informatics', label: 'Clinical informatics', fn: null, people: 'LOW',
    titles: /\b(clinical informatics|nurse informaticist|informatics (nurse|specialist|analyst)|health informatics|ehr (analyst|specialist)|epic (analyst|consultant))\b/,
    examples: ['Clinical Informatics Specialist', 'Epic Analyst', 'Nurse Informaticist'],
    needs: [G.ehr, G.informatics],
  },
  {
    key: 'healthcare_sales', label: 'Healthcare and medical sales', fn: 'Sales', people: 'HIGH', highRejectionHighUpside: true,
    titles: /\b(medical (device )?sales|pharmaceutical sales|clinical (sales|specialist)|healthcare sales|clinical account (manager|executive))\b/,
    examples: ['Medical Device Sales Representative', 'Clinical Specialist', 'Pharmaceutical Sales Rep'],
    needs: [G.crm, G.quota],
  },
  {
    key: 'customer_education', label: 'Customer education and training', fn: 'Customer Success', people: 'HIGH',
    titles: /\b(customer (education|training)|training (specialist|consultant)|corporate trainer|product trainer)\b/,
    examples: ['Customer Education Manager', 'Product Trainer', 'Training Specialist'],
    needs: [G.instructional, G.productKnowledge],
  },
  {
    key: 'marketing_operations', label: 'Marketing operations', fn: 'Marketing', people: 'LOW',
    titles: /\b(marketing operations|marketing ops|marketing automation|martech)\b/,
    examples: ['Marketing Operations Manager', 'Marketing Automation Specialist'],
    needs: [G.marketingOps, G.sql],
  },
  {
    key: 'content_marketing', label: 'Content and communications', fn: 'Marketing', people: 'LOW',
    titles: /\b(content (marketing|strategist|manager|writer|marketer)|copywriter|communications (manager|specialist|director)|technical writer|communications coordinator)\b/,
    examples: ['Content Marketing Manager', 'Copywriter', 'Communications Manager'],
    needs: [G.writingSamples],
  },
  {
    key: 'product_marketing', label: 'Product marketing', fn: 'Marketing', people: 'MIXED',
    titles: /\b(product marketing)\b/,
    examples: ['Product Marketing Manager', 'Director of Product Marketing'],
    needs: [G.positioning, G.productKnowledge],
  },
  {
    key: 'community_management', label: 'Community management', fn: 'Marketing', people: 'HIGH',
    titles: /\b(community (manager|lead|director|engagement manager)|head of community)\b/,
    examples: ['Community Manager', 'Head of Community'],
    needs: [G.communityTools],
  },
  {
    key: 'event_management', label: 'Event management', fn: 'Marketing', people: 'HIGH',
    titles: /\b(events? (manager|planner|coordinator|marketing manager|director)|meeting planner|conference manager)\b/,
    examples: ['Event Manager', 'Field Events Marketing Manager', 'Meeting Planner'],
    needs: [G.eventsTools],
  },
  {
    key: 'government_contracting', label: 'Government contracting and public sector sales', fn: 'Sales', people: 'MIXED',
    titles: /\b(government (contracts?|relations|affairs)|public sector (sales|account)|federal (account|sales)|capture manager|proposal (manager|writer|coordinator))\b/,
    examples: ['Capture Manager', 'Proposal Manager', 'Public Sector Account Executive'],
    needs: [G.govContracting],
  },
  {
    key: 'security_risk', label: 'Security and risk programs', fn: 'Operations', people: 'MIXED',
    titles: /\b(security (manager|program manager|operations|specialist|analyst)|cybersecurity analyst|physical security|business continuity|emergency management|security engineer|chief information security officer|ciso)\b/,
    examples: ['Security Program Manager', 'Cybersecurity Analyst', 'Business Continuity Manager'],
    needs: [G.security],
  },
  {
    key: 'management_consulting', label: 'Consulting', fn: 'Operations', people: 'MIXED',
    titles: /\b(management consultant|strategy consultant|business consultant|transformation (consultant|manager)|change management (consultant|manager|lead)|organizational development)\b/,
    examples: ['Change Management Consultant', 'Organizational Development Manager', 'Strategy Consultant'],
    needs: [G.consultingFrameworks],
  },
  {
    key: 'developer_relations', label: 'Developer relations', fn: 'Engineering', people: 'HIGH',
    titles: /\b(developer (relations|advocate|evangelist)|devrel|developer experience)\b/,
    examples: ['Developer Advocate', 'Developer Relations Manager'],
    needs: [G.devrel],
  },
]

export const ROLES: ReadonlyMap<string, PivotRole> = new Map(ROLE_LIST.map((r) => [r.key, r]))

export function roleByKey(key: string): PivotRole | null {
  return ROLES.get(key) ?? null
}

// ── Pivot edges per source ──────────────────────────────────────────────────

const SOURCE_LIST: PivotSource[] = [
  {
    role: 'recruiter',
    pressure: 'Recruiting teams are usually the first cut when companies slow hiring.',
    edges: [
      { to: 'account_executive', brings: ['Cold outreach and follow-up', 'Handling rejection every day', 'Closing a candidate is closing a deal', 'Negotiating offers', 'Pipeline tracking in an ATS'], covers: ['prospecting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Recruiting is sales with people as the product: you already run a pipeline, take "no" for a living and close offers.' },
      { to: 'business_development', brings: ['Relationship building with hiring managers', 'Outbound outreach', 'Negotiation'], covers: ['prospecting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Business development rewards the same outbound hustle and relationship skills, with commission upside recruiting rarely pays.' },
      { to: 'partnerships', brings: ['Managing many stakeholders at once', 'Negotiation', 'Network building'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Partnerships is long-cycle relationship selling; your network habits and stakeholder juggling carry straight over.' },
      { to: 'search_firm_consultant', brings: ['Sourcing and screening', 'Candidate and client management', 'Offer negotiation'], covers: ['prospecting'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Agency and search-firm work pays per placement: the same craft, higher variance, and the biggest upside if you can win clients.' },
      { to: 'sales_development', brings: ['High-volume outreach', 'Resilience', 'Qualifying quickly'], covers: ['prospecting'], time: 'quick', path: 'RESET', fit: 'close', why: 'The fastest way into sales: outbound prospecting is what you already do every day.' },
      { to: 'customer_success', brings: ['Relationship management', 'Expectation setting', 'Calm under pressure'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Customer success keeps the people side of recruiting with steadier hours and less rejection.' },
      { to: 'people_operations', brings: ['HR process knowledge', 'ATS and HR systems', 'Employee relations exposure'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'People operations stays inside HR, uses your process knowledge and is less tied to the hiring cycle.' },
    ],
  },
  {
    role: 'hr_generalist',
    pressure: 'Generalist HR work is being folded into HR systems, shared services and AI tools.',
    edges: [
      { to: 'people_operations', brings: ['Policies, onboarding and benefits administration', 'Employee relations', 'HR compliance'], covers: ['hrCert'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'People operations is the generalist job run as a system: your process knowledge is the core of it.' },
      { to: 'hris', brings: ['Knowing how HR data and processes fit together', 'Process documentation', 'Payroll and benefits workflows'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Companies need people who understand HR and can run the system; HRIS roles are steadier and pay more than generalist roles.' },
      { to: 'people_analytics', brings: ['Knowing what HR data means', 'Headcount and turnover reporting', 'Confidential data handling'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Analytics teams need people who understand the questions HR leaders ask; add SQL and dashboards and you have a rare mix.' },
      { to: 'learning_development', brings: ['Onboarding and training programs', 'Manager coaching', 'Facilitation'], covers: ['facilitation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Most generalists already run onboarding and training; L&D makes that the whole job.' },
      { to: 'compensation', brings: ['Pay and benefits administration', 'Job leveling exposure', 'Spreadsheet work'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Compensation is a specialist track with strong pay and steady demand; your benefits and pay administration is the starting point.' },
      { to: 'talent_acquisition', brings: ['Interviewing and hiring process', 'Employer knowledge', 'Candidate experience'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'In-house recruiting reuses your hiring process knowledge and is the most people-facing path inside HR.' },
      { to: 'hrbp', brings: ['Employee relations', 'Policies', 'Partnering with managers'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'HR business partner is the usual next step for generalists who want to advise leaders.' },
    ],
  },
  {
    role: 'hrbp',
    edges: [
      { to: 'people_analytics', brings: ['Workforce planning conversations', 'Knowing what leaders ask', 'Org design exposure'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'You know which people questions leaders actually ask; analytics roles pay for that context once you add SQL.' },
      { to: 'learning_development', brings: ['Manager coaching', 'Performance programs', 'Facilitation'], covers: ['facilitation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Leadership development is coaching at scale, which is most of what a good HR business partner already does.' },
      { to: 'management_consulting', brings: ['Org design and change management', 'Executive advising', 'Structured problem solving'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Change management and org development consulting hire HR business partners for their advising and change experience.' },
      { to: 'compensation', brings: ['Pay decisions and calibration', 'Leveling', 'Partnering with finance'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'You have sat in pay calibration; a compensation credential turns that into a specialist track.' },
      { to: 'people_operations', brings: ['Policy and employee relations', 'HR program delivery'], covers: ['hrCert'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'People operations leadership uses your program delivery experience with less dependence on one business unit.' },
      { to: 'operations_management', brings: ['Advising leaders', 'Running planning cycles', 'Cross-team coordination'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Chief of staff and business operations roles want trusted advisors who can run planning and people processes.' },
    ],
  },
  {
    role: 'customer_service',
    pressure: 'Customer service jobs are shrinking as companies automate scripted support.',
    edges: [
      { to: 'customer_success', brings: ['De-escalation', 'Product knowledge from the front line', 'Empathy under pressure', 'Ticketing and CRM tools'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Customer success is proactive service: you keep accounts happy before they call, and it pays more.' },
      { to: 'account_manager', brings: ['Customer relationships', 'Solving problems on the spot', 'Upselling during service calls'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Account managers grow existing customers; you already know how to keep them and spot what else they need.' },
      { to: 'implementation', brings: ['Walking customers through the product', 'Troubleshooting', 'Patience with setup problems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Implementation is onboarding done right; support people know exactly where new customers get stuck.' },
      { to: 'support_operations', brings: ['Queue and ticket management', 'Quality review', 'Knowing what slows a support team down'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Support operations runs the tools, staffing and automation behind the team: the part of support that is growing.' },
      { to: 'sales_development', brings: ['Phone confidence', 'Resilience', 'Quick rapport'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'A quick entry into sales with a commission upside; you already talk to strangers all day.' },
      { to: 'customer_education', brings: ['Explaining the product simply', 'Knowing common questions', 'Patience'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Customer education turns the answers you give one at a time into training that reaches everyone.' },
      { to: 'it_infrastructure', brings: ['Troubleshooting', 'Patience with frustrated users', 'Ticketing systems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Help desk and IT support are the classic next step from customer support, with a clear certification path.' },
      { to: 'admin_ea', brings: ['Organization', 'Communication', 'Handling many requests'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Office and executive support roles pay well for support pros who are organized and calm.' },
    ],
  },
  {
    role: 'customer_success',
    edges: [
      { to: 'account_executive', brings: ['Discovery with customers', 'Renewals and expansion', 'Product depth'], covers: ['productKnowledge', 'crm'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'You already run renewals and expansion; carrying a new-business quota is the higher-upside version.' },
      { to: 'account_manager', brings: ['Account relationships', 'Renewal management', 'Upsell conversations'], covers: ['crm'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Account management is customer success with a revenue number attached.' },
      { to: 'implementation', brings: ['Onboarding customers', 'Product depth', 'Project coordination'], covers: ['productKnowledge'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'You have seen every onboarding go wrong; implementation teams want exactly that.' },
      { to: 'solutions_consulting', brings: ['Product depth', 'Translating customer problems', 'Demo experience'], covers: ['productKnowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Solutions consultants win deals by knowing the product cold; it pays a sales-level bonus without owning the close.' },
      { to: 'sales_enablement', brings: ['Customer stories and objections', 'Training customers', 'Product knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Enablement teams need people who know what customers really ask; you can teach sellers that.' },
      { to: 'customer_education', brings: ['Training customers', 'Product knowledge'], covers: ['productKnowledge'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Customer education scales what you already do one account at a time.' },
      { to: 'partnerships', brings: ['Relationship management', 'Cross-team coordination'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Partner managers run relationships with other companies the way you run customer accounts.' },
      { to: 'product_management', brings: ['Customer pain points', 'Feature requests with evidence', 'Working with product teams'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Customer success hears the customer’s problems first; many product managers started there.' },
    ],
  },
  {
    role: 'account_management',
    edges: [
      { to: 'account_executive', brings: ['Upsell and renewal selling', 'Negotiation', 'CRM discipline'], covers: ['crm', 'productKnowledge'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'New-business sales is the same relationship selling with a bigger commission.' },
      { to: 'customer_success', brings: ['Account relationships', 'Renewals', 'Problem solving'], covers: ['crm'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Customer success keeps the relationship work with less quota pressure.' },
      { to: 'partnerships', brings: ['Long-cycle relationships', 'Negotiation', 'Joint planning'], covers: ['crm', 'quota'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Partner management is account management for other companies, often with more strategic scope.' },
      { to: 'implementation', brings: ['Customer onboarding', 'Expectation setting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Implementation uses your customer handling with a project focus and steadier pay.' },
      { to: 'financial_advisor', brings: ['Client relationships', 'Retention', 'Explaining complex products'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Advisors win on relationships; account managers already keep clients for years.' },
    ],
  },
  {
    role: 'sales',
    pressure: 'Sales headcount moves with the economy; quotas rise first when growth slows.',
    edges: [
      { to: 'customer_success', brings: ['Customer relationships', 'Discovery', 'CRM discipline'], covers: ['crm'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Customer success keeps the relationship side of sales with steadier pay and less rejection.' },
      { to: 'partnerships', brings: ['Negotiation', 'Pipeline management', 'Executive relationships'], covers: ['crm', 'quota'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Partnerships sells through other companies: the same skills on longer, bigger deals.' },
      { to: 'sales_enablement', brings: ['Real selling experience', 'Objection handling', 'Coaching reps'], covers: ['crm'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Enablement teams hire former sellers to train the next ones; credibility with reps is the job.' },
      { to: 'revenue_operations', brings: ['Knowing how the pipeline really works', 'Forecasting', 'CRM use'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Revenue operations runs the sales machine; sellers who learn the systems side are rare and valued.' },
      { to: 'search_firm_consultant', brings: ['Business development', 'Closing', 'Resilience'], covers: ['quota', 'prospecting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Search firms need people who can win clients; selling skills matter more there than HR background.' },
      { to: 'solutions_consulting', brings: ['Discovery', 'Demo experience', 'Deal strategy'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'If you are the seller who knows the product best, solutions consulting pays well without owning the quota alone.' },
      { to: 'product_marketing', brings: ['Why deals are won and lost', 'Buyer objections', 'Competitive knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Sellers who know why deals are won or lost make strong product marketers, with less quota pressure and more strategy.' },
      { to: 'marketing', brings: ['Buyer insight', 'Messaging that wins deals', 'Competitive knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'For sellers tired of quotas and rejection: marketing uses the same buyer knowledge and messaging without carrying a number.' },
      { to: 'financial_advisor', brings: ['Prospecting', 'Building trust', 'Closing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Financial advising rewards strong sellers who want to build their own book; firms sponsor the licenses.' },
    ],
  },
  {
    role: 'marketing',
    edges: [
      { to: 'product_marketing', brings: ['Messaging', 'Campaign launches', 'Customer research'], covers: ['positioning'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Product marketing is where marketing meets product and sales, and it has held up better than general marketing.' },
      { to: 'marketing_operations', brings: ['Campaign tools', 'Funnel reporting', 'Process'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Marketing operations runs the systems behind every campaign and is harder to automate away.' },
      { to: 'sales_enablement', brings: ['Content creation', 'Messaging', 'Training material'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Enablement is marketing aimed at your own sales team, with clear ties to revenue.' },
      { to: 'partnerships', brings: ['Co-marketing', 'Relationship building', 'Pitching'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Partner marketing and partnerships reward the pitching and relationship skills marketers use with agencies and partners.' },
      { to: 'community_management', brings: ['Audience building', 'Content', 'Events'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Community roles turn audience-building into direct relationships with customers.' },
      { to: 'customer_success', brings: ['Customer insight', 'Communication', 'Lifecycle campaigns'], time: 'months', path: 'RESET', fit: 'stretch', why: 'Lifecycle marketers already think about retention; customer success does it one account at a time.' },
      { to: 'account_executive', brings: ['Knowing the buyer and the message', 'Presenting', 'Pipeline from campaigns'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Outgoing marketers who want more money and more time with people move into sales: you already know the buyer and the pitch, and sales pays for closing.' },
      { to: 'business_development', brings: ['Opening doors', 'Pitching', 'Partner relationships'], covers: ['prospecting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Business development rewards marketers who like building relationships and starting conversations, with pay tied to the deals they open.' },
      { to: 'product_management', brings: ['Customer and market insight', 'Positioning', 'Launches'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Product marketers often move into product management: you know the customer and the market, and you add owning what gets built.' },
      { to: 'design', brings: ['Brand and visual sense', 'Campaign creative', 'Working with designers'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Marketers with an eye for design move into brand and visual design roles.' },
      { to: 'communications', brings: ['Messaging', 'Press and launches', 'Writing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Communications and PR are a short step from marketing, with more focus on reputation and the press.' },
      { to: 'csr', brings: ['Storytelling about impact', 'Campaigns', 'Partnerships'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Corporate social responsibility teams hire marketers to run and tell the story of the company’s impact work.' },
    ],
  },
  {
    role: 'operations',
    edges: [
      { to: 'program_management', brings: ['Running cross-team work', 'Process improvement', 'Reporting to leaders'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Program management formalizes what operations leaders already do: coordinate many teams to a date.' },
      { to: 'procurement', brings: ['Vendor management', 'Cost control', 'Negotiation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Procurement is cost control and vendor negotiation as a specialty, with steady demand.' },
      { to: 'logistics_supply_chain', brings: ['Process and throughput', 'Planning', 'Vendor coordination'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Supply chain roles reward operators who can run planning and fix bottlenecks.' },
      { to: 'revenue_operations', brings: ['Process design', 'Metrics and reporting', 'Systems thinking'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Revenue operations is operations applied to sales and marketing, where many companies are still hiring.' },
      { to: 'business_analyst', brings: ['Process mapping', 'Requirements', 'Reporting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Business analysts translate how work happens into systems; operators already know how work happens.' },
      { to: 'implementation', brings: ['Rollouts and change', 'Project coordination', 'Training teams'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Implementation teams run customer rollouts like internal operations projects.' },
      { to: 'operations_management', brings: ['Running the business day to day', 'Reporting to leaders', 'Fixing what breaks'], covers: ['projectMethod'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Chief of staff and business operations roles are the senior version of running operations, closer to the leadership team.' },
    ],
  },
  {
    role: 'project_program',
    edges: [
      { to: 'technical_program_management', brings: ['Delivery planning', 'Risk management', 'Stakeholder updates'], covers: ['projectMethod'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Technical program management pays more for the same delivery craft, aimed at engineering teams.' },
      { to: 'product_management', brings: ['Roadmaps and delivery', 'Stakeholder management', 'Prioritization'], covers: ['agile'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Many product managers started in delivery; you move from how and when to what and why.' },
      { to: 'implementation', brings: ['Running projects with customers', 'Scope and timeline control'], covers: ['projectMethod'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Customer implementation is project management with a customer on the other side.' },
      { to: 'operations_management', brings: ['Cross-team coordination', 'Executive reporting', 'Process'], covers: ['projectMethod'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Chief of staff and business operations roles hire strong program people to run the leadership agenda.' },
      { to: 'product_operations', brings: ['Release planning', 'Process', 'Tooling'], covers: ['agile'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Product operations runs the product team\'s processes and releases, a natural home for delivery people.' },
    ],
  },
  {
    role: 'finance_accounting',
    edges: [
      { to: 'fpa', brings: ['Financial statements', 'Close process', 'Excel'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'FP&A moves you from recording the numbers to forecasting them, the part of finance AI is least likely to replace.' },
      { to: 'revenue_operations', brings: ['Revenue recognition', 'Forecasting', 'Data discipline'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Revenue operations needs people who trust the numbers; finance backgrounds stand out.' },
      { to: 'procurement', brings: ['Spend analysis', 'Contracts and approvals', 'Vendor payments'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Procurement is spend control; you already know where the money goes.' },
      { to: 'business_analyst', brings: ['Analysis', 'Systems (ERP)', 'Process'], covers: ['sql'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Business systems analysts who understand finance processes are hard to find.' },
      { to: 'compensation', brings: ['Modeling', 'Payroll and budget knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Compensation teams are half finance; your modeling skills transfer directly.' },
      { to: 'compliance', brings: ['Controls and audit', 'Documentation', 'Attention to detail'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Audit and controls experience is the foundation of most compliance roles.' },
    ],
  },
  {
    role: 'teaching',
    pressure: 'Many teachers leave the classroom for pay and burnout reasons; districts are also tightening budgets.',
    edges: [
      { to: 'instructional_design', brings: ['Lesson and curriculum design', 'Assessment', 'Explaining hard ideas simply'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Instructional design is curriculum design for adults at work; it usually pays more than teaching.' },
      { to: 'learning_development', brings: ['Facilitation', 'Curriculum', 'Coaching learners'], covers: ['facilitation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Corporate training needs people who can actually teach a room; you have years of practice.' },
      { to: 'customer_education', brings: ['Teaching', 'Patience', 'Building materials'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Software companies need people who can teach customers their product.' },
      { to: 'customer_success', brings: ['Relationship building with parents and students', 'Progress tracking', 'Communication'], time: 'months', path: 'RESET', fit: 'adjacent', why: 'Customer success is helping people succeed with something new, which is what teachers do; ed-tech companies hire teachers often.' },
      { to: 'sales_development', brings: ['Public speaking', 'Persuasion', 'Resilience'], time: 'quick', path: 'RESET', fit: 'stretch', why: 'Ed-tech sales teams hire former teachers who can talk to schools; commission can beat a teacher salary quickly.' },
      { to: 'talent_acquisition', brings: ['Reading people', 'Communication', 'Organization'], time: 'months', path: 'RESET', fit: 'stretch', why: 'Campus and early-career recruiting values former teachers who connect easily with young candidates.' },
      { to: 'education_admin', brings: ['Working with students and families', 'School systems', 'Advising'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Advising, admissions and student services keep you in education, out of the classroom, often with better hours.' },
      { to: 'nonprofit_programs', brings: ['Program delivery', 'Working with communities', 'Grant-funded projects'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Nonprofits run education and youth programs that need exactly what teachers do well.' },
      { to: 'social_work', brings: ['Working with children and families', 'Spotting kids who need help', 'Patience'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'School social work and family services suit teachers who want to help kids beyond the classroom.' },
    ],
  },
  {
    role: 'nursing_clinical',
    pressure: 'Bedside burnout is high; many clinicians move to non-bedside roles that use their clinical knowledge.',
    edges: [
      { to: 'clinical_informatics', brings: ['Clinical workflow knowledge', 'EHR daily use', 'Patient safety mindset'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Hospitals need clinicians who can make the EHR work for clinicians; the pay holds up and the hours are regular.' },
      { to: 'clinical_operations', brings: ['Clinical judgment', 'Care coordination', 'Documentation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Care coordination, utilization review and clinical research use your clinical judgment away from the bedside.' },
      { to: 'healthcare_sales', brings: ['Clinical credibility', 'Speaking to clinicians', 'Product knowledge in procedures'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Device and pharma companies pay well for people clinicians trust; the commission upside is real.' },
      { to: 'implementation', brings: ['Clinical workflow knowledge', 'Training colleagues', 'Calm under pressure'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Health-tech companies hire clinicians to roll out their software in hospitals.' },
      { to: 'compliance', brings: ['Regulatory awareness', 'Documentation', 'Quality and safety'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Healthcare compliance and quality roles value people who know how care actually happens.' },
      { to: 'customer_success', brings: ['Clinical workflows', 'Training clinicians', 'Patient-first problem solving'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Health-tech companies hire nurses for customer success because they speak the customer’s language.' },
      { to: 'product_management', brings: ['Knowing clinical workflows', 'What frustrates clinicians', 'Patient safety'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Nurses move into health-tech product roles to build tools that fit how care really works.' },
      { to: 'customer_education', brings: ['Teaching patients and staff', 'Clinical training', 'Clear explanations'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Clinical educators at health-tech and device companies train customers on their products.' },
    ],
  },
  {
    role: 'admin_ea',
    pressure: 'Office and admin support has some of the highest exposure to AI tools of any occupation group.',
    edges: [
      { to: 'operations_management', brings: ['Running an executive\'s calendar and priorities', 'Discretion', 'Cross-team coordination'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Chief of staff and business operations roles are a common next step for strong executive assistants.' },
      { to: 'project_management', brings: ['Organization', 'Follow-through', 'Coordinating many people'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Project coordination is what you already do; a certificate makes it the title.' },
      { to: 'people_operations', brings: ['Onboarding and office logistics', 'Confidentiality', 'Employee support'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Many people operations teams started as the office manager; your employee support is the foundation.' },
      { to: 'event_management', brings: ['Planning offsites and meetings', 'Vendor coordination', 'Budgets'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'If you have planned offsites and board meetings, you have already done event management.' },
      { to: 'customer_success', brings: ['Responsiveness', 'Organization', 'Professional communication'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Customer success rewards the same responsiveness and polish, with a clearer path up.' },
      { to: 'legal', brings: ['Document management', 'Deadlines', 'Discretion'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'A paralegal certificate takes many executive assistants into law firms and legal teams.' },
    ],
  },
  {
    role: 'data_analytics',
    edges: [
      { to: 'people_analytics', brings: ['SQL and dashboards', 'Statistics', 'Storytelling with data'], covers: ['sql', 'bi', 'stats'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'People analytics teams want analysts; learning the HR questions is faster than learning SQL.' },
      { to: 'revenue_operations', brings: ['Analysis', 'Forecasting', 'Data pipelines'], covers: ['sql'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Revenue operations needs analysts who can make the forecast trustworthy.' },
      { to: 'product_management', brings: ['Metrics and experiments', 'Asking the right question', 'Technical fluency'], covers: ['technical'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Data-minded product managers are in demand; you already know how to measure what matters.' },
      { to: 'fpa', brings: ['Modeling', 'SQL', 'Reporting'], covers: ['sql'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'FP&A is analysis with a budget attached; add finance basics and you are a strong candidate.' },
      { to: 'solutions_consulting', brings: ['Technical fluency', 'Explaining data to non-experts'], covers: ['technical'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Data and analytics software companies hire analysts as solutions consultants, with a sales bonus on top.' },
      { to: 'data_scientist', brings: ['SQL and analysis', 'Statistics', 'Business questions'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Data science is the next step up from analysis: you add modeling and machine learning to questions you already answer.' },
    ],
  },
  {
    role: 'engineering',
    edges: [
      { to: 'solutions_consulting', brings: ['Deep technical knowledge', 'Debugging', 'Architecture'], covers: ['technical'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Sales engineers and solutions architects are engineers who like talking to customers; pay includes a bonus.' },
      { to: 'technical_program_management', brings: ['Systems knowledge', 'Estimation', 'Working across engineering teams'], covers: ['agile'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'TPMs who can read the code earn trust quickly with engineering teams.' },
      { to: 'product_management', brings: ['Technical depth', 'Trade-off thinking', 'Shipping software'], covers: ['technical', 'agile'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Technical product managers are in steady demand, especially for platform and AI products.' },
      { to: 'developer_relations', brings: ['Coding', 'Explaining technical ideas', 'Community knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Developer relations pays engineers to teach other engineers in public.' },
      { to: 'data_analyst', brings: ['Programming', 'Data handling', 'Logic'], covers: ['sql'], time: 'quick', path: 'RESET', fit: 'adjacent', why: 'Analytics roles reuse your programming skills and are hiring outside pure software companies.' },
      { to: 'engineering_manager', brings: ['Technical judgment', 'Code review and mentoring', 'Delivery'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'The usual next step for engineers who like people and want to grow others: you trade writing code for building the team.' },
      { to: 'data_scientist', brings: ['Python', 'Systems thinking', 'Working with data'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Engineers who enjoy the math move into machine learning, one of the fastest-growing kinds of engineering work.' },
    ],
  },
  {
    role: 'product',
    edges: [
      { to: 'program_management', brings: ['Roadmaps', 'Cross-team delivery', 'Stakeholder management'], covers: ['agile'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Program management uses your delivery and coordination strengths with less ambiguity.' },
      { to: 'product_marketing', brings: ['Product depth', 'Customer research', 'Positioning'], covers: ['productKnowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Product marketers who understand how the product is built are rare.' },
      { to: 'solutions_consulting', brings: ['Product depth', 'Customer discovery', 'Demos'], covers: ['productKnowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Solutions consulting puts your product knowledge in front of buyers, with a sales bonus.' },
      { to: 'operations_management', brings: ['Prioritization', 'Planning', 'Cross-team leadership'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Chief of staff and strategy-and-operations roles want people who can prioritize like product managers.' },
      { to: 'product_operations', brings: ['Product process', 'Tooling', 'Launches'], covers: ['agile'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Product operations improves how product teams work, which you know from the inside.' },
    ],
  },
  {
    role: 'design',
    edges: [
      { to: 'ux_research', brings: ['User empathy', 'Usability testing', 'Synthesis'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Research is the part of design closest to the business decision.' },
      { to: 'product_management', brings: ['User-centered thinking', 'Prototyping', 'Working with engineers'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Designer-turned-product-managers are common and valued for their customer instincts.' },
      { to: 'product_marketing', brings: ['Visual storytelling', 'Brand', 'Customer insight'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Product marketing needs people who can make a product\'s value obvious; designers do that visually.' },
      { to: 'content_marketing', brings: ['Storytelling', 'Brand voice', 'Creative production'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Content teams value people who can write and make things look right.' },
    ],
  },
  {
    role: 'legal',
    edges: [
      { to: 'compliance', brings: ['Regulatory reading', 'Risk judgment', 'Policy drafting'], covers: ['compliance'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Compliance is legal judgment applied to day-to-day operations, with steadier hours.' },
      { to: 'contracts_management', brings: ['Drafting and negotiating', 'Risk spotting', 'Attention to detail'], covers: ['contracts'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Contract management uses your drafting and negotiation without billable hours.' },
      { to: 'legal_operations', brings: ['Knowing how legal work flows', 'Matter management', 'Vendor management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Legal operations runs the legal department like a business, a growing field as legal teams adopt AI tools.' },
      { to: 'government_contracting', brings: ['Regulations', 'Contract terms', 'Writing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Government contractors need people who can read regulations and write proposals.' },
    ],
  },
  {
    role: 'consulting',
    edges: [
      { to: 'operations_management', brings: ['Structured problem solving', 'Executive communication', 'Running workstreams'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Strategy-and-operations and chief of staff roles are the classic exit from consulting.' },
      { to: 'program_management', brings: ['Running transformation programs', 'Stakeholder management'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Program management in-house uses your engagement management skills.' },
      { to: 'product_management', brings: ['Problem framing', 'Customer interviews', 'Prioritization'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Product roles reward the problem framing consultants practice daily.' },
      { to: 'business_development', brings: ['Client relationships', 'Pitching', 'Proposal writing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'If you sold work as a consultant, business development pays for that directly.' },
      { to: 'fpa', brings: ['Modeling', 'Analysis', 'Executive presentations'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Strategic finance teams hire consultants who can model and present.' },
      { to: 'corporate_development', brings: ['Strategy work', 'Market analysis', 'Executive presentations'], covers: ['consultingFrameworks'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Strategy consultants move into corporate development and strategy roles to own the decision instead of advising on it.' },
    ],
  },
  {
    role: 'executive',
    edges: [
      { to: 'operations_management', brings: ['Running a business end to end', 'Leading leaders', 'Board and investor reporting'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Chief operating officer, chief of staff and business operations roles use exactly what you did, often with less risk than running the whole company.' },
      { to: 'management_consulting', brings: ['Pattern recognition from running companies', 'Credibility with executives', 'Turnarounds'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Consulting and advisory work put your experience to use across many companies, often as a fractional or interim leader.' },
      { to: 'corporate_development', brings: ['Deals and partnerships', 'Strategy', 'Knowing what makes a business valuable'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Corporate development and strategy roles want people who have built or bought businesses.' },
      { to: 'business_development', brings: ['Opening doors at the top', 'Negotiation', 'Partnerships'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Senior business development and partnerships roles pay for executives who can get a meeting with anyone.' },
      { to: 'investment', brings: ['Operating experience', 'Judging teams and markets', 'A network of founders'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Venture and private equity firms hire operators as operating partners and portfolio advisors.' },
      { to: 'nonprofit_programs', brings: ['Leading an organization', 'Fundraising and board work', 'Strategy on a budget'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Nonprofits hire business leaders as executive directors and program heads; the mission is the pay-off.' },
    ],
  },
  {
    role: 'physical_engineering',
    edges: [
      { to: 'project_management', brings: ['Running engineering projects', 'Schedules and budgets', 'Vendors and contractors'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Engineering project managers are in demand everywhere things get built, and your technical depth is the credential.' },
      { to: 'technical_program_management', brings: ['Systems thinking', 'Cross-team technical work', 'Risk management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Technical program management pays well for engineers who would rather coordinate the work than do all of it.' },
      { to: 'solutions_consulting', brings: ['Technical depth', 'Explaining how things work', 'Solving customer problems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Sales engineering pays well for engineers who enjoy people and can explain hard things simply.' },
      { to: 'operations_management', brings: ['Process improvement', 'Plant and production know-how', 'Lean and quality methods'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Operations leadership is a common next step for manufacturing and process engineers who want to run the place.' },
      { to: 'compliance', brings: ['Standards and specs', 'Documentation', 'Quality systems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Quality, safety and regulatory roles reward engineers who know standards inside out, with steadier hours.' },
      { to: 'data_analyst', brings: ['Math and modeling', 'Excel and tools', 'Testing and measurement'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Engineers move into analytics easily: same rigor, applied to business data.' },
    ],
  },
  {
    role: 'it_infrastructure',
    edges: [
      { to: 'security_risk', brings: ['Networks and systems', 'Access and identity', 'Incident response'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Security is the fastest-growing part of IT and the natural next step from systems and networks.' },
      { to: 'engineering', brings: ['Scripting and automation', 'Systems knowledge', 'Troubleshooting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'DevOps and cloud engineering pay more for the infrastructure skills you already have, plus code.' },
      { to: 'implementation', brings: ['Setting up systems', 'Training users', 'Troubleshooting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Software companies hire IT people to roll out their product at customers.' },
      { to: 'support_operations', brings: ['Help desk processes', 'Ticketing tools', 'Metrics'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Support operations runs the systems and metrics behind a support team, a step up from working tickets.' },
      { to: 'hris', brings: ['Systems administration', 'Access and data', 'Vendor management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'HR systems teams hire IT administrators to run Workday, ADP and similar platforms.' },
      { to: 'technical_program_management', brings: ['Infrastructure projects', 'Vendors and rollouts', 'Change management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'IT managers who run big migrations make strong technical program managers.' },
    ],
  },
  {
    role: 'financial_advisor',
    edges: [
      { to: 'fpa', brings: ['Financial planning', 'Modeling', 'Explaining money clearly'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Corporate finance trades the book of clients for a salary and steady hours, using the planning skills you have.' },
      { to: 'account_manager', brings: ['Client relationships', 'Trust and retention', 'Explaining complex products'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Account management keeps the relationship work without building a book from scratch.' },
      { to: 'compliance', brings: ['Regulation (FINRA, SEC)', 'Documentation', 'Suitability rules'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Compliance teams at banks and wealth firms hire former advisors who know the rules from the inside.' },
      { to: 'customer_success', brings: ['Client relationships', 'Onboarding', 'Keeping clients'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Fintech and wealth-tech companies hire advisors for customer success roles where your expertise is the product.' },
      { to: 'sales', brings: ['Prospecting', 'Closing', 'Resilience'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'If you like the selling, enterprise sales pays well without the licensing and book-building.' },
      { to: 'investment', brings: ['Markets and products', 'Portfolio construction', 'Client research'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Research and portfolio roles suit advisors who enjoy the markets more than the client meetings.' },
    ],
  },
  {
    role: 'social_work',
    edges: [
      { to: 'nonprofit_programs', brings: ['Case management', 'Community resources', 'Running programs'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Program and leadership roles at nonprofits build directly on casework, with less burnout.' },
      { to: 'public_sector', brings: ['Public programs and benefits', 'Policy in practice', 'Documentation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Government agencies hire social workers into program and policy roles that shape the services you delivered.' },
      { to: 'people_operations', brings: ['Supporting people through hard times', 'Confidentiality', 'Benefits and resources'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Employee relations, benefits and wellbeing roles use counseling skills inside companies.' },
      { to: 'education_admin', brings: ['Student support', 'Crisis response', 'Family work'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Schools and colleges hire social workers into student services and support roles.' },
      { to: 'clinical_operations', brings: ['Care coordination', 'Healthcare systems', 'Patient advocacy'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Care coordination and patient navigation roles at health systems value social work training.' },
      { to: 'customer_success', brings: ['Empathy under pressure', 'Problem solving', 'Advocacy'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Health-tech and benefits companies hire social workers for member success roles.' },
    ],
  },
  {
    role: 'facilities_real_estate',
    edges: [
      { to: 'operations_management', brings: ['Running sites and budgets', 'Vendors and contractors', 'Safety and compliance'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Facilities and property managers already run operations; business operations roles pay more for the same skills.' },
      { to: 'procurement', brings: ['Vendor contracts', 'Negotiation', 'Cost control'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Procurement is vendor management as a specialty, and you have done plenty of it.' },
      { to: 'project_management', brings: ['Construction and renovation projects', 'Schedules and budgets', 'Contractors'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Project management roles in construction, real estate and corporate facilities fit directly.' },
      { to: 'account_manager', brings: ['Tenant and client relationships', 'Renewals', 'Problem solving'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Account management keeps the client side of property work in a company setting.' },
      { to: 'sales', brings: ['Closing deals', 'Negotiation', 'Prospecting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Real estate agents who like the deal often do well in B2B sales, with a base salary.' },
      { to: 'logistics_supply_chain', brings: ['Space and inventory', 'Vendors', 'Running a site'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Warehouse and distribution operations hire facilities managers to run sites.' },
    ],
  },
  {
    role: 'physician',
    edges: [
      { to: 'clinical_informatics', brings: ['Clinical judgment', 'Workflows doctors actually use', 'EHR experience'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Physician informaticists shape the systems clinicians use, with regular hours and no night call.' },
      { to: 'clinical_operations', brings: ['Running clinical teams', 'Quality and safety', 'Care pathways'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Medical director and clinical operations roles lead care delivery from the system side.' },
      { to: 'management_consulting', brings: ['Clinical credibility', 'Problem solving', 'Health system knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Healthcare consulting firms and payers hire physicians to advise on care, cost and quality.' },
      { to: 'compliance', brings: ['Clinical standards', 'Documentation', 'Patient safety'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Utilization review, quality and regulatory roles value a physician’s judgment, with steady hours.' },
      { to: 'product_management', brings: ['Knowing the clinical problem', 'Workflow insight', 'Credibility with clinicians'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Health-tech companies hire physicians into product roles to build what clinicians will actually use.' },
    ],
  },
  {
    role: 'clergy',
    edges: [
      { to: 'nonprofit_programs', brings: ['Leading a community', 'Running programs and volunteers', 'Fundraising'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Nonprofits hire clergy to lead programs and organizations; the mission and the people work carry straight over.' },
      { to: 'fundraising', brings: ['Asking for support', 'Donor relationships', 'Telling a story that moves people'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'If you have led a capital campaign or annual giving, development roles pay for exactly that.' },
      { to: 'people_operations', brings: ['Supporting people through hard times', 'Confidentiality', 'Conflict resolution'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Employee relations, wellbeing and chaplaincy-style roles inside companies use pastoral skills.' },
      { to: 'learning_development', brings: ['Teaching and public speaking', 'Leading groups', 'Mentoring'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Corporate learning teams hire people who can teach and hold a room.' },
      { to: 'education_admin', brings: ['Counseling students and families', 'Community programs', 'Mentoring'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Schools and colleges hire clergy into student life, advising and campus ministry roles.' },
      { to: 'community_management', brings: ['Building community', 'Events', 'Volunteers'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Companies pay community managers to do what you have done for years: bring people together.' },
      { to: 'social_work', brings: ['Pastoral care', 'Crisis support', 'Community resources'], time: 'longer', path: 'RESET', fit: 'stretch', why: 'Many clergy add a social work degree and move into counseling and case work.' },
    ],
  },
  {
    role: 'public_safety',
    edges: [
      { to: 'security_risk', brings: ['Threat assessment', 'Emergency response', 'Investigations'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Corporate security, emergency management and business continuity roles hire police, fire and EMS veterans first.' },
      { to: 'public_sector', brings: ['Government operations', 'Public programs', 'Policy in practice'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Emergency management and public program roles keep you serving the public, often with better hours.' },
      { to: 'compliance', brings: ['Rules and enforcement', 'Investigations', 'Documentation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Compliance, safety and investigations roles in companies value enforcement experience.' },
      { to: 'learning_development', brings: ['Training others', 'Drills and scenarios', 'Certification programs'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Training roles reward people who have run academies, drills and field training.' },
      { to: 'operations_management', brings: ['Leading teams under pressure', 'Shift operations', 'Logistics'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Operations leadership is a natural move for officers and captains who ran shifts and stations.' },
      { to: 'logistics_supply_chain', brings: ['Dispatch and coordination', 'Planning under pressure', 'Fleet and equipment'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Logistics and dispatch-style operations roles fit people who coordinate in real time.' },
      { to: 'facilities_real_estate', brings: ['Site safety', 'Emergency plans', 'Vendor coordination'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Facilities and security management at campuses and hospitals value public safety experience.' },
    ],
  },
  {
    role: 'scientist',
    edges: [
      { to: 'data_scientist', brings: ['Statistics', 'Experiment design', 'Programming for analysis'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Data science is the most common move out of the lab: same scientific method, applied to business data.' },
      { to: 'compliance', brings: ['Regulatory knowledge', 'Documentation', 'Quality systems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Regulatory affairs and quality roles at pharma, biotech and manufacturing companies want scientists.' },
      { to: 'clinical_operations', brings: ['Research protocols', 'Data integrity', 'Study management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Clinical research and study management roles build on lab and research experience.' },
      { to: 'solutions_consulting', brings: ['Deep technical knowledge', 'Explaining science simply', 'Solving customer problems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Application scientist and technical sales roles pay more for scientists who like people.' },
      { to: 'healthcare_sales', brings: ['Scientific credibility', 'Presenting data', 'Building relationships with experts'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Medical science liaison and life-science sales roles value a science degree and the ability to explain it.' },
      { to: 'product_management', brings: ['Knowing the science', 'Experiment-driven thinking', 'Technical depth'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Science and lab-tools companies hire scientists into product roles.' },
      { to: 'teaching', brings: ['Deep subject knowledge', 'Explaining hard ideas', 'Lab skills'], time: 'months', path: 'RESET', fit: 'stretch', why: 'Schools are short of science teachers; alternative certification gets scientists into classrooms fast.' },
    ],
  },
  {
    role: 'food_service',
    edges: [
      { to: 'event_management', brings: ['Running service under pressure', 'Vendors and staffing', 'Catering'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Event and catering management uses the same skills, often with better hours.' },
      { to: 'operations_management', brings: ['Running a business day to day', 'Staffing and scheduling', 'Food cost and margins'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Restaurant managers run full P&Ls; operations roles elsewhere pay for that.' },
      { to: 'procurement', brings: ['Buying and vendor negotiation', 'Inventory and waste', 'Food cost'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Purchasing roles at food distributors, hospitals and campuses hire people who know food cost.' },
      { to: 'logistics_supply_chain', brings: ['Inventory', 'Ordering and receiving', 'Throughput'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Food distribution and supply chain roles value kitchen and restaurant operators.' },
      { to: 'customer_success', brings: ['Hospitality', 'Keeping guests happy', 'Handling complaints'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Hospitality skills transfer to customer success roles, especially at restaurant-tech companies.' },
      { to: 'account_manager', brings: ['Relationships with regulars and vendors', 'Upselling', 'Service recovery'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Food and beverage distributors hire restaurant people as account managers.' },
    ],
  },
  {
    role: 'journalism',
    edges: [
      { to: 'communications', brings: ['Writing fast and accurately', 'Knowing what reporters want', 'Interviewing'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Communications and PR are the other side of the newsroom: you already know what makes a story and how journalists work.' },
      { to: 'content_marketing', brings: ['Writing and editing', 'Deadlines', 'Storytelling'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Companies hire journalists to write and run content because they write clearly and on time.' },
      { to: 'ux_research', brings: ['Interviewing', 'Finding the real story', 'Writing findings'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'User research is interviewing people and reporting what you learned, aimed at a product.' },
      { to: 'product_marketing', brings: ['Storytelling', 'Research', 'Clear writing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Product marketing turns research into the story a company tells about its product.' },
      { to: 'public_sector', brings: ['Policy knowledge from covering it', 'Research', 'Clear writing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Reporters who covered government or policy move into policy and government communications roles.' },
    ],
  },
  {
    role: 'nonprofit_programs',
    edges: [
      { to: 'csr', brings: ['Program design', 'Community partnerships', 'Impact reporting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Corporate social responsibility teams run a company’s giving and community programs, usually with better pay.' },
      { to: 'public_sector', brings: ['Program management', 'Grants and compliance', 'Serving the public'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Government programs fund and run much of the same work nonprofits do, with more stability.' },
      { to: 'fundraising', brings: ['Telling the mission story', 'Donor relationships', 'Grant writing'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Development roles are in demand at every nonprofit, and program leaders make credible fundraisers.' },
      { to: 'education_admin', brings: ['Student and family programs', 'Outreach', 'Case management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Schools and universities hire nonprofit program people into student services and outreach.' },
      { to: 'program_management', brings: ['Running programs on a budget', 'Partners and stakeholders', 'Reporting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Corporate program management uses the same skills: coordinate people and money to an outcome.' },
      { to: 'community_management', brings: ['Building community', 'Events', 'Partnerships'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Community roles at companies reward people who know how to bring a group together.' },
      { to: 'social_work', brings: ['Case work', 'Community resources', 'Program delivery'], time: 'longer', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Many nonprofit staff add a social work license to move into counseling and clinical roles.' },
    ],
  },
  {
    role: 'education_admin',
    edges: [
      { to: 'nonprofit_programs', brings: ['Student and family programs', 'Advising', 'Outreach'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Education nonprofits and youth programs need people who know students and schools.' },
      { to: 'public_sector', brings: ['Education policy in practice', 'Compliance', 'Program management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'State and local education agencies hire people who have run school and student programs.' },
      { to: 'talent_acquisition', brings: ['Admissions is recruiting', 'Interviewing', 'Pipeline management'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Admissions is recruiting with students; companies hire admissions people into talent acquisition.' },
      { to: 'people_operations', brings: ['Student services processes', 'Policy and compliance', 'Helping people through systems'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'People operations is student services for employees.' },
      { to: 'learning_development', brings: ['Advising and coaching', 'Workshops', 'Program design'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Corporate learning teams hire people who have run advising, orientation and training programs.' },
      { to: 'customer_success', brings: ['Helping people succeed', 'Relationship building', 'Problem solving'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Customer success is advising for customers: keep them on track and succeeding.' },
      { to: 'instructional_design', brings: ['Program design', 'Training and orientation', 'Learning outcomes'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Instructional design builds on running orientation, advising and training programs.' },
    ],
  },
  {
    role: 'investment',
    edges: [
      { to: 'fpa', brings: ['Financial modeling', 'Valuation', 'Board-level presentations'], covers: ['financeModel'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Corporate finance teams hire bankers and investors for their modeling and their read on what drives value, with better hours and steady demand.' },
      { to: 'corporate_development', brings: ['Deal diligence', 'Valuation', 'Negotiation'], covers: ['financeModel'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Corporate development does deals from the inside: the same diligence and valuation, in service of one company’s strategy.' },
      { to: 'management_consulting', brings: ['Analysis', 'Slides that persuade', 'Industry knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Strategy consulting uses the same analysis and storytelling, with more client contact and less dependence on deal flow.' },
      { to: 'business_development', brings: ['Relationship-driven deal making', 'Pitching', 'Negotiation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Investors who like the relationship side of deals move into business development, where pay leans on the deals you bring in.' },
      { to: 'operations_management', brings: ['Seeing how many companies run', 'Performance metrics', 'Board reporting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Portfolio operations and chief of staff roles hire investors who have watched many companies succeed and fail.' },
    ],
  },
  {
    role: 'retail_management',
    pressure: 'Store headcount keeps shrinking as retail moves online and to self-checkout.',
    edges: [
      { to: 'operations_management', brings: ['P&L ownership', 'Scheduling and staffing', 'Running a team'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'You ran a business unit with a P&L; operations roles in other industries value that.' },
      { to: 'logistics_supply_chain', brings: ['Inventory management', 'Vendor and delivery coordination'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Inventory and distribution experience carries straight into supply chain roles.' },
      { to: 'account_manager', brings: ['Customer service', 'Sales targets', 'Merchandising'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Vendor-side account managers sell into retailers; you know how the buyer thinks.' },
      { to: 'account_executive', brings: ['Hitting sales targets', 'Coaching sellers', 'Customer focus'], time: 'months', path: 'RESET', fit: 'stretch', why: 'B2B sales pays well for people who have hit numbers with a team; expect to re-enter a level lower.' },
      { to: 'customer_success', brings: ['Customer focus', 'Problem solving', 'Training staff'], time: 'months', path: 'RESET', fit: 'adjacent', why: 'Customer success uses the service instincts you built on the floor, with office hours.' },
      { to: 'facilities_real_estate', brings: ['Running a site', 'Vendors and maintenance', 'Safety'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Store managers move into facilities and property management, running sites with steadier hours.' },
    ],
  },
  {
    role: 'hospitality',
    edges: [
      { to: 'event_management', brings: ['Events and banquets', 'Vendor coordination', 'Guest experience'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'Corporate events teams hire hospitality people who have run events under pressure.' },
      { to: 'customer_success', brings: ['Guest experience', 'Service recovery', 'Reading people'], time: 'months', path: 'RESET', fit: 'adjacent', why: 'Customer success is hospitality for software customers, with regular hours.' },
      { to: 'account_manager', brings: ['Group sales and corporate accounts', 'Relationship building'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'If you handled group or corporate accounts, account management is the same job in another industry.' },
      { to: 'account_executive', brings: ['Selling experiences', 'Rapport', 'Resilience'], time: 'months', path: 'RESET', fit: 'stretch', why: 'Hospitality sales people move into B2B sales for the commission upside.' },
      { to: 'operations_management', brings: ['Running a 24/7 operation', 'Staffing', 'Budgets'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Running a hotel or restaurant is operations management; other industries value that pace.' },
      { to: 'facilities_real_estate', brings: ['Running a property', 'Vendors and maintenance', 'Guest and tenant service'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Property and facilities management is hotel operations without the front desk.' },
      { to: 'admin_ea', brings: ['Organization', 'Service', 'Handling VIPs'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Executive assistant roles reward the polish and anticipation hospitality teaches.' },
    ],
  },
  {
    role: 'military_government',
    edges: [
      { to: 'program_management', brings: ['Leading large teams', 'Planning under uncertainty', 'Mission focus'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Program management in defense and government contracting maps closely to military planning.' },
      { to: 'logistics_supply_chain', brings: ['Logistics and supply', 'Readiness', 'Accountability for equipment'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Military logistics is supply chain management at scale.' },
      { to: 'government_contracting', brings: ['Knowing how government buys', 'Clearance (if held)', 'Mission knowledge'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Contractors want people who understand the customer: government.' },
      { to: 'security_risk', brings: ['Security mindset', 'Clearance (if held)', 'Emergency planning'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Security and business continuity programs hire veterans for their discipline and planning.' },
      { to: 'operations_management', brings: ['Leadership', 'Standards and process', 'Running operations'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Operations leadership roles value people who have run teams through hard conditions.' },
      { to: 'project_management', brings: ['Planning', 'Execution', 'Reporting up'], time: 'quick', path: 'KEEP_SENIORITY', fit: 'close', why: 'PMP plus military planning experience is a well-worn path into civilian project management.' },
      { to: 'nonprofit_programs', brings: ['Mission focus', 'Leading teams', 'Running programs on a budget'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'Nonprofits value leaders who run programs with discipline and serve a mission.' },
      { to: 'public_sector', brings: ['Government processes', 'Program management', 'Policy and regulation'], time: 'months', path: 'KEEP_SENIORITY', fit: 'close', why: 'Civilian policy and program roles use your knowledge of how government works.' },
      { to: 'education_admin', brings: ['Training and mentoring', 'Operations', 'Rules and compliance'], time: 'months', path: 'KEEP_SENIORITY', fit: 'stretch', why: 'Schools and universities hire veterans into admissions, student services and operations.' },
      { to: 'teaching', brings: ['Leading and training young people', 'Discipline and structure', 'Subject expertise'], time: 'months', path: 'RESET', fit: 'stretch', why: 'Programs for veterans fast-track you into teaching, especially in STEM and career-technical subjects.' },
      { to: 'public_safety', brings: ['Discipline', 'Training under pressure', 'Teamwork'], time: 'months', path: 'RESET', fit: 'close', why: 'Police, fire and EMS departments recruit veterans, and many give academy credit for service.' },
      { to: 'it_infrastructure', brings: ['Systems and equipment', 'Security clearance', 'Troubleshooting'], time: 'months', path: 'KEEP_SENIORITY', fit: 'adjacent', why: 'IT and cybersecurity roles value military technical training and clearances.' },
    ],
  },
]

export const SOURCES: ReadonlyMap<string, PivotSource> = new Map(SOURCE_LIST.map((s) => [s.role, s]))

// ── Source detection ────────────────────────────────────────────────────────

/** Checked in order against the member's latest title — most specific first. */
export const SOURCE_DETECT_ORDER = [
  'recruiter',
  'hrbp',
  'hr_generalist',
  'customer_service',
  'customer_success',
  'account_management',
  'sales',
  'marketing',
  'project_program',
  'consulting',
  'investment',
  'finance_accounting',
  'education_admin',
  'teaching',
  'nonprofit_programs',
  'journalism',
  'physician',
  'nursing_clinical',
  'admin_ea',
  'data_analytics',
  'scientist',
  'engineering',
  'product',
  'design',
  'legal',
  'retail_management',
  'hospitality',
  'military_government',
  'physical_engineering',
  'it_infrastructure',
  'financial_advisor',
  'social_work',
  'facilities_real_estate',
  'clergy',
  'public_safety',
  'food_service',
  'operations',
  'executive',
] as const

/** When the title doesn't say, the member's function picks a default source. General / Other have none. */
export const FUNCTION_DEFAULT_SOURCE: Partial<Record<PrimaryFunction, string>> = {
  'Human Resources': 'hr_generalist',
  'Customer Success': 'customer_success',
  Sales: 'sales',
  Marketing: 'marketing',
  Operations: 'operations',
  Finance: 'finance_accounting',
  Administration: 'admin_ea',
  'Data & Analytics': 'data_analytics',
  Engineering: 'engineering',
  Product: 'product',
  Design: 'design',
  Legal: 'legal',
  'Executive Leadership': 'executive',
}

/**
 * Which source role a member is coming from: their latest title first (more
 * specific: "Recruiter" beats "Human Resources"), then their function.
 */
export function detectSourceRole(member: { title?: string | null; primaryFunction?: string | null }): string | null {
  const title = (member.title ?? '').toLowerCase()
  if (title.trim()) {
    for (const key of SOURCE_DETECT_ORDER) {
      if (ROLES.get(key)!.titles.test(title)) return key
    }
  }
  const fn = member.primaryFunction as PrimaryFunction | undefined
  return (fn && FUNCTION_DEFAULT_SOURCE[fn]) || null
}

/** Every role whose market numbers the nightly job counts: all sources and all targets. */
export function marketRoleKeys(): string[] {
  return [...ROLES.keys()]
}

/** Board filter for "Show me these jobs": does this title belong to the pivot target? */
export function titleMatchesRole(roleKey: string, title: string): boolean {
  const role = ROLES.get(roleKey)
  return !!role && role.titles.test(title.toLowerCase())
}

/** The map role a job title belongs to (first match in catalog order), or null. */
export function roleForTitle(title: string): string | null {
  const t = title.toLowerCase()
  for (const r of ROLES.values()) if (r.titles.test(t)) return r.key
  return null
}

/** The board filtered to a pivot target (find-my-job reads `pivot`). */
export function pivotJobsHref(target: string): string {
  return `/dashboard/find-my-job?pivot=${encodeURIComponent(target)}#job-recommendations`
}
