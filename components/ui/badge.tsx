import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/10 text-primary",
        secondary:
          "border-white/10 bg-card/5 text-muted-foreground",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive",
        outline:
          "border-white/10 text-foreground bg-transparent",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
