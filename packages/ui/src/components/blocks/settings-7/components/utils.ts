// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { type Dispatch, type SetStateAction } from "react"

import type { SelectOption } from "./data"

export function getOptionLabel<T extends SelectOption>(
  options: T[],
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? value
}

export function createSelectValueHandler(
  setValue: Dispatch<SetStateAction<string>>
) {
  return (value: string | null) => {
    if (value !== null) {
      setValue(value)
    }
  }
}