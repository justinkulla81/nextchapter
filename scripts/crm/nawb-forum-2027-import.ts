/**
 * Presenters at NAWB Forum 2027 (April 5-8, 2027, New York Marriott Marquis), from
 * https://www.nawb.org/the-forum-2027/ . Workforce boards, public agencies, employers, training
 * providers and education only; trade groups, consultants, vendors and NAWB staff are left out on purpose.
 *
 *   RESEND_API_KEY= HUNTER_API_KEY= npx tsx --conditions=react-server --env-file=.env.local scripts/crm/nawb-forum-2027-import.ts [--apply]
 *
 * Dry run by default. People go through addContactToCrm, so an existing record is matched, a removed
 * person stays removed, and a same-name stranger lands on the Review List. No email is sent or looked up.
 */
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

type OrgType = 'GOVERNMENT' | 'EMPLOYER' | 'NONPROFIT' | 'FOUNDATION' | 'VENDOR'
type Row = [name: string, org: string, type: OrgType, session: string, state?: string]

const G: OrgType = 'GOVERNMENT', E: OrgType = 'EMPLOYER', N: OrgType = 'NONPROFIT'

const ROWS: Row[] = [
  // Workforce boards and public workforce agencies
  ['Amelia Reeves', 'Workforce Solutions of West Central Texas', G, 'From Classroom to Local Careers: Building Rural Talent Pipelines', 'TX'],
  ['Justin Arnold', 'East Central Illinois Workforce Development Board', G, 'Leading in Workforce Development: Local Governance in Action (also Illinois Workforce Association)', 'IL'],
  ['Amy Maberry', 'Tennessee State Workforce Development Board', G, 'Beyond Compliance: Workforce Board Excellence Assessment', 'TN'],
  ['Dionne M Smith', 'EmployIndy', N, 'From Contracts to a System: Creating Consistency Across Workforce Provider Networks', 'IN'],
  ['Amy Lebednick', 'West Michigan Works!', G, 'From Conversation to Action: Industry-Led Sector Partnerships; Apprenticeships That Work', 'MI'],
  ['Mathangi Subramanian', 'Denver Workforce Solutions', G, 'Leading Regional Change: How Collaboration is Reshaping the ECE Workforce', 'CO'],
  ['Lynn Hoffman', 'Workforce Solutions Greater Dallas', G, 'Build, Don’t Buy: How One Workforce Board Used AI to Solve a Career Navigation Challenge', 'TX'],
  ['Will Weidner', 'Workforce Solutions Greater Dallas', G, 'Build, Don’t Buy: How One Workforce Board Used AI to Solve a Career Navigation Challenge', 'TX'],
  ['Ryan McAlister', 'Fresno Regional Workforce Development Board', G, 'Designing the Workforce Agency of 2030: Leading Through the Age of AI', 'CA'],
  ['Edgar Blunt', 'Fresno Regional Workforce Development Board', G, 'Plotting the Course: Why Traditional Skills Fail in Uncertainty (also IMAGO)', 'CA'],
  ['Steve Avila', 'Fresno Regional Workforce Development Board', G, 'Values & Attitudes in Action: Building a Workforce Culture People Can Trust (also Trillium Flow Technologies)', 'CA'],
  ['Hannah Lee', 'City of Los Angeles Workforce Development Board', G, 'Designing Workforce Systems for Workers 55+', 'CA'],
  ['Ty Cauthen', 'Workforce Solutions Deep East Texas', G, 'Reimagining Teacher Externships for Rural Communities', 'TX'],
  ['Mark Johnston', 'Larimer Economic and Workforce Solutions', G, 'The Power of One Roof: How Co-Location Accelerates Employer Engagement', 'CO'],
  ['Tony Anderson', 'Denver Workforce Solutions', G, 'The Power of One Roof: How Co-Location Accelerates Employer Engagement (organization assigned from a shared listing)', 'CO'],
  ['Balise King', 'Accelerate MS', G, 'Beyond the List: A Hands-On Lab for Identifying Credentials That Create Real Economic Value', 'MS'],
  ['Ryan Hundt', 'Michigan Works Association', N, 'The Integration Imperative: Rethinking How Workforce Boards Deliver', 'MI'],
  ['Adrienne Johnston', 'CareerSource Florida', G, 'Apprenticeship Starts Local: How Florida’s Workforce Boards Built a National Model', 'FL'],
  ['LaSetta Hogan', 'City of Phoenix Business and Workforce Development Board', G, 'Rising Phoenix Apprenticeship: A Semiconductor Talent Model Powered by TSMC', 'AZ'],
  ['Anna Ramos', 'Lancaster County Workforce Development Board', G, 'Leading Beyond the Boardroom: Convening and Activating a Regional Workforce Strategy', 'PA'],
  ['Alexandria D. Wright', 'Nevadaworks', N, 'Economic Impact of Industry Sector Partnerships: a case study on Northern Nevada', 'NV'],
  ['Rebecca Evans', 'Workforce Development Board of Ventura County', G, 'Using GIS Mapping to Improve Data Informed Workforce Planning', 'CA'],
  ['Steven Nguyen', 'CareerSource Central Florida', G, 'AI in Action: A Human Centered Approach to Workforce Innovation', 'FL'],
  ['Sonya S Gant', 'ASPRYR Workforce Board', G, 'Beyond Transactions: AI-Powered Workforce Transformation (also Equus Workforce Solutions)'],
  ['Liz Mulei', 'Denver Workforce Services', G, 'From Outreach to Impact: Innovative Youth Engagement That Transforms Communities', 'CO'],
  ['David Olson', 'Workforce Solutions Capital Area', G, 'Capturing Impact: Stories, Testimonials, and Community Voices', 'TX'],
  ['Jinny Rietmann', 'Southeast Minnesota Workforce Development Board', G, 'The Room You Make: How members create the conditions for engagement', 'MN'],
  ['Claire Benton', 'Workforce Boulder', G, 'Building a Community of Practice: Workforce Boulder County’s Coaching Lab', 'CO'],
  ['James Disbro', 'CareerSource Suncoast', G, 'Modernizing Apprenticeships by Embedding AI Across All Occupations', 'FL'],
  ['Taylor Black', 'Champaign County Regional Planning Commission', G, 'Working Across Laborshed: Building Rivian’s Workforce Pipeline', 'IL'],
  ['Becky Kikkert', 'Workforce Development Board of South Central Wisconsin', G, 'From Convener to Catalyst: Workforce Boards Shaping Regional Talent Pipelines', 'WI'],
  ['Beth Yoke', 'Workforce Council of Southwest Ohio', G, 'Navigating What’s Next: AI, 18-24 Year Olds, and the Humans Who Help', 'OH'],
  ['Renise Walker', 'Colorado Workforce Development Council', G, 'Unlocking Quantum Futures', 'CO'],
  ['Jessica Maiorca', 'Colorado Workforce Development Council', G, 'Create a Sustainable Funding Strategy for Your Public Workforce System', 'CO'],
  ['Miranda Swafford', 'Eastern Iowa Workforce Development Board', G, 'From Four Staff to Greater Capacity: Building an AI-Enabled Workforce Organization; More Than a Merger', 'IA'],
  ['Jason W. Papanikolas', 'Anne Arundel Workforce Development Corporation', G, 'From Ad Hoc to Institutionalized: Building a Policy Development Program', 'MD'],
  ['Shawnice Meador', 'NC Capital Area Workforce Development Board', G, 'Transform: How to Maximize the LinkedIn Presence of Your Workforce Development Board', 'NC'],
  ['Diana Carranza', 'Workforce Solutions for North Central Texas', G, 'Content as a Service: Turning Workforce Insight into Practical Tools', 'TX'],
  ['Jeremy Warren', 'Workforce Development Council of Seattle King', G, 'Shared Intelligence: Turning One Workforce Index into Your Region’s Connective Tissue', 'WA'],
  ['Louise McLoughlin', 'Dutchess County Workforce Development Board', G, 'Making Universal Real: Building a Child Care System', 'NY'],
  ['Cris Ritchie', 'Eastern Kentucky Concentrated Employment Programs', N, 'From Vision to Live System: The Executive Case for AI-Enabled Workforce Services', 'KY'],
  ['Rachel R Adams', 'Bluegrass Area Development District', G, 'Career Exploration and Beyond the Classroom', 'KY'],
  ['Jarvis Washington', 'CareerSource South Florida', G, 'Smart Tools, Strong Talent: Modernizing Apprenticeship Management', 'FL'],
  ['Kelly Moreno', 'Workforce Solutions Rural Capital Area', G, 'When Growth Outpaces Talent: Building a Regional Workforce Pipeline', 'TX'],
  ['Brian Williams', 'Capital Region Workforce Development Board', G, 'From Programs to Ecosystem: How regional NY Partners Are Reshaping Workforce Development', 'NY'],
  ['Gregory J Morris', 'New York Employment and Training Coalition', N, 'Measuring What Matters: From Job Counts to Economic Mobility', 'NY'],
  ['John Casella', 'Job Works, Inc.', N, 'Connecting TANF participants to tech-adjacent careers'],
  ['Mary Greenfield', 'The Council of State Governments', N, 'Expanding Opportunity: Using Apprenticeship to Unlock Overlooked Talent'],
  ['Jeffrey Thompson', 'AIXcelerate Strategies Inc', 'VENDOR', 'WorkReadiness in the Age of AI (also USC Annenberg School of Communication)'],
  ['Michelle Foley', 'Lockheed Martin', E, 'Leading Aerospace Workforce Innovation: How Lockheed Martin & Workforce Colorado Transformed Talent Pipelines Through AMTAP (organization not listed on the agenda; Lockheed Martin / Workforce Colorado is a guess)', 'CO'],
  ['Richard Brandon Toya', 'Lockheed Martin', E, 'Leading Aerospace Workforce Innovation: How Lockheed Martin & Workforce Colorado Transformed Talent Pipelines Through AMTAP (organization not listed on the agenda; Lockheed Martin / Workforce Colorado is a guess)', 'CO'],

  // Employers, training providers and education
  ['Alice Yu', 'KPMG', E, 'AI: Enabler, Eliminator, or Elevator? Reimagining Workforce Roles in the Age of Automation'],
  ['La’Kishia Harris', 'Turner Construction Company', E, 'Beyond the Career Fair: Designing an Employer-Led Workforce Pipeline'],
  ['Michelle Powell', 'Erlanger Health', E, 'Creating Healthcare Talent Pipelines: How Employer Partnerships Transform Student Career Pathways', 'TN'],
  ['Kassandra Aguilera', 'Goodwill Southern California', N, 'Lessons from Goodwill Southern California’s AI Beginner Workforce Initiative', 'CA'],
  ['Priya Ramanathan', 'Per Scholas', N, 'The Future of Workforce Development is Local: Workforce Board / Training Provider Collaboration'],
  ['Melody McKee', 'Healthcare Training Fund', N, 'Collaboration Through Apprenticeship: Catalyzing the Behavioral Health Workforce'],
  ['Robert Moore', 'COABE', N, 'Innovative Workforce Partnerships with Adult Basic Education'],
  ['Carolyn Zachry', 'CASAS', N, 'Keeping the “WE” in WIOA: Building Stronger Title I and Title II Partnerships'],
  ['Alyssa Chudnofsky', 'The College Board', N, 'The Indiana Blueprint: One State’s Model for Cyber Talent Grown at Home'],
  ['Clare Bertrand', 'The College Board', N, 'From Signal to System: Building Employer-Backed Talent Pipelines That Scale'],
  ['Marshall A Baker', 'TNTP', N, 'More Than a Career Fair: Building a Connected Education-to-Workforce Talent System'],
  ['Josh Copus', 'Jobs for the Future', N, 'From Inquiry to Action: How Workforce Boards Build Skills-First Ecosystems'],
  ['Penny Mickey', 'SHRM Foundation', 'FOUNDATION', 'Degree Optional, Skills Required: Lessons from the Skills-First Accelerator'],
  ['Amber Ivey', 'Social Finance', N, 'AI Use Cases for Workforce Boards'],
  ['Nick Beadle', 'Jobs That Work', N, 'Burning the Barriers: How to Do Supportive Services Better'],
  ['Tim Griffin', 'Results for America', N, 'Maximize Every Workforce Dollar; From Evidence to Action: Transitional Jobs Programs'],
  ['Marjorie Parker', 'JobsFirst', N, 'Scaling Local Workforce Infrastructure: Human Centered AI for Regional Ecosystems'],
  ['Jennifer Feldman', 'Specialisterne USA', E, 'Neuroinclusion in Apprenticeships'],
  ['Michael Frame', 'Manufacturers Talent Institute', N, 'From Awareness to Apprenticeship: Building Employer-Led Talent Pipelines'],
  ['Renee Zentz', 'Careers in Construction Colorado', N, 'From High School to Journeyman: Creating a Construction Workforce Pipeline', 'CO'],
  ['Patrick Combs', 'Equus Workforce Solutions', 'VENDOR', 'Excellence by Design: Building Workforce Systems That Perform'],
  ['Amanda Wagner', 'Equus Workforce Solutions', 'VENDOR', 'Medicaid Work Requirements: From Readiness to Reality'],
  ['Melissa Martinez', 'Grant Associates', 'VENDOR', 'From Reentry to Retention: Five Practices That Improve Employment Outcomes for Justice-Involved Jobseekers'],
  ['Monique Cole-Green', 'Grant Associates', 'VENDOR', 'Small Business, Big Impact: Workforce Partnerships That Fuel Economic Development and Career Pathways'],
  ['Brian Miller', 'Building Industry Association of Northern Kentucky', N, 'Building the Construction Workforce Ecosystem (also Enzweiler Building Institute)', 'KY'],
]

