import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-card/5 border-white/10 text-foreground placeholder:text-muted-foreground",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        "flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-xs transition-all outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
