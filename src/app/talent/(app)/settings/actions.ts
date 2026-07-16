'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function updateCompanyInfo(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const companyName = (formData.get('companyName') as string | null)?.trim()
  if (!companyName) return

  await prisma.employerProfile.update({
    where: { userId: user.id },
    data: {
      companyName,
      companyWebsite: (formData.get('companyWebsite') as string | null)?.trim() || null,
      companySize: (formData.get('companySize') as string | null) || null,
      companyStage: (formData.get('companyStage') as string | null) || null,
    },
  })

  revalidatePath('/talent/settings')
}
