import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-transparent px-4 text-base transition-colors outline-none file:mr-3 file:inline-flex file:h-8 file:cursor-pointer file:items-center file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground file:transition-colors hover:file:bg-secondary/80 active:file:bg-success/20 active:file:text-success placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // File inputs need more vertical room than the fixed h-11 text-input
        // height allows — the file-selector-button is 32px tall, and h-11
        // (44px) combined with py-3 (24px) left only 20px for it, cramping
        // the button and label against the box edges.
        type === "file" ? "h-auto min-h-14 py-2.5" : "h-11 py-3",
        className
      )}
      {...props}
    />
  )
}

export { Input }
