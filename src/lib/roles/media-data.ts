// Curated media per job function. Every entry was opened and checked for recent activity (an episode or issue in the last ~12 months)
// before it was added, and every url is the show's or publication's own home page. A link that stops working is removed, never guessed at.
// Types live in media.ts, which imports this file.

import type { MediaItem } from './media'

const HBR_IDEACAST: MediaItem = {
  name: 'HBR IdeaCast',
  kind: 'podcast',
  by: 'Alison Beard and Adi Ignatius, Harvard Business Review',
  url: 'https://hbr.org/podcasts/ideacast',
  blurb: 'Interviews with researchers and executives on management, leadership and strategy.',
}

const ACQUIRED: MediaItem = {
  name: 'Acquired',
  kind: 'podcast',
  by: 'Ben Gilbert and David Rosenthal',
  url: 'https://www.acquired.fm',
  blurb: 'Long-form histories of companies and the strategic decisions behind them.',
}

const KNOWLEDGE_PROJECT: MediaItem = {
  name: 'The Knowledge Project',
  kind: 'podcast',
  by: 'Shane Parrish, Farnam Street',
  url: 'https://fs.blog/knowledge-project-podcast/',
  blurb: 'Conversations with executives and investors about decision making and leadership.',
}

const MIT_SMR: MediaItem = {
  name: 'MIT Sloan Management Review',
  kind: 'publication',
  by: 'MIT Sloan Management Review',
  url: 'https://sloanreview.mit.edu',
  blurb: 'Research-based articles on management, strategy, technology and organizations.',
}

const PAVILION: MediaItem = {
  name: 'Pavilion',
  kind: 'community',
  by: 'Pavilion',
  url: 'https://www.joinpavilion.com',
  blurb: 'A membership community for go-to-market leaders in sales, marketing, customer success and revenue operations.',
}

const REVGENIUS: MediaItem = {
  name: 'RevGenius',
  kind: 'community',
  by: 'RevGenius Inc.',
  url: 'https://www.revgenius.com',
  blurb: 'A Slack community, newsletter and events for revenue professionals.',
}

