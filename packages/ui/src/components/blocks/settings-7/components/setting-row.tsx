// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ReactNode } from "react"
import { cn } from "cn"

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@ui/primitives/field"

interface SettingRowProps {
  title: string
  description?: ReactNode
  children: ReactNode
  last?: boolean
  labelFor?: string
  contentClassName?: string
  titleAddon?: ReactNode
}

export function SettingRow({
  title,
  description,
  children,
  last,
  labelFor,
  contentClassName,
  titleAddon,
}: SettingRowProps) {
  return (
    <>
      <Field orientation="responsive" className="gap-4 px-5 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
          <div className="flex flex-wrap items-center gap-2">
            {labelFor ? (
              <FieldLabel htmlFor={labelFor}>{title}</FieldLabel>
            ) : (
              <FieldTitle>{title}</FieldTitle>
            )}
            {titleAddon}
          </div>

          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
        </div>

        <FieldContent
          className={cn("min-w-0 @md/field-group:w-78", contentClassName)}
        >
          <div className="flex w-full justify-start @md/field-group:justify-end">
            {children}
          </div>
        </FieldContent>
      </Field>

      {!last ? <FieldSeparator /> : null}
    </>
  )
}