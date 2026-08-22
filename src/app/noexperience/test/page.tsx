import type { Metadata } from 'next'
import Link from 'next/link'
import { CrucibleTestFlow } from '@/components/crucible/CrucibleTestFlow'
import { CrucibleWordmark } from '@/components/crucible/CrucibleWordmark'
import type { CrucibleSource } from '@prisma/client'

export const metadata: Metadata = { title: { absolute: 'noexperienceneeded.ai Challenge' } }

function resolveSource(src: string | undefined): CrucibleSource {
  if (src === 'nc_newgrad') return 'NC_NEWGRAD'
  if (src === 'nc_assessment') return 'NC_ASSESSMENT'
  return 'LANDING'
}

export default async function CrucibleTestPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>
}) {
  const { src } = await searchParams
  const source = resolveSource(src)

  return (
    <div className="flex flex-1 flex-col bg-off-white">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/noexperience">
            <CrucibleWordmark className="text-xl" />
          </Link>
        </div>
      </header>
      <CrucibleTestFlow source={source} skipEmail={source !== 'LANDING'} skipResume={source !== 'LANDING'} />
    </div>
  )
}
