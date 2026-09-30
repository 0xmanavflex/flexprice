// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { type ReactNode } from "react"
import { cn } from "cn"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/primitives/card"

interface SettingsCardProps {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  footerClassName?: string
}

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  footerClassName,
}: SettingsCardProps) {
  return (
    <Card className={cn("gap-0 p-0", className)}>
      {/* Header */}
      <CardHeader className="gap-0 border-b px-5 py-3">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>

      {/* Content */}
      <CardContent className={cn("p-0", contentClassName)}>
        {children}
      </CardContent>

      {footer ? (
        <CardFooter
          className={cn(
            "justify-end gap-2 border-t px-5 py-3",
            footerClassName
          )}
        >
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  )
}