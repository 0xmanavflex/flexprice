// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ReactNode } from "react"
import { cn } from "cn"

import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@ui/primitives/field"

interface SettingsFieldGroupProps {
  legend: string
  description: string
  children: ReactNode
  className?: string
  fieldGroupClassName?: string
}

export function SettingsFieldGroup({
  legend,
  description,
  children,
  className,
  fieldGroupClassName,
}: SettingsFieldGroupProps) {
  return (
    <FieldSet className={cn("gap-0", className)}>
      <FieldLegend className="sr-only">{legend}</FieldLegend>
      {/* Description */}
      <FieldDescription className="sr-only">{description}</FieldDescription>
      {/* List */}
      <FieldGroup className={cn("gap-0", fieldGroupClassName)}>
        {children}
      </FieldGroup>
    </FieldSet>
  )
}