import { useCallback, useState, type FormEvent } from 'react'

/**
 * A form draft validated by a domain zod schema, without a form library.
 *
 * `react-hook-form` and `@hookform/resolvers` are dependencies of `@fp/ui`,
 * not of this app: the components that use them live in the package, and the
 * app composes those. Rather than add a form library to `apps/console` for
 * four short forms, these bind the domain schema directly: hold a draft, parse
 * it on submit, and show the schema's own messages.
 *
 * That keeps the important half unchanged. The validation authority is still
 * `updateTenantSchema` / `inviteMemberSchema` / `createApiKeySchema` /
 * `createServiceAccountSchema`: the same objects the package's forms resolve
 * against: so a rule added to a schema reaches this screen without anybody
 * remembering to mirror it.
 *
 * Errors appear on submit, not on every keystroke: an email that is invalid
 * because you have typed three characters of it so far is not worth saying.
 * Once a field has been reported, it re-validates as you fix it, which is the
 * moment the message becomes useful.
 */

interface Issue {
  readonly path?: readonly PropertyKey[] | undefined
  readonly message: string
}

/** Structurally what a zod schema's `safeParse` gives back. */
export interface Parser<T> {
  safeParse(value: unknown): { success: boolean; data?: T; error?: { issues: readonly Issue[] } }
}

export interface Draft<T> {
  value: T
  /** A string field, by dot path: `name`, `address.line1`. */
  text: (path: string) => string
  setText: (path: string, next: string) => void
  /** Anything that is not a plain string field: a role array, an enum. */
  update: (updater: (current: T) => T) => void
  error: (path: string) => string | undefined
  handleSubmit: (onValid: (parsed: T) => void) => (event: FormEvent) => void
  reset: (next: T) => void
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

/** Immutable set-by-path. Objects along the way are cloned, not mutated. */
function writePath<T>(source: T, path: string, next: unknown): T {
  const [head, ...rest] = path.split('.')
  if (head === undefined) return source

  const record = { ...(source as unknown as Record<string, unknown>) }
  record[head] =
    rest.length === 0
      ? next
      : writePath((record[head] ?? {}) as Record<string, unknown>, rest.join('.'), next)

  return record as unknown as T
}

function collect(issues: readonly Issue[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = (issue.path ?? []).map(String).join('.') || 'form'
    // First issue per field wins: three messages about one input is noise.
    errors[key] ??= issue.message
  }
  return errors
}

export function useDraft<T extends object>(parser: Parser<T>, initial: T): Draft<T> {
  const [value, setValue] = useState<T>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasSubmitted, setWasSubmitted] = useState(false)

  const revalidate = useCallback(
    (next: T) => {
      if (!wasSubmitted) return
      const result = parser.safeParse(next)
      setErrors(result.success ? {} : collect(result.error?.issues ?? []))
    },
    [parser, wasSubmitted],
  )

  const update = useCallback(
    (updater: (current: T) => T) => {
      setValue((current) => {
        const next = updater(current)
        revalidate(next)
        return next
      })
    },
    [revalidate],
  )

  return {
    value,
    text: (path) => {
      const found = readPath(value, path)
      return typeof found === 'string' ? found : ''
    },
    setText: (path, next) => update((current) => writePath(current, path, next)),
    update,
    error: (path) => errors[path],
    reset: (next) => {
      setValue(next)
      setErrors({})
      setWasSubmitted(false)
    },
    handleSubmit: (onValid) => (event: FormEvent) => {
      event.preventDefault()
      setWasSubmitted(true)

      const result = parser.safeParse(value)
      if (!result.success || result.data === undefined) {
        setErrors(collect(result.error?.issues ?? []))
        return
      }

      setErrors({})
      // The parsed value, not the draft: the schema trims, so what is saved is
      // what the schema says it is rather than what was typed around it.
      onValid(result.data)
    },
  }
}
