/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils'

/** Victoria's handwritten sign-off. An image, not a font, so the site keeps its two typefaces. The name matches the sender name used in email. */
export function Signature({ name = 'Victoria', className }: { name?: 'Victoria' | 'Vicki' | 'Vic'; className?: string }) {
  return <img src={`/email/signature-${name.toLowerCase()}.png`} alt={name} height={49} className={cn('h-[49px] w-auto', className)} />
}
