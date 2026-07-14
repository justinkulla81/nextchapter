'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Resource {
  name: string
  description: string
  url: string
  free: boolean
}

interface ResourceCategory {
  title: string
  description: string
  resources: Resource[]
}

export function LearningResourceBrowser({ categories }: { categories: ResourceCategory[] }) {
  const [freeOnly, setFreeOnly] = useState(false)

  const filtered = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          // Free-first within each category, and drop paid entries entirely
          // when the toggle is on rather than just greying them out.
          resources: category.resources
            .filter((r) => !freeOnly || r.free)
            .slice()
            .sort((a, b) => Number(b.free) - Number(a.free)),
        }))
        .filter((category) => category.resources.length > 0),
    [categories, freeOnly]
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={freeOnly ? 'outline' : 'default'}
          size="sm"
          onClick={() => setFreeOnly(false)}
        >
          Free + paid
        </Button>
        <Button
          type="button"
          variant={freeOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFreeOnly(true)}
        >
          Free only
        </Button>
      </div>

      {filtered.map((category) => (
        <div key={category.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{category.title}</h2>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {category.resources.map((resource) => (
              <Card key={resource.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {resource.name}
                    </a>
                    <span
                      className={
                        resource.free
                          ? 'shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success'
                          : 'shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {resource.free ? 'Free' : 'Paid'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{resource.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
