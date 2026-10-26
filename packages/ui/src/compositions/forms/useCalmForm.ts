import { useCallback, useMemo, useRef } from 'react'
import {
  get,
  useForm,
  type FieldErrors,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form'

/**
 * `useForm`, with validation that waits for the person.
 *
 * A keystroke is not a finished answer. Checking on each change paints
 * "That does not look like an email address" on the letter `d`.
 *
 *   - a field left **empty** is not judged until the form is submitted (or a
 *     wizard step is checked with `trigger`), so a click alone never errors;
 *   - a field with **something typed in it** is checked when you leave it, then
 *     again as you edit, so a correction clears the message on the next key;
 *   - an **email** is only format-checked once it looks finished (`name@host.tld`)
 *     or the form is submitted. `d` and `not-an-email` stay quiet;
 *   - on submit, and on `trigger`, every rule applies, empty fields included.
 *
 * Every form in the console uses this instead of `useForm`.
 */
export function useCalmForm<
  TFieldValues extends FieldValues = FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors useForm's own default
  TContext = any,
  TTransformedValues = TFieldValues,
>(
  props: UseFormProps<TFieldValues, TContext, TTransformedValues> = {},
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  // While above zero, every rule applies: a submit or an explicit `trigger` is running.
  const strict = useRef(0)
  // After the first submit every rule applies for good, until the form is reset.
  const submitted = useRef(false)
  const original = props.resolver

  const resolver = useMemo<Resolver<TFieldValues, TContext, TTransformedValues> | undefined>(
    () =>
      original
        ? async (values, context, options) => {
            const result = await original(values, context, options)
            if (strict.current > 0) return result
            // Field-level checks read only `errors`; the shape is the resolver's own.
            const errors = withoutOpenEmailEntries(
              submitted.current ? result.errors : withoutEmptyFields(result.errors, values),
              values,
            )
            return { ...result, errors } as never
          }
        : undefined,
    [original],
  )

  const form = useForm<TFieldValues, TContext, TTransformedValues>({
    ...props,
    mode: 'onTouched',
    reValidateMode: 'onChange',
    ...(resolver ? { resolver } : {}),
  })

  const { handleSubmit: submitWith, trigger: checkWith, reset: resetWith } = form

  const handleSubmit = useCallback(
    ((onValid, onInvalid) => async (event?: Parameters<ReturnType<typeof submitWith>>[0]) => {
      submitted.current = true
      strict.current += 1
      try {
        return await submitWith(onValid, onInvalid)(event)
      } finally {
        strict.current -= 1
      }
    }) as typeof form.handleSubmit,
    [submitWith],
  )

  const trigger = useCallback<typeof form.trigger>(
    async (...args) => {
      strict.current += 1
      try {
        return await checkWith(...args)
      } finally {
        strict.current -= 1
      }
    },
    [checkWith],
  )

  const reset = useCallback<typeof form.reset>(
    (...args) => {
      submitted.current = false
      resetWith(...args)
    },
    [resetWith],
  )

  form.handleSubmit = handleSubmit
  form.trigger = trigger
  form.reset = reset
  return form
}

/** Nothing typed: blank text, no number, no date, no picks. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return Number.isNaN(value)
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** An error leaf carries a `type` or a `message`; anything else is a branch of nested fields. */
function isLeaf(node: unknown): boolean {
  return (
    typeof node === 'object' &&
    node !== null &&
    ('message' in node || 'type' in node) &&
    !Array.isArray(node)
  )
}

/** The errors with every entry on an empty field removed, at any depth. */
export function withoutEmptyFields<T extends FieldValues>(
  errors: FieldErrors<T>,
  values: T,
  path: string[] = [],
): FieldErrors<T> {
  const out: Record<string, unknown> = {}
  for (const [key, node] of Object.entries(errors as Record<string, unknown>)) {
    if (node === undefined) continue
    const here = [...path, key]
    if (isLeaf(node)) {
      // A rule on the whole object (a `refine` with no path) has nothing to be empty.
      if (here.length > 0 && isEmpty(get(values, here.join('.')))) continue
      out[key] = node
      continue
    }
    if (typeof node === 'object' && node !== null) {
      const nested = withoutEmptyFields(node as FieldErrors<T>, values, here)
      if (Object.keys(nested).length > 0) out[key] = nested
    }
  }
  return out as FieldErrors<T>
}

/**
 * An address is finished enough to judge when it has a local part, a host, and
 * a dot in that host. Anything shorter is still being typed.
 */
export function emailEntryIsComplete(value: string): boolean {
  const trimmed = value.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0) return false
  const domain = trimmed.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  return dot > 0 && dot < domain.length - 1
}

function isEmailFormatMessage(message: unknown): boolean {
  return typeof message === 'string' && /email/i.test(message)
}

/**
 * Format errors on an email that is still being typed. A required-empty message
 * is a different rule and is left for `withoutEmptyFields` and for submit.
 */
export function withoutOpenEmailEntries<T extends FieldValues>(
  errors: FieldErrors<T>,
  values: T,
  path: string[] = [],
): FieldErrors<T> {
  const out: Record<string, unknown> = {}
  for (const [key, node] of Object.entries(errors as Record<string, unknown>)) {
    if (node === undefined) continue
    const here = [...path, key]
    if (isLeaf(node)) {
      const value = here.length > 0 ? get(values, here.join('.')) : undefined
      const message = (node as { message?: unknown }).message
      if (
        typeof value === 'string' &&
        value.trim() !== '' &&
        isEmailFormatMessage(message) &&
        !emailEntryIsComplete(value)
      ) {
        continue
      }
      out[key] = node
      continue
    }
    if (typeof node === 'object' && node !== null) {
      const nested = withoutOpenEmailEntries(node as FieldErrors<T>, values, here)
      if (Object.keys(nested).length > 0) out[key] = nested
    }
  }
  return out as FieldErrors<T>
}