async function main() {
  const apply = process.argv.includes('--apply')
  if (process.env.RESEND_API_KEY || process.env.HUNTER_API_KEY) throw new Error('Blank RESEND_API_KEY and HUNTER_API_KEY first.')
  const roles = ['BD_PARTNER' as const]
  const tally = { added: 0, matched: 0, review: 0, removed: 0, orgsNew: 0, orgsExisting: 0 }
  const reviewed: string[] = []
  const seenOrgs = new Set<string>()
  // Boards and public agencies only; the employer/training/education rows wait on a customer-or-not sort.
  const cut = ROWS.findIndex((r) => r[0] === 'Alice Yu')
  // Second pass (2026-10-27): the employer/training/contractor presenters sorted as customers or partners.
  const PARTNERS = new Set(['Alice Yu', 'Michelle Powell', 'La\u2019Kishia Harris', 'Kassandra Aguilera', 'Priya Ramanathan', 'Josh Copus', 'Penny Mickey', 'Amber Ivey', 'Melody McKee', 'Patrick Combs', 'Amanda Wagner', 'Melissa Martinez', 'Monique Cole-Green', 'Sonya S Gant', 'Marjorie Parker'])
  const todo = process.argv.includes('--partners') ? ROWS.filter((r) => PARTNERS.has(r[0])) : process.argv.includes('--include-others') ? ROWS : ROWS.slice(0, cut)
  for (const [name, orgName, type, session, state] of todo) {
    const live = await prisma.crmPerson.findMany({ where: { fullName: { equals: name, mode: 'insensitive' }, deletedAt: null }, select: { id: true, notes: true } })
    if (live.length === 1) {
      // Already in the CRM (the org is often spelled differently): note the presentation, change nothing else.
      if (apply) {
        const note = `Presenting at NAWB Forum 2027 (April 5-8, 2027, New York): ${session}.`
        if (!live[0].notes?.includes('NAWB Forum 2027')) await prisma.crmPerson.update({ where: { id: live[0].id }, data: { notes: live[0].notes ? `${live[0].notes}\n\n${note}` : note } })
      }
      tally.matched++
      continue
    }
    if (!apply) {
      const dup = await prisma.crmPerson.findMany({ where: { fullName: { equals: name, mode: 'insensitive' }, deletedAt: null }, select: { id: true } })
      tally[dup.length ? 'matched' : 'added']++
      if (dup.length) reviewed.push(`${name} already in CRM (${dup.length})`)
      continue
    }
    const before = await prisma.crmOrganization.count()
    const org = await ensureOrg({ name: orgName, type, state })
    if ((await prisma.crmOrganization.count()) > before && !seenOrgs.has(org.id)) tally.orgsNew++
    else tally.orgsExisting++
    seenOrgs.add(org.id)
    const r = await addContactToCrm({
      fullName: name, title: 'Presenter, NAWB Forum 2027', email: null,
      orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: null,
      note: `Presenting at NAWB Forum 2027 (April 5-8, 2027, New York Marriott Marquis): ${session}. Source: nawb.org/the-forum-2027.`,
    })
    tally[r.outcome]++
    if (r.outcome === 'review') reviewed.push(name)
  }
  console.log(apply ? 'APPLIED' : 'DRY RUN', { rows: todo.length, ...tally })
  if (reviewed.length) console.log('Needs a look:', reviewed)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
