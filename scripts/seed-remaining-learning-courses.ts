// One-time migration: copies the remaining 4 static Learning-page catalog
// files (Business Skills General/Leadership + Emeritus, Certifications by
// Function, Function Training by keyword, Speaking/Leadership) into the
// admin-managed Course table, completing the AI-Training-only migration
// from the earlier pass. Safe to re-run — skips any (title, url) combo
// that already exists, so an admin's later edits are never overwritten.
//
// Run: npm run seed:remaining-learning-courses

import { PrismaClient, type CourseCategory, type CourseSkillLevel } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedCourse {
  category: CourseCategory
  title: string
  sponsor: string
  description: string
  url: string
  provider: string
  free: boolean
  skillLevel: CourseSkillLevel
  targetFunctions?: string[]
  keywords?: string[]
  requiresManagementSignal?: boolean
  excludeIfHasMBA?: boolean
}

const COURSES: SeedCourse[] = [
  // --- Business Skills: General (excluded for MBA holders) ---
  {
    category: 'BUSINESS_SKILLS',
    title: 'Business Foundations Specialization',
    sponsor: 'Wharton',
    description: 'A specialization covering the core disciplines — finance, marketing, operations, strategy.',
    url: 'https://www.coursera.org/specializations/wharton-business-foundations',
    provider: 'coursera',
    free: false,
    skillLevel: 'BEGINNER',
    excludeIfHasMBA: true,
  },
  {
    category: 'BUSINESS_SKILLS',
    title: 'Successful Negotiation: Essential Strategies and Skills',
    sponsor: 'University of Michigan',
    description: 'A widely-taken course on negotiation fundamentals.',
    url: 'https://www.coursera.org/learn/negotiation-skills',
    provider: 'coursera',
    free: false,
    skillLevel: 'BEGINNER',
    excludeIfHasMBA: true,
  },
  {
    category: 'BUSINESS_SKILLS',
    title: 'Finance for Everyone',
    sponsor: 'McMaster University',
    description: 'An accessible introduction to core financial concepts for non-finance roles.',
    url: 'https://www.coursera.org/specializations/finance-for-everyone',
    provider: 'coursera',
    free: false,
    skillLevel: 'BEGINNER',
    excludeIfHasMBA: true,
  },
  {
    category: 'BUSINESS_SKILLS',
    title: 'Project Management Principles and Practices',
    sponsor: 'UC Irvine',
    description: 'A specialization covering core project-management fundamentals.',
    url: 'https://www.coursera.org/specializations/project-management',
    provider: 'coursera',
    free: false,
    skillLevel: 'BEGINNER',
    excludeIfHasMBA: true,
  },
  {
    category: 'BUSINESS_SKILLS',
    title: 'Emeritus executive certificate catalog',
    sponsor: 'Emeritus',
    description:
      'University-branded executive certificate programs delivered online — a broader, paid catalog worth browsing if you want something more structured than a single course.',
    url: 'https://emeritus.org/',
    provider: 'emeritus',
    free: false,
    skillLevel: 'ADVANCED',
    excludeIfHasMBA: true,
  },
  // --- Business Skills: Leadership (requires management signal) ---
  {
    category: 'BUSINESS_SKILLS',
    title: 'Strategic Leadership and Management Specialization',
    sponsor: 'University of Illinois',
    description: 'A specialization on leading teams and organizations strategically.',
    url: 'https://www.coursera.org/specializations/strategic-leadership',
    provider: 'coursera',
    free: false,
    skillLevel: 'INTERMEDIATE',
    requiresManagementSignal: true,
  },
  {
    category: 'BUSINESS_SKILLS',
    title: 'Leading People and Teams Specialization',
    sponsor: 'University of Michigan',
    description: 'A specialization on the practical skills of managing and motivating people.',
    url: 'https://www.coursera.org/specializations/leading-teams',
    provider: 'coursera',
    free: false,
    skillLevel: 'INTERMEDIATE',
    requiresManagementSignal: true,
  },
  {
    category: 'BUSINESS_SKILLS',
    title: 'People Analytics',
    sponsor: 'Wharton',
    description: 'A course on using data to make better people-management decisions.',
    url: 'https://www.coursera.org/learn/wharton-people-analytics',
    provider: 'coursera',
    free: false,
    skillLevel: 'INTERMEDIATE',
    requiresManagementSignal: true,
  },

  // --- Certifications by function ---
  { category: 'CERTIFICATION', title: 'Project Management Professional (PMP)', sponsor: 'PMI', description: 'The most widely recognized project-management certification across industries.', url: 'https://www.pmi.org/certifications/project-management-pmp', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Operations'] },
  { category: 'CERTIFICATION', title: 'Lean Six Sigma Green Belt', sponsor: 'Coursera', description: 'Process-improvement methodology recognized in manufacturing, healthcare, and operations broadly.', url: 'https://www.coursera.org/professional-certificates/lean-six-sigma-green-belt', provider: 'coursera', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Operations'] },
  { category: 'CERTIFICATION', title: 'CPIM (Certified in Planning and Inventory Management)', sponsor: 'APICS/ASCM', description: 'A supply-chain and operations-planning certification.', url: 'https://www.ascm.org/certifications/cpim/', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Operations'] },
  { category: 'CERTIFICATION', title: 'CPA (Certified Public Accountant)', sponsor: 'AICPA', description: 'The standard credential for accounting and financial-reporting roles in the US.', url: 'https://www.aicpa-cima.com/becomeacpa', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Finance'] },
  { category: 'CERTIFICATION', title: 'CFA (Chartered Financial Analyst)', sponsor: 'CFA Institute', description: 'The gold-standard credential for investment and financial-analysis roles.', url: 'https://www.cfainstitute.org/programs/cfa-program', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Finance'] },
  { category: 'CERTIFICATION', title: 'CMA (Certified Management Accountant)', sponsor: 'IMA', description: 'Focused on management accounting and financial strategy, distinct from public-accounting CPA work.', url: 'https://www.imanet.org/cma-certification', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Finance'] },
  { category: 'CERTIFICATION', title: 'Salesforce Administrator Certification', sponsor: 'Salesforce', description: 'The standard credential for Salesforce platform administration — widely required in sales-ops job postings.', url: 'https://trailhead.salesforce.com/credentials/administrator', provider: 'certificationBody', free: true, skillLevel: 'INTERMEDIATE', targetFunctions: ['Sales'] },
  { category: 'CERTIFICATION', title: 'Sales Development Representative Professional Certificate', sponsor: 'Salesforce', description: 'A practical certificate covering the SDR/BDR pipeline-generation skill set.', url: 'https://www.coursera.org/professional-certificates/salesforce-sales-development-representative', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', targetFunctions: ['Sales'] },
  { category: 'CERTIFICATION', title: 'AWS Certified Solutions Architect', sponsor: 'AWS', description: 'The most widely requested cloud-architecture certification in engineering job postings.', url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Engineering'] },
  { category: 'CERTIFICATION', title: 'Microsoft Certified: Azure Administrator (AZ-104)', sponsor: 'Microsoft', description: 'The standard Azure administration credential for engineers working in Microsoft-stack environments.', url: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Engineering'] },
  { category: 'CERTIFICATION', title: 'Certified Kubernetes Administrator (CKA)', sponsor: 'CNCF', description: 'The recognized credential for Kubernetes/container-orchestration expertise.', url: 'https://www.cncf.io/training/certification/cka/', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Engineering'] },
  { category: 'CERTIFICATION', title: 'SHRM-CP (Society for Human Resource Management Certified Professional)', sponsor: 'SHRM', description: 'The most widely recognized generalist HR certification in the US.', url: 'https://www.shrm.org/credentials/certification', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Human Resources'] },
  { category: 'CERTIFICATION', title: 'PHR (Professional in Human Resources)', sponsor: 'HRCI', description: 'A foundational HR-generalist certification, commonly requested alongside SHRM-CP.', url: 'https://www.hrci.org/our-programs/our-certifications/phr', provider: 'certificationBody', free: false, skillLevel: 'INTERMEDIATE', targetFunctions: ['Human Resources'] },
  { category: 'CERTIFICATION', title: 'CIPP/US (Certified Information Privacy Professional)', sponsor: 'IAPP', description: 'The standard privacy-law certification, increasingly requested for in-house counsel and compliance roles.', url: 'https://iapp.org/certify/cippus/', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Legal'] },
  { category: 'CERTIFICATION', title: 'CCEP (Certified Compliance and Ethics Professional)', sponsor: 'SCCE', description: 'A widely recognized credential for corporate compliance roles.', url: 'https://www.corporatecompliance.org/certification/ccep', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Legal'] },
  { category: 'CERTIFICATION', title: 'Google Data Analytics Certificate', sponsor: 'Google', description: 'A widely recognized, practical entry point into data-analytics tooling and workflows.', url: 'https://www.coursera.org/professional-certificates/google-data-analytics', provider: 'coursera', free: false, skillLevel: 'BEGINNER', targetFunctions: ['Data & Analytics'] },
  { category: 'CERTIFICATION', title: 'Microsoft Certified: Power BI Data Analyst Associate (PL-300)', sponsor: 'Microsoft', description: 'The standard BI-tooling certification for analysts working in Microsoft-stack environments.', url: 'https://learn.microsoft.com/en-us/credentials/certifications/power-bi-data-analyst-associate/', provider: 'certificationBody', free: false, skillLevel: 'INTERMEDIATE', targetFunctions: ['Data & Analytics'] },
  { category: 'CERTIFICATION', title: 'Customer Success Manager Certification (Success Coaching)', sponsor: 'Success Coaching', description: 'A widely used practical certification covering the CSM playbook (onboarding, renewals, expansion).', url: 'https://www.successcoaching.co/certifications/certified-customer-success-manager', provider: 'certificationBody', free: false, skillLevel: 'INTERMEDIATE', targetFunctions: ['Customer Success'] },
  { category: 'CERTIFICATION', title: 'Google UX Design Professional Certificate', sponsor: 'Google', description: 'The most widely recognized entry-level UX certification, built around a portfolio-ready capstone.', url: 'https://www.coursera.org/professional-certificates/google-ux-design', provider: 'coursera', free: false, skillLevel: 'BEGINNER', targetFunctions: ['Design'] },
  { category: 'CERTIFICATION', title: 'Certified Administrative Professional (CAP)', sponsor: 'IAAP', description: 'A recognized generalist credential for administrative and executive-support roles.', url: 'https://www.iaap-hq.org/page/cap', provider: 'certificationBody', free: false, skillLevel: 'INTERMEDIATE', targetFunctions: ['Administration'] },
  { category: 'CERTIFICATION', title: 'NACD Directorship Certification', sponsor: 'NACD', description: 'The recognized board-governance credential — most of the genuinely substantive executive-leadership certification universe.', url: 'https://www.nacdonline.org/education/directorship-certification/', provider: 'certificationBody', free: false, skillLevel: 'ADVANCED', targetFunctions: ['Executive Leadership'] },

  // --- Function training (keyword-matched) ---
  { category: 'FUNCTION_TRAINING', title: 'Business and Financial Modeling Specialization', sponsor: 'Wharton', description: 'A specialization on building real financial models.', url: 'https://www.coursera.org/specializations/wharton-finance', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['finance', 'accounting', 'cfo', 'controller', 'fp&a'] },
  { category: 'FUNCTION_TRAINING', title: 'Digital Marketing Specialization', sponsor: 'University of Illinois', description: 'A specialization covering the full digital-marketing toolkit.', url: 'https://www.coursera.org/specializations/digital-marketing', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['marketing', 'brand', 'growth', 'demand'] },
  { category: 'FUNCTION_TRAINING', title: 'HubSpot Academy: Digital Marketing Course', sponsor: 'HubSpot', description: 'A free, widely recognized digital-marketing fundamentals course.', url: 'https://academy.hubspot.com/courses/digital-marketing', provider: 'hubspotAcademy', free: true, skillLevel: 'BEGINNER', keywords: ['marketing', 'brand', 'growth', 'demand'] },
  { category: 'FUNCTION_TRAINING', title: 'Sales Operations/Management Specialization', sponsor: 'West Virginia University', description: 'A specialization on the sales-ops and management fundamentals.', url: 'https://www.coursera.org/specializations/sales-operations', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['sales', 'account executive', 'business development', 'revenue'] },
  { category: 'FUNCTION_TRAINING', title: 'IBM Full Stack Software Developer Professional Certificate', sponsor: 'IBM', description: 'A practical, project-based full-stack development certificate.', url: 'https://www.coursera.org/professional-certificates/ibm-full-stack-cloud-developer', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['engineer', 'developer', 'software', 'technical'] },
  { category: 'FUNCTION_TRAINING', title: "CS50x: Introduction to Computer Science", sponsor: 'Harvard', description: 'A free-to-audit foundational computer-science course.', url: 'https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science', provider: 'edx', free: true, skillLevel: 'BEGINNER', keywords: ['engineer', 'developer', 'software', 'technical'] },
  { category: 'FUNCTION_TRAINING', title: 'Human Resource Management Specialization', sponsor: 'University of Minnesota', description: 'A specialization covering the core HR management disciplines.', url: 'https://www.coursera.org/specializations/human-resource-management', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['human resources', 'hr', 'talent', 'recruit', 'people'] },
  { category: 'FUNCTION_TRAINING', title: 'Supply Chain Management Specialization', sponsor: 'Rutgers', description: 'A specialization on core supply-chain and operations fundamentals.', url: 'https://www.coursera.org/specializations/supply-chain-management', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['operations', 'supply chain', 'logistics'] },
  { category: 'FUNCTION_TRAINING', title: 'Contract Law Specialization', sponsor: 'Wesleyan University', description: 'A course on the fundamentals of contract law.', url: 'https://www.coursera.org/learn/contract-law', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['legal', 'counsel', 'compliance'] },
  { category: 'FUNCTION_TRAINING', title: 'Google UX Design Professional Certificate', sponsor: 'Google', description: 'Also listed under Certifications — the same program, a full practical UX training path.', url: 'https://www.coursera.org/professional-certificates/google-ux-design', provider: 'coursera', free: false, skillLevel: 'BEGINNER', keywords: ['designer', 'ux', 'ui/ux', 'product design', 'creative director', 'design'] },
  { category: 'FUNCTION_TRAINING', title: 'Customer Success Specialization', sponsor: 'Coursera', description: 'Practical training on onboarding, retention, and expansion fundamentals.', url: 'https://www.coursera.org/specializations/customer-success', provider: 'coursera', free: false, skillLevel: 'INTERMEDIATE', keywords: ['customer success', 'customer support', 'client success', 'implementation manager'] },
  { category: 'FUNCTION_TRAINING', title: 'Google Data Analytics Professional Certificate', sponsor: 'Google', description: 'Also listed under Certifications — the same program, a full practical analytics training path.', url: 'https://www.coursera.org/professional-certificates/google-data-analytics', provider: 'coursera', free: false, skillLevel: 'BEGINNER', keywords: ['data scientist', 'data analyst', 'analytics', 'business intelligence', 'bi analyst', 'machine learning engineer', 'ml engineer', 'data & analytics'] },
  { category: 'FUNCTION_TRAINING', title: 'High Performance Collaboration: Leadership, Teamwork, and Negotiation', sponsor: 'Northwestern', description: 'A course on leading at the executive level.', url: 'https://www.coursera.org/learn/negotiation-skills', provider: 'coursera', free: false, skillLevel: 'ADVANCED', keywords: ['chief executive', 'chief operating', 'chief financial', 'ceo', 'coo', 'cfo', 'cto', 'cmo', 'cpo', 'president', 'general manager', 'executive leadership'] },
  { category: 'FUNCTION_TRAINING', title: 'Workplace Communication for Administrative Professionals', sponsor: 'Coursera', description: 'Practical training on the core administrative-support skill set.', url: 'https://www.coursera.org/learn/workplace-communication', provider: 'coursera', free: false, skillLevel: 'BEGINNER', keywords: ['administrative assistant', 'office manager', 'executive assistant', 'administration'] },

  // --- Speaking (general + leadership-gated) ---
  {
    category: 'SPEAKING',
    title: 'Toastmasters International',
    sponsor: 'Toastmasters',
    description: 'The most established public-speaking practice community — local clubs meet weekly.',
    url: 'https://www.toastmasters.org/',
    provider: 'toastmasters',
    free: false,
    skillLevel: 'BEGINNER',
  },
  {
    category: 'SPEAKING',
    title: 'Dynamic Public Speaking Specialization',
    sponsor: 'University of Washington',
    description: 'A specialization on structuring and delivering a talk.',
    url: 'https://www.coursera.org/specializations/public-speaking',
    provider: 'coursera',
    free: false,
    skillLevel: 'BEGINNER',
  },
  {
    category: 'SPEAKING',
    title: 'Inspiring Leadership through Emotional Intelligence',
    sponsor: 'Case Western Reserve University',
    description: 'A widely-taken course on leadership presence and self-awareness.',
    url: 'https://www.coursera.org/learn/emotional-intelligence-leadership',
    provider: 'coursera',
    free: false,
    skillLevel: 'INTERMEDIATE',
    requiresManagementSignal: true,
  },
  {
    category: 'SPEAKING',
    title: 'Leadership Communication for Maximum Impact: Storytelling',
    sponsor: 'Notre Dame',
    description: 'A course on communicating as a leader through narrative and story structure.',
    url: 'https://www.edx.org/learn/business-storytelling/university-of-notre-dame-leadership-communication-for-maximum-impact-storytelling',
    provider: 'edx',
    free: false,
    skillLevel: 'INTERMEDIATE',
    requiresManagementSignal: true,
  },
]

async function main() {
  let created = 0
  let skipped = 0
  for (const [i, course] of COURSES.entries()) {
    // Keyed on (title, url, category) rather than just (title, url) — the
    // Google UX Design and Data Analytics certs are deliberately listed
    // twice in the old static content, once under Certifications and once
    // under Function Training, so they show in both relevant sections.
    const existing = await prisma.course.findFirst({
      where: { title: course.title, url: course.url, category: course.category },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.course.create({
      data: {
        ...course,
        targetFunctions: course.targetFunctions ?? [],
        keywords: course.keywords ?? [],
        requiresManagementSignal: course.requiresManagementSignal ?? false,
        excludeIfHasMBA: course.excludeIfHasMBA ?? false,
        sortOrder: i,
      },
    })
    created++
  }
  console.log(`Created ${created} courses, skipped ${skipped} already-existing courses.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
