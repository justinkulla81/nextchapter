import Image from 'next/image'
import { cn } from '@/lib/utils'

const VICTORIA_PHOTO_PATH = '/marketing/victoria-headshot-v4.jpg'

// Same photo/sizing convention as CoachChatCard and VictoriaChatPreview —
// one shared avatar so every quoted-Victoria moment looks consistent.
export function VictoriaAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10',
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image src={VICTORIA_PHOTO_PATH} alt="Victoria" width={size} height={size} className="object-cover" style={{ width: size, height: size }} />
    </span>
  )
}
