// Stand-in for `next/cache` in unit tests (aliased in vitest.config.ts).
// The real module needs a Next.js request/incremental-cache context, and a
// hand-written `vi.mock('next/cache', () => ({ revalidatePath }))` factory
// breaks every suite the moment any module it imports starts calling
// `unstable_cache` at load time. Tests that assert on revalidation should
// spread this in: vi.mock('next/cache', async (orig) => ({ ...(await orig()), revalidatePath: vi.fn() }))
export const unstable_cache = <T extends (...args: never[]) => unknown>(fn: T): T => fn
export const unstable_noStore = () => {}
export const revalidatePath = () => {}
export const revalidateTag = () => {}
export const updateTag = () => {}
export const refresh = () => {}
