// Sales-demo fixture: Washington & Jefferson College (/i/washjeff).
//
// The profile below is public, sourced data gathered on Oct 6, 2026 and
// refreshed Nov 20, 2026; every figure names its source and period. The
// programs are W&J's own graduate programs, each from its official page that
// day (name, price per credit, format), with the skills written the way job
// postings name them, for the skills bridge. The planned M.S. in Physician
// Assistant Studies is left out: no price or start date is published.
//
// Staff, members and gifts are fictional (see ../demo-seed.ts) — we don't
// have W&J's roster — and staff emails use a .test domain so nothing can reach
// a real person. Groups and research requests are fictional too.
//
// Known gaps, left out rather than estimated: endowment, alumni giving rate,
// graduate/medical school acceptance rates, an institution-wide brand guide.

import type { DemoTenant } from '../demo-tenants'

const BLS_LAUS = 'https://www.bls.gov/lau/'
const COUNTY_SERIES = 'https://data.bls.gov/timeseries/LAUCN421250000000003'
const GRAD = 'https://www.washjeff.edu/academics/majors-and-minors/graduate-and-continuing-studies/'

export const WASHJEFF_TENANT: DemoTenant = {
  slug: 'washjeff',
  name: 'Washington & Jefferson College',
  programBrandName: 'W&J NextChapter',
  // W&J red as washjeff.edu's own stylesheet defines it (--WJRed: #A4343A, PMS 1807), checked Nov 20, 2026.
  accentColor: '#A4343A',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/W%26J_stylized_letters.svg',
  domains: ['washjeff.edu'],
  // "More than 15,000 W&J graduates" (W&J Alumni Giving page, Nov 2026).
  alumniCount: 15_000,
  includedSeats: 450,
  givingUrl: 'https://www.washjeff.edu/give/',
  staffEmailDomain: 'washjeff-demo.test',
  // Every office opens in the demo (Graduate and Continuing Studies, Teaching, Academic Affairs).
  tier: 'INSTITUTION',
  workforceBoard: false,
  staff: [
    ['INSTITUTION_ADMIN', 'Morgan Ashby'],
    ['ALUMNI_RELATIONS', 'Taylor Brennan'],
    ['DEVELOPMENT', 'Jordan Kessler'],
    ['CAREER_SERVICES', 'Casey Delgado'],
    ['EMPLOYER_RELATIONS', 'Riley Whitcomb'],
    ['COACH', 'Avery Holcomb'],
    ['FACULTY', 'Prof. Quinn Marsh'],
    ['EXEC_ED', 'Drew Pollard'],
  ],
  // Fictional regional employers for the fictional members' employer accounts, postings and pitches.
  employers: [
    'Chartiers Valley Health',
    'Monongahela Gas Partners',
    'Laurel Run Logistics',
    'Ten Mile Creek Manufacturing',
    'Canonsburg Tower Systems',
    'Southpointe Analytics',
    'Three Rivers Mutual',
    'Greene Hills Energy',
    'Allegheny Ridge Bank',
    'Mingo Creek Foods',
  ],
  // Where the alumni work: real employers in Washington County, Pittsburgh and the fields W&J graduates enter, so layoff and
  // hiring signals attach (as for CMU, owner 2026-11-20). Roster only: no real company is shown saying or posting anything.
  alumniEmployers: ['UPMC', 'PNC', 'Highmark Health', 'Allegheny Health Network', 'EQT', 'CNX Resources', 'PPG', 'KPMG', 'Deloitte', 'Schneider Downs', 'BNY', 'Crown Castle', 'Washington Health System', 'Giant Eagle'],
  // W&J's major names as its site lists them (Nov 2026). The first five are fall 2026's most popular intended majors.
  majors: [
    'Business Administration',
    'Biology',
    'Nursing',
    'Psychology',
    'Finance',
    'Accounting',
    'Economics',
    'Neuroscience',
    'Chemistry',
    'Political Science',
    'English',
    'History',
    'Communication Arts',
    'Computing & Information Studies',
    'Public Policy',
    'Mathematics',
  ],
  // A full demo (owner, 2026-11-18): enough alumni and students that every screen has people in it.
  memberCount: 300,
  studentCount: 40,
  // Fictional groups: two chapters where W&J alumni cluster, then career groups that alumni join by major.
  groups: [
    { kind: 'chapter', name: 'Pittsburgh Alumni', metro: 'Pittsburgh', description: 'Alumni in Pittsburgh and Washington County: a fall happy hour, a service day and the spring career night on campus.' },
    { kind: 'chapter', name: 'Washington, D.C. Alumni', metro: 'Washington', description: 'Alumni in law, policy and government around the capital.' },
    { kind: 'affinity', name: 'Pre-Health and Nursing', metro: null, description: 'Physicians, nurses, PAs and health administrators, for students and alumni on the health path.', majors: ['Biology', 'Nursing', 'Neuroscience', 'Chemistry'] },
    { kind: 'affinity', name: 'Business, Finance and Accounting', metro: null, description: 'Accounting firms, banks and corporate finance, from first audit season to CFO.', majors: ['Business Administration', 'Finance', 'Accounting', 'Economics'] },
    { kind: 'affinity', name: 'Law, Policy and Public Service', metro: null, description: 'Lawyers, policy staff and public servants, and alumni headed to law school.', majors: ['Political Science', 'Public Policy', 'History', 'English'] },
  ],
  // Fictional studies by the fictional professor below (no real W&J faculty, lab or project is named).
  researchRequests: [
    {
      title: 'How rural hospitals are filling nursing shifts',
      lab: 'Prof. Quinn Marsh, health care workforce research',
      description: 'Thirty-minute interviews with nurse managers and hospital HR staff in southwestern Pennsylvania and West Virginia about staffing, travel nurses and new-graduate pipelines. Findings shared before publication.',
      fields: ['Health care', 'Nursing', 'Human resources'],
      durationWeeks: 8,
      compensation: 'volunteer',
    },
    {
      title: 'Survey: careers after the Marcellus boom',
      lab: 'Prof. Quinn Marsh, with W&J undergraduate researchers',
      description: 'A fifteen-minute anonymous survey for people who work or worked in natural gas, utilities and energy services about how their roles and skills have changed. Results shared with everyone who takes part.',
      fields: ['Energy', 'Operations', 'Engineering'],
      durationWeeks: 6,
      compensation: 'volunteer',
    },
    {
      title: 'Small business owners and AI tools',
      lab: 'Prof. Quinn Marsh, small business study',
      description: 'We are looking for owners of small businesses in Washington County to try two AI bookkeeping and marketing tools for a month and tell us what helped. Paid stipend; all data anonymized.',
      fields: ['Small business', 'Marketing', 'Finance'],
      durationWeeks: 4,
      compensation: 'paid',
    },
  ],
  annualCheckInMonth: 10,
  // W&J's own office names, checked on washjeff.edu Nov 20, 2026.
  officeNames: {
    alumni: 'Office of Alumni Engagement',
    development: 'Office of Development',
    career: 'Center for Career Advising and Networking',
    ventures: 'Ignite Business Incubator',
    execed: 'Graduate and Continuing Studies',
  },
  // Free retraining and Digital resources stay off so the demo can switch
  // them on live and show the cards appear (product design, Service menu).
  services: {
    events: { on: true },
    reviews: { on: true },
    exec_ed: { on: true, linkUrl: GRAD },
  },
  // W&J's graduate programs, $700 a credit with no added fees (washjeff.edu, Nov 20, 2026).
  programs: [
    {
      name: 'Master of Arts in Teaching (MAT)',
      summary: 'Graduate and Continuing Studies. 30 credits at $700 a credit, no added fees. Coursework 100% online and asynchronous, plus a full-year internship with in-person student teaching in a Pennsylvania school. Leads to Pennsylvania teacher certification.',
      audience: 'Career changers and graduates who want to teach',
      credential: 'Master of Arts in Teaching',
      priceCents: 2_100_000,
      wioaEligible: false,
      skills: ['lesson planning', 'classroom management', 'differentiated instruction', 'curriculum development', 'educational technology', 'special education'],
      credentialType: 'Master’s degree',
      prerequisites: '2.8 GPA',
    },
    {
      name: 'Master’s in Professional Writing',
      summary: 'Graduate Program in Professional Writing. Two required courses and eight electives, ending in an e-portfolio. $700 a credit ($2,100 a course).',
      audience: 'Writers, communicators and career changers',
      credential: 'Master’s degree',
      priceCents: 2_100_000,
      wioaEligible: false,
      skills: ['technical writing', 'editing', 'grant writing', 'content strategy', 'social media management', 'project management'],
    },
    {
      name: 'Graduate Certificate in Professional Writing',
      summary: 'Graduate Program in Professional Writing. Five graduate courses at $2,100 each; credits count toward the master’s.',
      audience: 'Professionals who write for work',
      credential: 'Graduate certificate',
      priceCents: 1_050_000,
      wioaEligible: false,
      skills: ['technical writing', 'editing', 'proposal writing', 'web content', 'business communication'],
    },
  ],
  // Subjects, not real W&J course numbers: the demo shows how auditing works without naming a section.
  auditCourses: [
    { title: 'Data Analysis for Decision-Making', courseCode: null, term: 'Spring 2027', schedule: 'Tue/Thu afternoons', modality: 'in_person', seats: 4, description: 'Spreadsheets, statistics and charts for business questions, with Excel and Python.', skills: ['data analysis', 'Excel', 'Python'] },
    { title: 'Health Care Economics', courseCode: null, term: 'Spring 2027', schedule: 'Online, weekly', modality: 'online', seats: 6, description: 'How hospitals, insurers and patients make decisions, and what that means for costs and jobs in the region.', skills: ['health care economics', 'economics'] },
  ],
  profile: {
    college: {
      unitid: '216667',
      shortName: 'W&J',
      city: 'Washington',
      state: 'PA',
      founded: 1781,
      mascot: 'Presidents',
      colors: ['Red', 'Black'],
      websiteUrl: 'https://www.washjeff.edu/',
      careerCenter: {
        name: 'Center for Career Advising and Networking (CCAN)',
        url: 'https://www.washjeff.edu/student-life/center-for-career-advising-and-networking/',
        email: 'ccan@washjeff.edu',
      },
      entrepreneurshipCenter: { name: 'Ignite Business Incubator', url: 'https://www.washjeff.edu/department/ignite-business-incubator-and-co-working-space/' },
      facts: [
        { label: 'Founded', value: '1781', source: 'W&J: About', sourceUrl: 'https://www.washjeff.edu/about-wj/' },
        {
          label: 'Total enrollment',
          value: '1,655',
          asOf: 'Fall 2026',
          source: 'W&J News, Aug 26, 2026',
          sourceUrl: 'https://www.washjeff.edu/washington-jefferson-college-welcomes-577-new-presidents-as-enrollment-momentum-continues/',
        },
        {
          label: 'New first-year class',
          value: '577 (107 first-generation)',
          asOf: 'Fall 2026',
          source: 'W&J News, Aug 26, 2026',
          sourceUrl: 'https://www.washjeff.edu/washington-jefferson-college-welcomes-577-new-presidents-as-enrollment-momentum-continues/',
        },
        {
          label: 'Class of 2026 graduates',
          value: '284',
          asOf: 'May 9, 2026',
          source: 'W&J News',
          sourceUrl: 'https://www.washjeff.edu/a-class-ready-for-what-comes-next-washington-jefferson-college-celebrates-the-class-of-2026/',
        },
        {
          label: 'Employed or in graduate school',
          value: '94% within six months of graduation',
          asOf: 'Accessed Nov 2026; class year not stated',
          source: 'W&J Tuition & Fees',
          sourceUrl: 'https://www.washjeff.edu/future-students/tuition-fees/',
        },
        {
          label: 'Students completing an internship or professional experience',
          value: '100%',
          asOf: 'CCAN page, accessed Oct 2026',
          source: 'W&J CCAN',
          sourceUrl: 'https://www.washjeff.edu/student-life/center-for-career-advising-and-networking/',
        },
        {
          label: 'Alumni volunteers',
          value: '400+, across 20+ regional events',
          asOf: 'Accessed Oct 2026',
          source: 'W&J Alumni',
          sourceUrl: 'https://www.washjeff.edu/alumni/',
        },
        {
          label: 'U.S. News, National Liberal Arts',
          value: '#91 (Top Private #87, Social Mobility #120)',
          asOf: '2027 edition, Oct 15, 2026',
          source: 'W&J News',
          sourceUrl: 'https://www.washjeff.edu/washington-jefferson-college-earns-national-recognition-in-2027-u-s-news-world-report-rankings/',
        },
        { label: 'Alumni', value: 'More than 15,000 graduates', asOf: 'Accessed Nov 2026', source: 'W&J Alumni Giving', sourceUrl: 'https://www.washjeff.edu/department/alumni-giving/' },
        {
          label: 'Tuition reset',
          value: 'Published tuition cut 44%, from $49,650 to $27,605 (2023–24); $30,314 in 2026–27',
          asOf: 'Announced Nov 2022',
          source: 'W&J',
          sourceUrl: 'https://www.washjeff.edu/questionsanswers/how-is-wj-able-to-reduce-tuition-and-still-operate-as-it-always-has/',
        },
        {
          label: 'Earnings above the national median',
          value: '$17,485 a year',
          asOf: 'U.S. Department of Education, Sep 2026',
          source: 'W&J Value and Outcomes',
          sourceUrl: 'https://www.washjeff.edu/future-students/value-and-outcomes/',
        },
      ],
    },
    photos: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/McMillan_Hall_western_front.jpg',
        alt: 'McMillan Hall at Washington & Jefferson College',
        credit: 'McMillan Hall · Nyttend, Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:McMillan_Hall_western_front.jpg',
        license: 'Public domain',
      },
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/WandJCollege-OldMain.JPG',
        alt: 'Old Main at Washington & Jefferson College',
        credit: 'Old Main · Midnightdreary, Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:WandJCollege-OldMain.JPG',
        license: 'Public domain',
      },
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/4/45/TheBurnettCenter.jpg',
        alt: 'The Burnett Center at Washington & Jefferson College',
        credit: 'Burnett Center · Mgardzina, Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:TheBurnettCenter.jpg',
        license: 'Public domain',
      },
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/John_L._Stewart_Tower_McIlvaine_Hall.jpg',
        alt: 'John L. Stewart Tower on McIlvaine Hall',
        credit: 'Stewart Tower, McIlvaine Hall · Wikimedia Commons',
        pageUrl: 'https://commons.wikimedia.org/wiki/File:John_L._Stewart_Tower_McIlvaine_Hall.jpg',
        license: 'CC BY-SA 2.0',
      },
    ],
    region: {
      name: 'Washington County, PA, Pittsburgh and the West Virginia panhandle',
      state: 'PA',
      counties: ['washington'],
      // W&J sits about 15 miles from the West Virginia line: alumni and
      // employers on both sides count as local.
      areas: [
        { state: 'PA', counties: ['washington', 'allegheny', 'greene', 'beaver', 'westmoreland', 'fayette'] },
        { state: 'WV', counties: ['brooke', 'hancock', 'ohio', 'marshall'] },
      ],
      unemployment: [
        {
          area: 'Washington County',
          rate: 3.8,
          period: 'Aug 2026 (preliminary, not seasonally adjusted)',
          laborForce: 106_427,
          source: 'BLS Local Area Unemployment Statistics',
          sourceUrl: COUNTY_SERIES,
        },
        {
          area: 'Pittsburgh metro',
          rate: 3.9,
          period: 'Aug 2026 (preliminary, not seasonally adjusted)',
          source: 'BLS Local Area Unemployment Statistics',
          sourceUrl: 'https://data.bls.gov/timeseries/LAUMT423830000000003',
        },
        {
          area: 'Pennsylvania',
          rate: 4.1,
          period: 'Aug 2026 (preliminary, not seasonally adjusted)',
          source: 'BLS Local Area Unemployment Statistics',
          sourceUrl: 'https://data.bls.gov/timeseries/LAUST420000000000003',
        },
      ],
      unemploymentTrend: {
        area: 'Washington County',
        source: 'BLS LAUS, not seasonally adjusted',
        sourceUrl: BLS_LAUS,
        asOf: 'Aug 2025 – Aug 2026; Oct 2025 not published (federal funding lapse)',
        points: [
          { period: 'Aug 2025', rate: 4.9 },
          { period: 'Sep 2025', rate: 4.1 },
          { period: 'Nov 2025', rate: 3.7 },
          { period: 'Dec 2025', rate: 3.6 },
          { period: 'Jan 2026', rate: 4.4 },
          { period: 'Feb 2026', rate: 4.7 },
          { period: 'Mar 2026', rate: 4.1 },
          { period: 'Apr 2026', rate: 3.6 },
          { period: 'May 2026', rate: 3.7 },
          { period: 'Jun 2026', rate: 3.7 },
          { period: 'Jul 2026', rate: 3.6 },
          { period: 'Aug 2026', rate: 3.8 },
        ],
      },
      medianHouseholdIncome: {
        area: 'Washington County',
        value: 78_958,
        source: 'Census ACS 2020–2024 5-year, via Data USA',
        sourceUrl: 'https://datausa.io/profile/geo/washington-county-pa',
      },
      topEmployers: {
        names: [
          'The Washington Hospital',
          'Pathways of Southwestern PA',
          'Crown Castle',
          'Giant Eagle',
          'Walmart',
          'Monongahela Valley Hospital',
          'Canon-McMillan School District',
          'Washington County',
          'ANSYS',
          'Washington Trotting Association',
        ],
        source: 'PA Dept. of Labor & Industry, Washington County Top 50 Employers',
        sourceUrl: 'https://www.pa.gov/content/dam/copapwp-pagov/en/dli/documents/workstats/top-50/Washington_County_Top_50.pdf',
        asOf: 'Q4 2023',
      },
      industries: {
        names: ['Health care and social assistance (16,121 workers)', 'Retail trade (11,923)', 'Manufacturing (10,746)', 'Energy: Marcellus Shale natural gas'],
        source: 'Data USA (ACS 2024 5-year); Pittsburgh Regional Alliance',
        sourceUrl: 'https://datausa.io/profile/geo/washington-county-pa',
      },
    },
    workforce: {
      board: {
        name: 'Southwest Corner Workforce Development Board',
        counties: ['Beaver', 'Greene', 'Washington'],
        website: 'https://washingtongreene.org/',
        source: 'Washington Greene County Job Training Agency (board staff)',
        sourceUrl: 'https://washingtongreene.org/',
      },
      careerLinks: [
        {
          name: 'PA CareerLink Washington County',
          address: '90 West Chestnut Street, Millcraft Center, Suite 150 LL, Washington, PA 15301',
          phone: '724-223-4500',
          website: 'https://www.pacareerlink.pa.gov',
          source: 'PA 211',
          sourceUrl: 'https://www.pa211.org/agency/22420/58008/46218',
        },
      ],
    },
    news: [
      {
        headline: 'Washington & Jefferson College earns national recognition in 2027 U.S. News & World Report rankings',
        outlet: 'W&J News',
        date: 'Oct 15, 2026',
        url: 'https://www.washjeff.edu/washington-jefferson-college-earns-national-recognition-in-2027-u-s-news-world-report-rankings/',
        summary: 'No. 91 among National Liberal Arts Colleges, No. 87 Top Private and No. 120 Social Mobility.',
      },
      {
        headline: 'Washington & Jefferson College partners with Project HOPE to create new global opportunities',
        outlet: 'W&J News',
        date: 'Sep 14, 2026',
        url: 'https://www.washjeff.edu/washington-jefferson-college-partners-with-project-hope-to-create-new-global-opportunities/',
        summary: 'A new global-health internship pipeline, starting with W&J’s first Project HOPE intern.',
      },
      {
        headline: '$1.25 million award launches new era for Lazear Hall',
        outlet: 'W&J News',
        date: 'Sep 8, 2026',
        url: 'https://www.washjeff.edu/1-25-million-award-launches-new-era-for-lazear-hall/',
        summary: 'A state grant turns Lazear Hall into a health-sciences building for the BSN and a planned Physician Assistant master’s.',
      },
      {
        headline: 'W&J announces $1 million grant from the Richard King Mellon Foundation to support revitalization of Washington',
        outlet: 'W&J News',
        date: 'Feb 6, 2026',
        url: 'https://www.washjeff.edu/washington-jefferson-college-announces-1-million-grant-from-the-richard-king-mellon-foundation-to-support-revitalization-of-washington/',
        summary: 'Support for downtown Washington, PA, including a larger Ignite Business Incubator.',
      },
      {
        headline: 'Investment in GE Vernova comes at crucial time for Charleroi area',
        outlet: 'WPXI',
        date: 'Jul 30, 2026',
        url: 'https://www.wpxi.com/news/local/investment-ge-vernova-comes-crucial-time-charleroi-area/W7Q3DYU3GVB73LXNF7LETXGFDE/',
        summary: 'A $166M expansion at Rostraver Twp. (Westmoreland County, near Charleroi) and Findlay Twp.: at least 714 new jobs over four years.',
      },
      {
        headline: 'UPMC to cut 200 jobs, eliminate 300 open positions',
        outlet: 'WPXI',
        date: 'Jun 10, 2026',
        url: 'https://www.wpxi.com/news/local/pittsburghs-largest-health-system-lay-off-200-employees/H6F4WOO7SNDJ7A523YHSXO7ZLY/',
        summary: 'The region’s largest health system laid off about 200 mostly non-clinical staff.',
      },
      {
        headline: 'US Steel pledges up to $2.5B in upgrades to Pittsburgh-area plant',
        outlet: 'Spotlight PA',
        date: 'Jun 9, 2026',
        url: 'https://www.spotlightpa.org/news/2026/06/us-steel-mon-valley-works-billions-upgrades-environment/',
        summary: 'A new hot strip mill at Edgar Thomson preserves about 3,000 Mon Valley Works jobs.',
      },
      {
        headline: 'Sale of Fourth Street Foods finalized',
        outlet: 'Observer-Reporter',
        date: 'Feb 4, 2026',
        url: 'https://www.observer-reporter.com/editors_pick/2026/feb/04/sale-of-fourth-street-foods-finalized/',
        summary: 'Morski Foods bought the Mon Valley frozen-food business for $3M and kept the Speers plant running.',
      },
      {
        headline: 'A smart investment in Washington County’s future (op-ed)',
        outlet: 'Observer-Reporter',
        date: 'Jan 17, 2026',
        url: 'https://www.observer-reporter.com/opinion/op-eds/2026/jan/17/op-ed-a-smart-investment-in-washington-countys-future/',
        summary: 'Opinion: the former Washington Mall site is being cleared for an ~$80M retail project projected at 270–350 jobs.',
      },
      {
        headline: 'Charleroi food processing plant to close; 252 jobs lost',
        outlet: 'TribLive',
        date: 'Oct 2025',
        url: 'https://triblive.com/local/regional/charleroi-food-processing-plant-to-close-252-jobs-lost',
        summary: 'Fourth Street Foods filed a WARN notice one day before laying off 252 workers at its Charleroi-area plants.',
      },
      {
        headline: 'Washington & Jefferson College seeing large spike in enrollment',
        outlet: 'CBS Pittsburgh',
        date: 'Jun 19, 2025',
        url: 'https://www.cbsnews.com/pittsburgh/news/washington-jefferson-college-enrollment-increase/',
        summary: 'W&J credited a roughly 50% tuition cut, a new nursing program and a tuition-free scholarship for county residents.',
      },
    ],
  },
}
