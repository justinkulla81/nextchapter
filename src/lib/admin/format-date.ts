// Admin pages render on the server (Vercel, UTC) but are read by a US-based
// team — bare toLocaleString()/toLocaleDateString() calls silently render in
// the server's timezone, not ET, which reads as a wrong/future timestamp
// (e.g. a same-minute event showing hours ahead). Use these everywhere an
// admin page displays a DateTime.
const ET_TIME_ZONE = 'America/New_York'

export function formatAdminDateTime(date: Date): string {
  return date.toLocaleString('en-US', { timeZone: ET_TIME_ZONE })
}

export function formatAdminDate(date: Date): string {
  return date.toLocaleDateString('en-US', { timeZone: ET_TIME_ZONE })
}

export function formatAdminTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { timeZone: ET_TIME_ZONE })
}
