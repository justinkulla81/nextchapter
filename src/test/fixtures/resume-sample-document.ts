import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

// The ideal import: every word, figure and date of the sample, placed in the right field, nothing added.
export function sampleDocument(): ResumeDocumentData {
  return {
    name: 'JORDAN AVERY',
    contact: { email: 'jordan.avery@example.edu', phone: '(555) 010-0199', location: '100 Example Street Apt 4B, Springfield NY 10001', linkedinUrl: null },
    targetTitle: null,
    summary: 'AI-native technology investor and operator utilizing artificial intelligence to modernize and grow businesses',
    workHistory: [
      { companyName: 'NORTHBRIDGE CAPITAL', roleTitle: 'Partner', dateRangeLabel: '2023 - present', location: 'New York,NY', bullets: ['Founded Northbridge Capital, an AI-first investment and advisory firm.', 'Consult with PE and high growth corporations on utilizing Generative AI to overhaul core workflows, turning theoretical tech adoption into measurable EBITDA expansion, growth and competitiveness.'] },
      {
        companyName: 'HARBOR GROUP', roleTitle: 'Senior Adviser, Board Director', dateRangeLabel: '2023 - present', location: 'New York,NY',
        extraRoles: [{ roleTitle: 'Partner, Harbor Impact - Growth Equity and Buyout', dateRangeLabel: '2020-2023' }],
        bullets: [
          'Launched Harbor Impact, one of the first lower mid-market impact investment fund strategies. Harbor Group manages $2.0 billion of AUM across its buyout and growth equity fund strategies.',
          "Invested in four impact-related deals alongside each of Harbor's fund strategies: Force Management (board director), American Thrift Stores (board director), Knix (exited) and Xero Shoes.",
          'Firmwide leadership includes Founding Member of AI Committee, Investment Committee for Harbor Strategies, and Partners Committee.',
        ],
      },
      { companyName: 'MERIDIAN FINANCIAL SERVICES', roleTitle: 'SVP, Head of Global M&A and Venture Investments', dateRangeLabel: '2017-2019', location: 'San Francisco, CA', bullets: ['Led corporate development for Meridian Financial Services, a Fortune 500 company, including $80M+ Asia Pacific mobile insurance business.', 'Served on U.S. Small Business Administration Technology Coalition.'] },
      { companyName: 'STONEWORKS', roleTitle: 'CEO, Chairman & Founder', dateRangeLabel: '2015-2019', location: 'San Francisco, CA', bullets: ['Successfully sold Stoneworks to Meridian Financial Services, Fortune 500 company, with 40%+ IRR.', 'Launched MainStreet MBA products, serving over 3K businesses worldwide.'] },
      { companyName: 'WELD NORTH LLC', roleTitle: 'Principal and Founding Member', dateRangeLabel: '2010-2015', location: 'New York, NY', bullets: ['Sourced, executed, managed, and exited Weld North Education, an edtech platform rollup of K-12 technology for nearly $1B, returning 2.9x invested capital and 26% IRR.', 'Sourced, executed, managed, and exited Performance Matters, a data analytics business, returning 22% IRR.'] },
      { companyName: 'EDGENUITY', roleTitle: 'CTO', dateRangeLabel: '2011', location: 'Scottsdale, Arizona', bullets: ['Served as CTO, leading a 25-person engineering team. Modernized the tech stack to support 500k MAUs.'] },
      { companyName: 'HEARST CORPORATION', roleTitle: 'Venture Capital Investor, Associate', dateRangeLabel: '2009', location: 'New York, NY', bullets: ['Worked on the deal team for the Series A investment for HootSuite (most recently valued at $700M).'] },
      { companyName: 'GOOGLE', roleTitle: 'Business Development Partner', dateRangeLabel: '2007, 2008', location: 'Mountain View, CA', bullets: ['Created a website optimization program for Google Analytics generating over $1M for Fortune 1,000 customers.'] },
    ],
    education: [
      { schoolName: 'HARVARD UNIVERSITY', degreeLabel: 'Master of Public Administration', dateLabel: '2007-2009' },
      { schoolName: 'CARNEGIE MELLON UNIVERSITY', degreeLabel: 'Bachelor of Science, Information Systems', dateLabel: '1999-2003' },
    ],
    skills: ['Vertical AI Investment Strategy', 'Large Language Model (LLM) Integration', 'AI Automation', 'Board Leadership', 'Capital Formation', 'VC / PE Investments', 'M&A Integrations'],
    certifications: [],
    skillsHeading: 'CORE COMPETENCIES',
    sections: [
      {
        heading: 'EXTRACURRICULAR',
        items: [
          { title: 'STANFORD UNIVERSITY, MIT', subtitle: 'Lecturer', dateLabel: '2017-Present', bullets: ['Serve as lecturer and mentor for Technology Entrepreneurship and Impact Investing courses.'] },
          { title: 'COUNCIL ON FOREIGN RELATIONS', subtitle: 'Term Member', dateLabel: '2018-2024', bullets: ['Term member for the highly selective, preeminent think tank on foreign policy.'] },
        ],
      },
    ],
  }
}
