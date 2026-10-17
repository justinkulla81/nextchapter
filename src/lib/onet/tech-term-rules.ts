// How an O*NET technology name ("Amazon Web Services AWS software", "Atlassian
// JIRA", "Cascading style sheets CSS") is written in job postings, for the posting
// skill scan. Pure; scripts/pivots/import-onet.ts applies it to every O*NET Hot
// Technology / In Demand tool and src/test/onet-tech-terms.test.ts checks it.
//
// Precision first: a tool whose short name is an everyday word ("Slack", "Zoom",
// "Microsoft Word", "Swift") or that is a category rather than a product
// ("Payroll software") is left out or kept only under its full name.

/** Categories and words too ambiguous to scan for. */
const EXCLUDE = new Set(
  [
    'business software applications', 'chatbot software', 'clinical trial management software', 'disassembler software',
    'electronic lab notebook software', 'embedded systems development software', 'firewall software', 'inventory control system software',
    'inventory management systems', 'javascript framework software', 'order management software', 'patient management software',
    'payroll software', 'productivity software', 'purchasing software', 'relational database management system software', 'reporting software',
    'software development tools', 'statistical software', 'tax compliance property tax management software', 'tax software',
    'vector database software', 'version control software', 'video editing software', 'web application framework software',
    'web application software', 'web browser software', 'web server software', 'applicant tracking software', 'google', 'facebook',
    'tiktok', 'r', 'c', 'go', 'swift', 'chef', 'puppet', 'slack', 'zoom', 'unity technologies unity', 'bootstrap', 'magellan firmware',
    'operational data store ods software', 'outage management system oms', 'property management system pms software',
    'student information systems sis software', 'simulation program with integrated circuit emphasis spice', 'microsoft office software',
    'google workspace software', 'microsoft power platform software', 'oracle cloud software', 'sap software',
    // "Rest assured, ...", Airbus SAS (French company suffix)
    'rest assured', 'sas',
  ].map((s) => s.toLowerCase())
)

/** Vendor prefixes whose remainder is how people write the tool ("Adobe Photoshop" -> "photoshop"). Longest first. */
const VENDORS = [
  'amazon web services aws', 'amazon web services', 'blackbaud the', 'dassault systemes', 'grafana labs', 'guidance software',
  'henry schein', 'national instruments', 'red hat', 'the mathworks', 'thomson reuters', 'unreal technology', 'portswigger', 'statacorp',
  'techsmith', 'mathworks', 'microsoft', 'atlassian', 'autodesk', 'springshare', 'amazon', 'oracle', 'adobe', 'google', 'apache', 'apple',
  'intuit', 'kronos', 'mozilla', 'mcneel', 'maxon', 'esri', 'ibm', 'sap', 'ptc', 'cisco', 'siemens', 'bentley', 'trimble', 'tenable',
  'qualys', 'splunk', 'sidefx', 'xactware', 'sparta systems', 'constructconnect', 'chaos', 'cubic', 'forsk', 'aurora', 'rockware', 'ptv',
]

/** Everyday words a vendor-less remainder must not be ("Microsoft Project" -> not "project"). */
const COMMON = new Set([
  'word', 'project', 'teams', 'access', 'outlook', 'edge', 'office', 'drive', 'meet', 'docs', 'sheets', 'cloud', 'windows', 'database',
  'analytics', 'ads', 'workspace', 'server', 'studio', 'safari', 'enterprise', 'concur', 'erp', 'spark', 'maya', 'go', 'swift', 'unity',
  'inventor', 'creo', 'edge', 'meet', 'enterprise', 'command', 'central command', 'software', 'cloud platform', 'insight', 'survey 123',
  'spice', 'sis', 'pms', 'ods', 'oms', 'rust', 'ci', 'arcview', 'navisworks', 'api', 'ide', 'orm', 'crs', 'ehr', 'asp',
  'audition', 'hive', 'atoll', 'enterprise linux', 'tag manager',
  // Medicare's CMS; transport-management vs. other TMS
  'cms', 'tms',
])

const FILLER_TAIL = /\s+(software applications|software|ci)$/i
const ACRONYM = /^[A-Z][A-Z0-9]{2,5}$|^PCIe$|^J2EE$/

export interface TechTerm {
  /** What the gap list shows: the short name postings use. */
  term: string
  /** Lowercase phrases that mean this tool in a posting, matched as whole words. */
  aliases: string[]
}

export function techTermEntry(onetName: string): TechTerm | null {
  const name = onetName.trim()
  if (!name || EXCLUDE.has(name.toLowerCase())) return null
  const cleaned = name.replace(FILLER_TAIL, '').trim()
  const aliases = new Set<string>([cleaned.toLowerCase()])
  // Acronyms inside descriptive names: "Cascading style sheets CSS" -> "css" and "cascading style sheets".
  const words = cleaned.split(/\s+/)
  // Only an acronym that ends the name or a lowercase tail ("... VHDL simulation"): one in the
  // middle of a product name ("Amazon Web Services AWS CloudFormation") names the vendor.
  const acronyms = words
    .slice(1)
    .filter((w, i) => ACRONYM.test(w) && !COMMON.has(w.toLowerCase()) && words.slice(i + 2).every((t) => t === t.toLowerCase()))
  for (const a of acronyms) aliases.add(a.toLowerCase())
  // The spelled-out name too, when it is a description ("Cascading style sheets"), not a vendor ("Dassault Systemes").
  if (acronyms.length > 0 && words.slice(1).every((w) => acronyms.includes(w) || w === w.toLowerCase())) {
    const without = words.filter((w) => !acronyms.includes(w)).join(' ').toLowerCase()
    if (without.split(' ').length >= 2) aliases.add(without)
  }
  // Vendor prefix: "Atlassian JIRA" -> "jira", "Amazon Web Services AWS CloudFormation" -> "cloudformation".
  let short: string | null = null
  const lower = cleaned.toLowerCase()
  for (const v of VENDORS) {
    if (lower.startsWith(`${v} `)) {
      const rest = lower.slice(v.length + 1).trim()
      if (rest.length >= 3 && !COMMON.has(rest)) {
        aliases.add(rest)
        short = rest
      }
      break
    }
  }
  const lowerAcr = acronyms.length > 0 ? acronyms[acronyms.length - 1].toLowerCase() : null
  const term = (lowerAcr && aliases.has(lowerAcr) ? lowerAcr : null) ?? short ?? lower
  return { term, aliases: [...aliases].filter((a) => a.length >= 2).sort((a, b) => b.length - a.length) }
}
