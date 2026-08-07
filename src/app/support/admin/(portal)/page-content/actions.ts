'use server'

import { revalidatePath } from 'next/cache'
import type { PageBoxType, VideoProvider } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { isPageKey } from '@/lib/dashboard/page-content'

export type FormState = { error?: string } | undefined

function parseCommon(formData: FormData) {
  const pageKey = (formData.get('pageKey') as string | null) ?? ''
  const boxType = (formData.get('boxType') as string | null) ?? ''
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const leadIn = (formData.get('leadIn') as string | null)?.trim() || null
  const bulletsRaw = (formData.get('bullets') as string | null) ?? ''
  const bullets = bulletsRaw
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean)
  const footer = (formData.get('footer') as string | null)?.trim() || null
  const videoProviderRaw = (formData.get('videoProvider') as string | null) ?? ''
  const videoUrl = (formData.get('videoUrl') as string | null)?.trim() || null
  const useInlineEmbed = formData.get('useInlineEmbed') === 'on'
  const isPinned = formData.get('isPinned') === 'on'
  const sequenceOrderRaw = (formData.get('sequenceOrder') as string | null)?.trim()
  const sequenceOrder = sequenceOrderRaw ? Number(sequenceOrderRaw) : null
  const publishAtRaw = (formData.get('publishAt') as string | null)?.trim()
  const publishAt = publishAtRaw ? new Date(publishAtRaw) : null
  const expiresAtRaw = (formData.get('expiresAt') as string | null)?.trim()
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null

  if (!isPageKey(pageKey)) return { error: `Invalid page: ${pageKey}` as const }
  if (boxType !== 'DAILY_MESSAGE' && boxType !== 'WHY_IT_MATTERS') return { error: 'Invalid box type.' as const }
  if (!title) return { error: 'Title is required.' as const }
  const videoProvider = videoProviderRaw ? (videoProviderRaw as VideoProvider) : null
  if (videoProvider && !videoUrl) return { error: 'Add a video URL, or clear the video provider.' as const }

  return {
    data: {
      pageKey,
      boxType: boxType as PageBoxType,
      title,
      leadIn,
      bullets,
      footer,
      videoProvider,
      videoUrl,
      useInlineEmbed,
      isPinned,
      sequenceOrder,
      publishAt,
      expiresAt,
    },
  }
}

export async function createPageContent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  const content = await prisma.pageContent.create({ data: parsed.data })
  captureServerEvent(admin?.email ?? 'admin', 'page_content_created', {
    contentId: content.id,
    pageKey: content.pageKey,
    boxType: content.boxType,
  })
  revalidatePath('/support/admin/page-content')
}

export async function updatePageContent(
  contentId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  await prisma.pageContent.update({ where: { id: contentId }, data: parsed.data })
  captureServerEvent(admin?.email ?? 'admin', 'page_content_updated', { contentId })
  revalidatePath('/support/admin/page-content')
}

export async function togglePageContentActive(contentId: string, current: boolean) {
  await requireAdmin()
  await prisma.pageContent.update({ where: { id: contentId }, data: { isActive: !current } })
  revalidatePath('/support/admin/page-content')
}

export async function deletePageContent(contentId: string) {
  await requireAdmin()
  await prisma.pageContent.delete({ where: { id: contentId } })
  revalidatePath('/support/admin/page-content')
}
