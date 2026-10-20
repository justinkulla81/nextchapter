import { Children, type ComponentType, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { sentenceCase } from '@/lib/redesign/text'
import { cn } from '@/lib/utils'

interface StepParts {
  SCard: ComponentType<{ id?: string; className?: string; children?: ReactNode }>
  SHeader: ComponentType<{ children?: ReactNode }>
  STitle: ComponentType<{ className?: string; children?: ReactNode }>
  SContent: ComponentType<{ className?: string; children?: ReactNode }>
}

const LegacyParts: StepParts = { SCard: Card, SHeader: CardHeader, STitle: CardTitle, SContent: CardContent }

const RedesignedParts: StepParts = {
  SCard: ({ id, className, children }) => (
    <section id={id} className={cn('space-y-4', className)}>
      {children}
    </section>
  ),
  SHeader: ({ children }) => <div>{children}</div>,
  STitle: ({ children }) => <h2 className="font-display text-xl font-semibold text-ink">{Children.map(children, (c) => (typeof c === 'string' ? sentenceCase(c) : c))}</h2>,
  SContent: ({ className, children }) => <div className={className}>{children}</div>,
}

// A page that is built from Card, CardHeader, CardTitle and CardContent can switch to the redesigned look without being
// rewritten: call stepCard(redesign) and use the four parts it returns in place of the originals. With the redesign off they
// are the originals, unchanged. With it on, the bordered card becomes a plain section, and the small grey Title Case
// heading becomes a serif sentence-case heading. Nothing else about the children changes.
export function stepCard(redesign: boolean): StepParts {
  return redesign ? RedesignedParts : LegacyParts
}
