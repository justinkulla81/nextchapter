import 'server-only'
import { prisma } from '@/lib/prisma'
import type { HiringReqStatus } from '@prisma/client'

export async function listReqs(hiringManagerId: string) {
  return prisma.hiringReq.findMany({
    where: { hiringManagerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { submissions: true } } },
  })
}

export async function createReq(hiringManagerId: string, title: string): Promise<{ error?: string; reqId?: string }> {
  const cleaned = title.trim()
  if (!cleaned) return { error: 'Enter a role title.' }

  const req = await prisma.hiringReq.create({ data: { hiringManagerId, title: cleaned } })
  return { reqId: req.id }
}

export async function updateReqStatus(
  reqId: string,
  hiringManagerId: string,
  status: HiringReqStatus
): Promise<{ error?: string }> {
  const req = await prisma.hiringReq.findUnique({ where: { id: reqId } })
  if (!req || req.hiringManagerId !== hiringManagerId) return { error: 'Req not found.' }

  await prisma.hiringReq.update({ where: { id: reqId }, data: { status } })
  return {}
}
