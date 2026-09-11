import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { CrmImportForm } from '@/components/admin/CrmImportForm'

export const maxDuration = 60

export default async function CrmImportPage() {
  await requireAdmin()
  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm" className="text-muted-foreground hover:underline">← All people</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">Upload a CSV</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Nothing is saved until you&apos;ve seen the preview. Rows are matched on LinkedIn URL, then
          email, then name and company — and a name-only match stops and asks rather than guessing.
        </p>
      </header>
      <CrmImportForm />
    </div>
  )
}
