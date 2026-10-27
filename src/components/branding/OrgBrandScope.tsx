import type { ReactNode } from 'react'
import type { BrandPair } from '@/lib/branding/scan'
import { orgThemeVars } from '@/lib/branding/theme'

/**
 * Carries an organization's colors as CSS variables (--org-1 and friends, see src/lib/branding/theme.ts) for everything inside it.
 * With no colors it renders its children untouched, so a page without a stored brand looks exactly as it did before.
 */
export function OrgBrandScope({ brand, children }: { brand: BrandPair | null | undefined; children: ReactNode }) {
  const vars = orgThemeVars(brand)
  return vars ? <div style={vars} className="flex flex-1 flex-col">{children}</div> : <>{children}</>
}
