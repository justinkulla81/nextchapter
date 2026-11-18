// Sales-demo fixture: Carnegie Mellon University (/i/cmu).
//
// Public, sourced data gathered on Nov 17, 2026. The programs are CMU's own
// executive and professional education, each confirmed on its official page
// that day (name, price, credential), with the skills it teaches written the
// way job postings name them, for the skills bridge. Two School of Computer
// Science programs (Agentic AI, Artificial Intelligence) are left out: their
// pages publish no fee, and a demo price of $0 would read as free.
//
// Staff, members and gifts are fictional (see ../demo-seed.ts); staff emails
// use a .test domain so nothing can reach a real person. No logo: we have no
// license to CMU's marks, so the portal shows the name.

import type { DemoTenant } from '../demo-tenants'

const TEPPER = 'Tepper School of Business Executive Education'
const HEINZ = 'Heinz College Executive Education'
const SEI = 'Software Engineering Institute training'

export const CMU_TENANT: DemoTenant = {
  slug: 'cmu',
  name: 'Carnegie Mellon University',
  programBrandName: 'CMU NextChapter',
  // Carnegie Red, from CMU's published brand colors.
  accentColor: '#C41230',
  logoUrl: null,
  domains: ['cmu.edu', 'andrew.cmu.edu'],
  alumniCount: 146_000,
  includedSeats: 4_000,
  givingUrl: 'https://www.cmu.edu/engage/give/',
  staffEmailDomain: 'cmu-demo.test',
  tier: 'INSTITUTION',
  staff: [
    ['INSTITUTION_ADMIN', 'Morgan Reyes'],
    ['ALUMNI_RELATIONS', 'Taylor Okafor'],
    ['DEVELOPMENT', 'Jordan Lindgren'],
    ['CAREER_SERVICES', 'Casey Nakamura'],
    ['EMPLOYER_RELATIONS', 'Riley Fontaine'],
    ['COACH', 'Avery Castellano'],
    ['FACULTY', 'Prof. Quinn Adeyemi'],
    ['EXEC_ED', 'Drew Halvorsen'],
  ],
  // Fictional employers for the fictional members.
  employers: [
    'Allegheny Robotics Group',
    'Three Rivers Health Systems',
    'Strip District Software',
    'Monongahela Capital',
    'Ironbridge Autonomy',
    'Wynwood Data Labs',
    'Point State Insurance',
    'Biscayne Energy Partners',
    'Oakland Bio',
    'Duquesne Logistics',
  ],
  majors: [
    'Computer Science',
    'Information Systems',
    'Statistics and Data Science',
    'Electrical and Computer Engineering',
    'Mechanical Engineering',
    'Business Administration',
    'Economics',
    'Design',
    'Architecture',
    'Drama',
    'Public Policy and Management',
    'Psychology',
    'English',
    'Mathematical Sciences',
  ],
  majorSchools: {
    'Computer Science': 'School of Computer Science',
    'Information Systems': 'Dietrich College of Humanities and Social Sciences',
    'Statistics and Data Science': 'Dietrich College of Humanities and Social Sciences',
    'Electrical and Computer Engineering': 'College of Engineering',
    'Mechanical Engineering': 'College of Engineering',
    'Business Administration': 'Tepper School of Business',
    Economics: 'Dietrich College of Humanities and Social Sciences',
    Design: 'College of Fine Arts',
    Architecture: 'College of Fine Arts',
    Drama: 'College of Fine Arts',
    'Public Policy and Management': 'Heinz College of Information Systems and Public Policy',
    Psychology: 'Dietrich College of Humanities and Social Sciences',
    English: 'Dietrich College of Humanities and Social Sciences',
    'Mathematical Sciences': 'Mellon College of Science',
  },
  memberCount: 240,
  // Fictional groups shaped like CMU's alumni: two chapters, then industry groups that alumni join by major.
  groups: [
    { kind: 'chapter', name: 'Pittsburgh Chapter', metro: 'Pittsburgh', description: 'Happy hours, a fall service day and the spring career night.' },
    { kind: 'chapter', name: 'South Florida Chapter', metro: 'Miami', description: 'Alumni in Miami and South Florida, ahead of CMU Miami.' },
    { kind: 'affinity', name: 'Data and AI', metro: null, description: 'Alumni building and using AI and data, from research labs to product teams.', majors: ['Computer Science', 'Statistics and Data Science', 'Information Systems', 'Mathematical Sciences'] },
    { kind: 'affinity', name: 'Robotics and Manufacturing', metro: null, description: 'Robotics, autonomy and advanced manufacturing, Pittsburgh’s home industries.', majors: ['Mechanical Engineering', 'Electrical and Computer Engineering'] },
    { kind: 'affinity', name: 'Finance and Fintech', metro: null, description: 'Banking, investing, corporate finance and the startups changing them.', majors: ['Business Administration', 'Economics'] },
  ],
  // Fictional studies by the fictional professor below (no real CMU faculty, lab or project is named).
  researchRequests: [
    {
      title: 'How plants adopt AI for quality inspection',
      lab: 'Prof. Quinn Adeyemi, manufacturing systems research',
      description: 'Thirty-minute interviews with plant, quality and operations managers about where AI vision inspection worked, where it stalled, and what it cost. You get the findings before they are published.',
      fields: ['Manufacturing', 'Operations', 'Robotics'],
      durationWeeks: 8,
      compensation: 'volunteer',
    },
    {
      title: 'Survey: generative AI in financial forecasting',
      lab: 'Prof. Quinn Adeyemi, with a Tepper doctoral student',
      description: 'A fifteen-minute anonymous survey for FP&A, treasury and controllership staff on how they use generative AI in forecasts, plus optional follow-up calls. Results shared with everyone who takes part.',
      fields: ['Finance'],
      durationWeeks: 6,
      compensation: 'volunteer',
    },
    {
      title: 'A pilot site for warehouse robot safety',
      lab: 'Prof. Quinn Adeyemi, human-robot interaction study',
      description: 'We are looking for one or two warehouses or distribution centers willing to host a four-week observation study of how workers and mobile robots share aisles. Paid site fee; all data anonymized.',
      fields: ['Logistics', 'Robotics', 'Operations'],
      durationWeeks: 4,
      compensation: 'paid',
    },
  ],
  annualCheckInMonth: 10,
  // CMU's own office names, checked on cmu.edu Nov 18, 2026 (alumni relations policy, CPDC site, Swartz Center site).
  officeNames: {
    alumni: 'Alumni and Constituent Engagement',
    development: 'University Advancement',
    career: 'Career and Professional Development Center',
    ventures: 'Swartz Center for Entrepreneurship',
  },
  services: {
    events: { on: true },
    reviews: { on: true },
    exec_ed: { on: true, linkUrl: 'https://www.cmu.edu/tepper/executive-education/individual-programs' },
  },
  programs: [
    {
      name: 'Business Analytics: Data-Informed Decision-Making',
      summary: `${TEPPER}. Descriptive, predictive and prescriptive analytics (regression, decision trees, neural networks, optimization) for business problems, and communicating insights to executives. Live online, four sessions.`,
      audience: 'Managers and analysts',
      credential: '3 TEUs toward the Certificate in Executive Leadership + AI',
      priceCents: 450_000,
      wioaEligible: false,
      skills: ['business analytics', 'predictive modeling', 'data mining', 'optimization', 'data analysis'],
    },
    {
      name: 'AI for Business',
      summary: `${TEPPER}, developed with the School of Computer Science. Applied AI, physical AI and AI risk and governance, and finding high-impact AI opportunities. Online, self-paced, about 11 hours.`,
      audience: 'Business leaders at any level',
      credential: 'Certificate of completion; 1 TEU toward the Certificate in Executive Leadership + AI',
      priceCents: 175_000,
      wioaEligible: false,
      skills: ['artificial intelligence', 'generative AI', 'AI governance', 'risk management', 'machine learning'],
    },
    {
      name: 'Transformational AI & Business Strategy',
      summary: `${TEPPER}. Finding high-potential AI opportunities, weighing data, compute and people costs, taking AI from pilot to production, and building an AI roadmap. Pittsburgh, two days.`,
      audience: 'Senior leaders',
      credential: '3 TEUs toward the Certificate in Executive Leadership + AI',
      priceCents: 450_000,
      wioaEligible: false,
      skills: ['AI strategy', 'strategic planning', 'generative AI', 'change management', 'digital transformation'],
    },
    {
      name: 'Leading with Financial Insight: Understanding the Why Beyond the Numbers',
      summary: `${TEPPER}. Reading financial statements, variance, stress-test and sensitivity analysis, and explaining results as a business story. Live online, two days.`,
      audience: 'Managers without a finance background',
      credential: '2 TEUs',
      priceCents: 250_000,
      wioaEligible: false,
      skills: ['financial analysis', 'financial statement analysis', 'variance analysis', 'budgeting', 'business communication'],
    },
    {
      name: 'Data Storytelling',
      summary: `${TEPPER}. Turning complex data into clear stories that influence decisions: chart choice, narrative structure, and generative AI as a drafting partner. Live online, two days.`,
      audience: 'Professionals who present data',
      credential: '2 TEUs',
      priceCents: 250_000,
      wioaEligible: false,
      skills: ['data visualization', 'data storytelling', 'presentation skills', 'business communication'],
    },
    {
      name: 'Leadership as a Daily Challenge: An Integrated Approach',
      summary: `${TEPPER}. Leading change, culture, trust, informal networks, high-performance teams and stakeholder communication, applied to your own leadership cases. Pittsburgh, four days.`,
      audience: 'New and rising managers',
      credential: '4 TEUs',
      priceCents: 800_000,
      wioaEligible: false,
      skills: ['leadership', 'people management', 'change management', 'team building', 'stakeholder management'],
    },
    {
      name: 'Chief Information Security Officer (CISO) Certificate',
      summary: `${HEINZ}, with the Software Engineering Institute. Cyber risk management, incident response, security governance, cloud and AI security, and board communication. Hybrid, about six months. CMU alumni rate $15,600.`,
      audience: 'Senior security professionals',
      credential: 'CISO Program Certificate (noncredit)',
      priceCents: 1_950_000,
      wioaEligible: false,
      skills: ['cybersecurity', 'risk management', 'incident response', 'security governance', 'cloud security'],
    },
    {
      name: 'Chief Data and Artificial Intelligence Officer (CDAIO) Certificate Program',
      summary: `${HEINZ}. Data strategy and governance, data engineering, analytics, MLOps, responsible and generative AI, and an AI roadmap practicum. Blended, seven months. CMU alumni rate $14,280.`,
      audience: 'Data and AI leaders',
      credential: 'CDAIO Program Certificate (noncredit)',
      priceCents: 1_785_000,
      wioaEligible: false,
      skills: ['data strategy', 'data governance', 'machine learning', 'MLOps', 'AI governance'],
    },
    {
      name: 'Chief Information and Digital Officer (CIDO) Certificate',
      summary: `${HEINZ}. Transformation strategy, budgets, portfolios and vendors, infrastructure and cloud, and AI and automation at enterprise scale. Mostly live virtual, with a final module in Pittsburgh. CMU alumni rate $14,100.`,
      audience: 'IT and digital leaders',
      credential: 'CIDO certificate (noncredit)',
      priceCents: 1_650_000,
      wioaEligible: false,
      skills: ['digital transformation', 'IT strategy', 'budgeting', 'vendor management', 'cloud strategy'],
    },
    {
      name: 'Chief Risk Officer (CRO) Certificate',
      summary: `${HEINZ}. Enterprise risk governance; strategic, operational, financial, cyber, third-party and AI risk; GRC technology and board reporting, ending in a crisis simulation. Blended, under six months. CMU alumni rate $12,750.`,
      audience: 'Risk leaders',
      credential: 'CRO Program Certificate (noncredit)',
      priceCents: 1_475_000,
      wioaEligible: false,
      skills: ['enterprise risk management', 'risk management', 'governance risk and compliance', 'operational resilience', 'third-party risk management'],
    },
    {
      name: 'AI Engineering Foundations & Agents (Online Graduate Certificate)',
      summary: 'College of Engineering, CMU Online. Credit-bearing graduate certificate for working engineers: Machine Learning and AI for Engineers, and AI Agents for Engineers. One semester, weekly live evening classes. Plus a $245 technology fee; alumni may get up to 20% off tuition.',
      audience: 'Working engineers',
      credential: 'Graduate certificate (credit-bearing)',
      priceCents: 1_696_800,
      wioaEligible: false,
      skills: ['machine learning', 'AI agents', 'AI engineering', 'Python'],
    },
    {
      name: 'CERT Artificial Intelligence (AI) for Cybersecurity Professional Certificate',
      summary: `${SEI}. Building machine learning and deep learning models, using LLMs and analyzing text data for security problems, with hands-on labs. Self-paced, about 13 hours.`,
      audience: 'Technical cybersecurity staff',
      credential: 'CERT AI for Cybersecurity Professional Certificate',
      priceCents: 150_000,
      wioaEligible: false,
      skills: ['machine learning', 'deep learning', 'large language models', 'natural language processing', 'cybersecurity'],
    },
    {
      name: 'Introduction to Artificial Intelligence (AI) Engineering - eLearning',
      summary: `${SEI}. The discipline of AI engineering for managers, product people and engineers: planning and architecting AI systems, cross-functional teams and AI risk. No coding. Self-paced, about 9 hours.`,
      audience: 'Managers, product people and engineers',
      credential: 'Certificate of course completion',
      priceCents: 55_000,
      wioaEligible: false,
      skills: ['AI engineering', 'solution architecture', 'AI risk management', 'product management'],
    },
    {
      name: 'Secure DevOps Process and Implementation',
      summary: `${SEI}. Bringing DevOps into an organization: collaboration, infrastructure as code, continuous integration and testing, continuous delivery and monitoring. Self-paced, 4.5 hours.`,
      audience: 'Software and operations teams',
      credential: 'Certificate of course completion',
      priceCents: 10_000,
      wioaEligible: false,
      skills: ['DevOps', 'infrastructure as code', 'continuous integration', 'continuous delivery', 'software testing'],
    },
  ],
  // Subjects, not real CMU course numbers: the demo shows how auditing works without naming a section.
  auditCourses: [
    { title: 'Behavioral Economics', courseCode: null, term: 'Spring 2027', schedule: 'Tue/Thu afternoons', modality: 'in_person', seats: 4, description: 'Why people don’t do what models predict, and what that means for policy and product design.', skills: ['economics', 'decision making'] },
    { title: 'Data Visualization', courseCode: null, term: 'Spring 2027', schedule: 'Online, weekly', modality: 'online', seats: 6, description: 'Turning data into charts people understand, with Tableau and Python.', skills: ['data visualization', 'Python', 'Tableau'] },
  ],
  profile: {
    college: {
      unitid: '211440',
      shortName: 'CMU',
      city: 'Pittsburgh',
      state: 'PA',
      founded: 1900,
      websiteUrl: 'https://www.cmu.edu/',
      careerCenter: { name: 'Career and Professional Development Center', url: 'https://www.cmu.edu/career/' },
      techTransfer: { name: 'Center for Technology Transfer and Enterprise Creation', url: 'https://www.cmu.edu/cttec/' },
      entrepreneurshipCenter: { name: 'Swartz Center for Entrepreneurship', url: 'https://www.cmu.edu/swartz-center-for-entrepreneurship/' },
      facts: [
        { label: 'Alumni', value: '146,000+ in 148 countries', asOf: 'Accessed Nov 2026', source: 'CMU Alumni facts', sourceUrl: 'https://www.cmu.edu/engage/about-us/news/alumni/alumni-facts.html' },
        {
          label: 'U.S. News, National Universities',
          value: '#14, CMU’s highest ever',
          asOf: '2027 edition, Sep 22, 2026',
          source: 'CMU News',
          sourceUrl: 'https://www.cmu.edu/news/stories/archives/2026/september/carnegie-mellon-university-reaches-historic-high-at-no-14-in-us-news-rankings-takes-no-1-spot-for',
        },
        { label: 'Make Possible campaign', value: '$2.5 billion+ from 72,000+ donors', asOf: 'Closed Nov 2025', source: 'CMU President’s letter, Nov 18, 2025', sourceUrl: 'https://www.cmu.edu/leadership/president/campus-comms/11-18-25' },
        { label: 'Endowment', value: '$4.04 billion', asOf: 'June 30, 2026', source: 'CMU Annual Report 2026', sourceUrl: 'https://www.cmu.edu/annual-report-2026/cio/index.html' },
      ],
    },
    region: {
      name: 'Pittsburgh and Miami',
      state: 'PA',
      counties: ['allegheny'],
      areas: [
        { state: 'PA', counties: ['allegheny'] },
        { state: 'FL', counties: ['miami-dade'] },
      ],
    },
  },
}
