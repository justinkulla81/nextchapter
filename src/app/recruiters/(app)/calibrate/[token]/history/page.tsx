import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export default async function CalibrationMemoHistoryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) notFound()

  const memos = await prisma.calibrationMemo.findMany({
    where: { recruiterId: recruiter.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href={`/recruiters/calibrate/${token}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to Calibration Memo
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Past calibration memos</h1>
      <p className="mt-1 text-muted-foreground">Every brief you&apos;ve run and the memo it produced.</p>

      {memos.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No memos generated yet.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {memos.map((memo) => (
            <div key={memo.id} className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">{memo.createdAt.toLocaleString()}</p>
              <details className="group mt-2 text-sm">
                <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-foreground">
                  Client brief
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{memo.briefText}</p>
              </details>
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{memo.memoText}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
