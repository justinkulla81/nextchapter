'use server'

import { finishSectionBridge as finishSectionBridgeImpl } from '@/lib/employer/section-bridge-server'

// Thin 'use server' wrapper, same reason as the sibling accept actions: CallbackHandler is a Client Component and needs a
// 'use server'-marked export to call into.
export async function finishSectionBridge(to: string, arrival: string): Promise<{ error?: string; path?: string }> {
  return finishSectionBridgeImpl(to, arrival)
}
