// Plain .ics for "Add to calendar". Calendar Connect is read-only for members, so this is the add path.

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

export interface IcsItem { uid: string; title: string; start: Date; end?: Date | null; description?: string; url?: string | null }

/** All-day events. End is exclusive in iCalendar, so a one-day item ends the next day. */
export function buildIcs(items: IcsItem[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NextChapter//Conferences//EN', 'CALSCALE:GREGORIAN']
  for (const i of items) {
    const end = new Date((i.end ?? i.start).getTime() + 86_400_000)
    lines.push('BEGIN:VEVENT', `UID:${i.uid}@launchyournextchapter.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(i.start)}`, `DTEND;VALUE=DATE:${ymd(end)}`, `SUMMARY:${esc(i.title)}`)
    const desc = [i.description, i.url].filter(Boolean).join('\n')
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
    if (i.url) lines.push(`URL:${i.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
