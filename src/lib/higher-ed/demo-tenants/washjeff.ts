// Sales-demo fixture: Washington & Jefferson College (/i/washjeff).
//
// The profile below is public, sourced data gathered on Oct 6, 2026; every
// figure names its source and period. Staff, members and gifts are
// fictional (see ../demo-seed.ts) — we don't have W&J's roster — and staff
// emails use a .test domain so nothing can reach a real person.
//
// Known gaps, left out rather than estimated: a current living-alumni count
// (alumniCount uses the ~11,000 in the build spec), graduate/medical school
// acceptance rates, an official brand color guide.

import type { DemoTenant } from '../demo-tenants'

const BLS_LAUS = 'https://www.bls.gov/lau/'
const COUNTY_SERIES = 'https://data.bls.gov/timeseries/LAUCN421250000000003'

export const WASHJEFF_TENANT: DemoTenant = {
  slug: 'washjeff',
  name: 'Washington & Jefferson College',
  programBrandName: 'W&J NextChapter',
  // W&J red. No official brand guide is published; this hex is from a
  // third-party brand-color listing.
  accentColor: '#A93439',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/W%26J_stylized_letters.svg',
  domains: ['washjeff.edu'],
  alumniCount: 11_000,
  includedSeats: 330,
  givingUrl: 'https://www.washjeff.edu/give/',
  staffEmailDomain: 'washjeff-demo.test',
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
  // Fictional regional employers for the fictional members.
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
  majors: ['Biology', 'Economics', 'Business', 'Accounting', 'Psychology', 'English', 'Chemistry', 'Political Science', 'Nursing', 'History', 'Neuroscience', 'Communication'],
  memberCount: 200,
  annualCheckInMonth: 10,
  // Free retraining and Digital resources stay off so the demo can switch
  // them on live and show the cards appear (product design, Service menu).
  services: {
    events: { on: true },
    reviews: { on: true },
    exec_ed: { on: true },
  },
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
          value: '97% (68% employed, 29% continuing education)',
          asOf: 'Published June 2022; class year not stated',
          source: 'W&J News',
          sourceUrl: 'https://www.washjeff.edu/careers-founded-here-wj-receives-national-recognition-for-career-development/',
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
          value: '#89 (Best Value #48, Social Mobility #90)',
          asOf: '2024 edition, announced Sep 2023',
          source: 'W&J News',
          sourceUrl: 'https://www.washjeff.edu/washington-jefferson-college-lands-priority-placement-on-multiple-national-rankings-for-value-student-outcomes/',
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
      name: 'Washington County, Pennsylvania (Pittsburgh metro)',
      state: 'PA',
      counties: ['washington'],
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
