import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { ADMIN_NOTIFICATION_EMAIL } from '@/lib/admin/auth'
import { formatValue } from './stats'
import type { Kpi, MonthlyUserReportData } from './types'

const FROM = 'NextChapter <support@launchyournextchapter.com>'
const ADMIN_URL = 'https://admin.launchyournextchapter.com'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function reportUrl(monthKey: string): string {
  return `${ADMIN_URL}/support/admin/monthly-report?month=${encodeURIComponent(monthKey)}`
}

function change(k: Kpi): string {
  if (k.value === null || k.prior === null) return ''
  const d = Math.round((k.value - k.prior) * 10) / 10
  if (d === 0) return 'flat'
  return `${d > 0 ? '+' : ''}${d}${k.unit === 'pct' ? ' pts' : ''}`
}

export function monthlyReportEmail(report: MonthlyUserReportData): { subject: string; html: string; text: string } {
  const link = reportUrl(report.monthKey)
  const subject = `Member report for ${report.label}: ${report.memberCount} members`
  const rows = report.headline
    .map((k) => `<tr><td style="padding:4px 16px 4px 0">${esc(k.label)}</td><td style="padding:4px 16px 4px 0;font-weight:600">${esc(formatValue(k.value, k.unit))}</td><td style="padding:4px 0;color:#55606e">${esc(change(k))}</td></tr>`)
    .join('')
  const insights = report.insights
    .map((i) => `<li style="margin:0 0 8px"><strong>${esc(i.title)}.</strong> ${esc(i.detail)}</li>`)
    .join('')
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0f1b2b;line-height:1.5">
    <p style="margin:0 0 12px;font-size:17px;font-weight:600">Member report for ${esc(report.label)}</p>
    <table style="border-collapse:collapse;margin:0 0 16px">${rows}</table>
    ${insights ? `<p style="margin:0 0 8px;font-weight:600">What stood out</p><ul style="margin:0 0 16px;padding-left:20px">${insights}</ul>` : ''}
    <p style="margin:0 0 4px"><a href="${link}">Open the full report</a></p>
    <p style="margin:0;color:#55606e;font-size:13px">Groups under ${report.minCellSize} members are never shown.</p>
  </div>`
  const text = [
    `Member report for ${report.label}`,
    ...report.headline.map((k) => `${k.label}: ${formatValue(k.value, k.unit)} ${change(k)}`.trim()),
    ...(report.insights.length ? ['', 'What stood out', ...report.insights.map((i) => `- ${i.title}. ${i.detail}`)] : []),
    '', `Full report: ${link}`,
  ].join('\n')
  return { subject, html, text }
}

/** Emails the finished report to the admin. Returns false (and logs) rather than throwing. */
export async function sendMonthlyReportEmail(report: MonthlyUserReportData): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping monthly report email.')
    return false
  }
  const to = process.env.MONTHLY_REPORT_TO || ADMIN_NOTIFICATION_EMAIL
  try {
    const { error } = await createResend(process.env.RESEND_API_KEY, 'candidate').emails.send({ from: FROM, to, ...monthlyReportEmail(report) })
    if (error) { console.error('Monthly report email failed:', error); return false }
    return true
  } catch (e) {
    console.error('Monthly report email failed:', e)
    return false
  }
}
