// The hub pages that lead to every page family. Google follows links, so a hub it already crawls
// (the homepage, a job page, the layoffs pages) has to point at each of these or the pages beneath
// them are found only through the sitemap, which is slow. Add a new page family's hub here.
export const BROWSE_LINKS: { label: string; href: string }[] = [
  { label: 'Jobs by title', href: '/jobs/title' },
  { label: 'Salaries by title', href: '/salaries' },
  { label: 'Employers hiring', href: '/employers' },
  { label: 'Local job markets', href: '/places' },
  { label: 'Layoff tracker', href: '/layoffs' },
  { label: 'Jobs by industry', href: '/industries' },
  { label: 'Jobs by function', href: '/functions' },
  { label: 'Workforce boards', href: '/workforce-boards' },
  { label: 'American Job Centers', href: '/job-centers' },
  { label: 'Economic development', href: '/economic-development' },
  { label: 'Colleges and universities', href: '/higher-education' },
  { label: 'Nonprofits', href: '/nonprofits' },
  { label: 'Search firms', href: '/search-firms' },
  { label: 'Conferences', href: '/conferences' },
  { label: 'Free tools', href: '/tools' },
]
