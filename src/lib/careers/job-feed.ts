import { CAREERS_POSTED, CAREER_ROLES, type CareerRole } from '@/lib/careers/roles'
import { careerDescriptionHtml } from '@/lib/careers/job-posting-jsonld'
import { cdata, FEED_TAIL, JOOBLE_HEAD, JOOBLE_TAIL } from '@/lib/syndication/syndication'

// NextChapter's own openings (src/lib/careers/roles.ts) as XML feeds for job aggregators.
// Two formats: the Indeed-style layout Talent.com, Adzuna, Careerjet and others read, and
// Jooble's own tag set. Platform roles (coach, recruiter) are not jobs and are left out.
// Served by /feeds/careers.xml and /feeds/careers-jooble.xml.

const SITE_URL = 'https://launchyournextchapter.com'
const JOB_TYPE: Record<CareerRole['employment'], string | null> = {
  'Full-time': 'Full time',
  Internship: 'Internship',
  'Associate program': 'Full time',
  Platform: null,
}

export const careerFeedRoles = (): CareerRole[] => CAREER_ROLES.filter((r) => r.kind !== 'platform' && JOB_TYPE[r.employment])

const posted = () => new Date(`${CAREERS_POSTED}T00:00:00Z`)
const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
const roleUrl = (r: CareerRole) => `${SITE_URL}/careers/${r.slug}`

export function careersFeedXml(builtAt: Date = new Date()): string {
  const jobs = careerFeedRoles().map((r) =>
    [
      '<job>',
      `<title>${cdata(r.title)}</title>`,
      `<date>${cdata(posted().toUTCString())}</date>`,
      `<dateposted>${cdata(posted().toISOString())}</dateposted>`,
      `<referencenumber>${cdata(r.slug)}</referencenumber>`,
      `<url>${cdata(roleUrl(r))}</url>`,
      `<company>${cdata('NextChapter')}</company>`,
      `<city>${cdata('New York')}</city>`,
      `<state>${cdata('NY')}</state>`,
      `<country>${cdata('US')}</country>`,
      `<description>${cdata(careerDescriptionHtml(r))}</description>`,
      `<jobtype>${cdata(JOB_TYPE[r.employment]!)}</jobtype>`,
      `<isremote>${cdata('yes')}</isremote>`,
      '</job>',
    ].join('\n'),
  )
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<source>\n' +
    `<publisher>NextChapter</publisher>\n<publisherurl>${SITE_URL}</publisherurl>\n<lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>\n` +
    jobs.join('\n') +
    '\n' +
    FEED_TAIL
  )
}

export function careersJoobleXml(): string {
  const jobs = careerFeedRoles().map((r) =>
    [
      `<job id="${r.slug}">`,
      `<link>${cdata(roleUrl(r))}</link>`,
      `<name>${cdata(r.title)}</name>`,
      `<region>${cdata('New York, NY (or remote)')}</region>`,
      `<description>${cdata(careerDescriptionHtml(r))}</description>`,
      `<pubdate>${cdata(ddmmyyyy(posted()))}</pubdate>`,
      `<company>${cdata('NextChapter')}</company>`,
      `<jobtype>${cdata(r.employment === 'Internship' ? 'internship' : 'full-time')}</jobtype>`,
      '</job>',
    ].join('\n'),
  )
  return JOOBLE_HEAD + jobs.join('\n') + '\n' + JOOBLE_TAIL
}