export const MEDIA_BY_FUNCTION: Record<string, MediaItem[]> = {
  Sales: [
    {
      name: '30 Minutes to President’s Club',
      kind: 'podcast',
      by: '30MPC',
      url: 'https://www.30mpc.com',
      blurb: 'Interviews with sales leaders and reps on tactics for prospecting, discovery and closing.',
    },
    {
      name: 'The Revenue Leadership Podcast',
      kind: 'podcast',
      by: 'Kyle Norton, Pavilion',
      url: 'https://joinpavilion.com/the-revenue-leadership-podcast',
      blurb: 'Weekly conversations with revenue operators about running sales teams and go-to-market plans.',
    },
    PAVILION,
    REVGENIUS,
  ],

  Marketing: [
    {
      name: 'Marketing Over Coffee',
      kind: 'podcast',
      by: 'Christopher Penn and John Wall',
      url: 'https://marketingovercoffee.com',
      blurb: 'A weekly show on marketing and marketing technology.',
    },
    {
      name: 'Exit Five',
      kind: 'community',
      by: 'Exit Five',
      url: 'https://www.exitfive.com',
      blurb: 'A private community, newsletter and podcast for B2B marketers.',
    },
    {
      name: 'Marketing Brew',
      kind: 'newsletter',
      by: 'Morning Brew',
      url: 'https://www.marketingbrew.com',
      blurb: 'A weekday newsletter and news site covering brand strategy, social media and advertising technology.',
    },
    {
      name: 'Adweek',
      kind: 'publication',
      by: 'Adweek',
      url: 'https://www.adweek.com',
      blurb: 'News and analysis on advertising, brands and media.',
    },
    PAVILION,
  ],

  Engineering: [
    {
      name: 'Software Engineering Daily',
      kind: 'podcast',
      by: 'Kevin Ball, Sean Falconer and other hosts',
      url: 'https://softwareengineeringdaily.com',
      blurb: 'Interviews on software architecture, infrastructure and AI.',
    },
    {
      name: 'Software Engineering Radio',
      kind: 'podcast',
      by: 'IEEE Computer Society',
      url: 'https://www.se-radio.net',
      blurb: 'Episodes with practitioners on software engineering topics.',
    },
    {
      name: 'Engineering Enablement',
      kind: 'podcast',
      by: 'Abi Noda and the DX research team',
      url: 'https://getdx.com/podcast',
      blurb: 'Discussions of developer productivity and how engineering organizations measure it.',
    },
    {
      name: 'The Stack Overflow Podcast',
      kind: 'podcast',
      by: 'Stack Overflow',
      url: 'https://stackoverflow.blog/podcast/',
      blurb: 'Interviews on software development, tools and the engineering workplace.',
    },
    {
      name: 'The Pragmatic Engineer',
      kind: 'newsletter',
      by: 'Gergely Orosz',
      url: 'https://newsletter.pragmaticengineer.com',
      blurb: 'Newsletter on big tech and startup engineering, with reporting on how engineering teams work.',
    },
    {
      name: 'LeadDev',
      kind: 'publication',
      by: 'LeadDev',
      url: 'https://leaddev.com',
      blurb: 'Articles, reports and events for engineering managers and leaders.',
    },
  ],

  Product: [
    {
      name: 'Lenny’s Podcast',
      kind: 'podcast',
      by: 'Lenny Rachitsky',
      url: 'https://www.lennysnewsletter.com',
      blurb: 'Interviews with product and growth leaders, alongside a newsletter on product, growth and careers.',
    },
    {
      name: 'All Things Product',
      kind: 'podcast',
      by: 'Teresa Torres and Petra Wille, Product Talk',
      url: 'https://www.producttalk.org',
      blurb: 'A podcast on product discovery and product management, alongside Product Talk articles.',
    },
    {
      name: 'The Product Experience',
      kind: 'podcast',
      by: 'Mind the Product',
      url: 'https://www.mindtheproduct.com',
      blurb: 'Conversations with people behind products, from a community with articles, events and meetups.',
    },
    ACQUIRED,
  ],

  Finance: [
    {
      name: 'CFO Thought Leader',
      kind: 'podcast',
      by: 'CFO Thought Leader',
      url: 'https://www.cfothoughtleader.com',
      blurb: 'Interviews with CFOs about their careers and how they run finance.',
    },
    {
      name: 'GrowCFO Show',
      kind: 'podcast',
      by: 'Kevin Appleby, GrowCFO',
      url: 'https://www.growcfo.net',
      blurb: 'A podcast for current and aspiring CFOs, from a training and community platform for finance professionals.',
    },
    {
      name: 'Mostly Metrics',
      kind: 'newsletter',
      by: 'CJ Gustafson',
      url: 'https://www.mostlymetrics.com',
      blurb: 'A finance newsletter and the Run the Numbers podcast, written by a former tech CFO.',
    },
    {
      name: 'CFO Dive',
      kind: 'publication',
      by: 'Informa TechTarget',
      url: 'https://www.cfodive.com',
      blurb: 'News on corporate finance, accounting, regulation and the CFO role.',
    },
    {
      name: 'CFO.com',
      kind: 'publication',
      by: 'Informa TechTarget',
      url: 'https://www.cfo.com',
      blurb: 'News and analysis for finance chiefs, including a weekly roundup of CFO moves.',
    },
  ],

  Operations: [
    {
      name: 'Supply Chain Now',
      kind: 'podcast',
      by: 'Scott W. Luton and Karin Bursa',
      url: 'https://www.supplychainnow.com',
      blurb: 'Episodes on supply chain, logistics and freight with industry guests.',
    },
    {
      name: 'Lean Blog Interviews',
      kind: 'podcast',
      by: 'Mark Graban',
      url: 'https://www.leanblog.org',
      blurb: 'Interviews on lean management, continuous improvement and operations leadership.',
    },
    {
      name: 'Supply Chain Dive',
      kind: 'publication',
      by: 'Informa TechTarget',
      url: 'https://www.supplychaindive.com',
      blurb: 'News on supply chain, trade policy and logistics.',
    },
    {
      name: 'Lean Enterprise Institute',
      kind: 'publication',
      by: 'Lean Enterprise Institute',
      url: 'https://www.lean.org',
      blurb: 'Articles in The Lean Post, books and events on lean thinking in operations.',
    },
    MIT_SMR,
  ],

  'Human Resources': [
    {
      name: 'HR Happy Hour',
      kind: 'podcast',
      by: 'Steve Boese and Trish Steed',
      url: 'https://www.hrhappyhour.net',
      blurb: 'A long-running show on HR, management and workforce technology.',
    },
    {
      name: 'The Josh Bersin Company',
      kind: 'publication',
      by: 'Josh Bersin',
      url: 'https://joshbersin.com',
      blurb: 'Articles and podcast interviews on HR strategy, talent and the workforce.',
    },
    {
      name: 'HR Dive',
      kind: 'publication',
      by: 'Informa TechTarget',
      url: 'https://www.hrdive.com',
      blurb: 'News on HR policy, employment law, hiring and workplace trends.',
    },
    {
      name: 'HR Brew',
      kind: 'newsletter',
      by: 'Morning Brew',
      url: 'https://www.hr-brew.com',
      blurb: 'A newsletter and news site on HR, hiring and the workplace.',
    },
    {
      name: 'SHRM',
      kind: 'publication',
      by: 'Society for Human Resource Management',
      url: 'https://www.shrm.org',
      blurb: 'News, guidance and resources from the professional association for HR.',
    },
    {
      name: 'Hacking HR',
      kind: 'community',
      by: 'Enrique Rubio',
      url: 'https://www.hackinghrlab.io',
      blurb: 'A learning platform and community for HR and business leaders.',
    },
  ],

  'Customer Success': [
    {
      name: 'Customer Success Collective',
      kind: 'community',
      by: 'Customer Success Collective',
      url: 'https://www.customersuccesscollective.com',
      blurb: 'A network for customer success and support professionals, with events, certifications and a newsletter.',
    },
    PAVILION,
    REVGENIUS,
  ],

  'Executive Leadership': [
    HBR_IDEACAST,
    {
      name: 'Masters of Scale',
      kind: 'podcast',
      by: 'Reid Hoffman',
      url: 'https://www.mastersofscale.com',
      blurb: 'Interviews with founders and CEOs on how companies grow.',
    },
    KNOWLEDGE_PROJECT,
    {
      name: 'Fortune CEO Daily',
      kind: 'newsletter',
      by: 'Fortune',
      url: 'https://www.fortune.com/newsletter/ceo-daily/',
      blurb: 'A daily newsletter on business news for executives.',
    },
    {
      name: 'Harvard Business Review',
      kind: 'publication',
      by: 'Harvard Business Publishing',
      url: 'https://hbr.org',
      blurb: 'Articles on management, leadership and strategy.',
    },
    {
      name: 'Chief',
      kind: 'community',
      by: 'Chief',
      url: 'https://www.chief.com',
      blurb: 'A membership community for senior women leaders, with coaching and peer groups.',
    },
  ],

  Security: [
    {
      name: 'Darknet Diaries',
      kind: 'podcast',
      by: 'Jack Rhysider',
      url: 'https://darknetdiaries.com',
      blurb: 'True stories about hackers, breaches and cybercrime.',
    },
    {
      name: 'Risky Business',
      kind: 'podcast',
      by: 'Patrick Gray and James Wilson',
      url: 'https://risky.biz',
      blurb: 'Weekly information security news and analysis, with related shows from the same network.',
    },
    {
      name: 'CyberWire Daily',
      kind: 'podcast',
      by: 'Dave Bittner, N2K Networks',
      url: 'https://thecyberwire.com',
      blurb: 'A daily podcast and news site on cybersecurity.',
    },
    {
      name: 'CISO Series',
      kind: 'podcast',
      by: 'David Spark',
      url: 'https://cisoseries.com',
      blurb: 'Podcasts for security leaders, including Defense in Depth and Cyber Security Headlines.',
    },
    {
      name: 'Security Now',
      kind: 'podcast',
      by: 'Steve Gibson and Leo Laporte',
      url: 'https://www.grc.com/securitynow.htm',
      blurb: 'A weekly show on security news and how the underlying technology works.',
    },
    {
      name: 'Krebs on Security',
      kind: 'publication',
      by: 'Brian Krebs',
      url: 'https://krebsonsecurity.com',
      blurb: 'Investigative reporting on cybercrime and security incidents.',
    },
    {
      name: 'Cybersecurity Dive',
      kind: 'publication',
      by: 'Informa TechTarget',
      url: 'https://www.cybersecuritydive.com',
      blurb: 'News on cybersecurity incidents, policy and enterprise security.',
    },
  ],

  Legal: [
    {
      name: 'Legal Talk Network',
      kind: 'podcast',
      by: 'Legal Talk Network',
      url: 'https://www.legaltalknetwork.com',
      blurb: 'A network of podcasts on law, legal practice and legal news.',
    },
    {
      name: 'ABA Journal',
      kind: 'publication',
      by: 'American Bar Association',
      url: 'https://www.abajournal.com',
      blurb: 'Legal news and features, with the Legal Rebels and Asked and Answered podcasts.',
    },
    {
      name: 'Above the Law',
      kind: 'publication',
      by: 'Breaking Media',
      url: 'https://abovethelaw.com',
      blurb: 'Daily news and commentary on the legal profession.',
    },
    {
      name: 'Corporate Counsel',
      kind: 'publication',
      by: 'ALM Global',
      url: 'https://www.law.com/corpcounsel/',
      blurb: 'News on in-house legal work, from the Law.com network.',
    },
  ],

  'Data & Analytics': [
    {
      name: 'Data Engineering Podcast',
      kind: 'podcast',
      by: 'Tobias Macey',
      url: 'https://www.dataengineeringpodcast.com',
      blurb: 'Interviews on data pipelines, platforms and tooling.',
    },
    {
      name: 'Super Data Science',
      kind: 'podcast',
      by: 'Jon Krohn',
      url: 'https://www.superdatascience.com',
      blurb: 'Interviews on machine learning, AI and data careers.',
    },
    {
      name: 'The Analytics Power Hour',
      kind: 'podcast',
      by: 'Michael, Tim, Moe and co-hosts',
      url: 'https://analyticshour.io',
      blurb: 'A discussion show on analytics practice and the work of analysts.',
    },
    {
      name: 'Practical AI',
      kind: 'podcast',
      by: 'Daniel Whitenack and Chris Benson',
      url: 'https://practicalai.show',
      blurb: 'Episodes on applying AI and machine learning in real projects.',
    },
    {
      name: 'Data Skeptic',
      kind: 'podcast',
      by: 'Kyle Polich',
      url: 'https://dataskeptic.com',
      blurb: 'Interviews on data science, machine learning and statistics.',
    },
  ],

  Strategy: [
    HBR_IDEACAST,
    ACQUIRED,
    {
      name: 'Stratechery',
      kind: 'newsletter',
      by: 'Ben Thompson',
      url: 'https://stratechery.com',
      blurb: 'Analysis of technology companies and the business strategy behind them.',
    },
    {
      name: 'strategy+business',
      kind: 'publication',
      by: 'PwC',
      url: 'https://www.strategy-business.com',
      blurb: 'Articles on corporate strategy, leadership and transformation.',
    },
    {
      name: 'BCG Henderson Institute',
      kind: 'publication',
      by: 'Boston Consulting Group',
      url: 'https://www.bcg.com/bcg-henderson-institute',
      blurb: 'Research from BCG’s think tank on strategy, technology, geopolitics and the economy.',
    },
    MIT_SMR,
    KNOWLEDGE_PROJECT,
  ],
}
