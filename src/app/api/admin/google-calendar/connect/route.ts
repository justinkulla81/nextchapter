import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { buildAdminCalendarAuthUrl } from '@/lib/webinars/admin-calendar-oauth'

export async function GET() {
  await requireAdmin()
  const url = buildAdminCalendarAuthUrl('admin-webinars')
  return NextResponse.redirect(url)
}
