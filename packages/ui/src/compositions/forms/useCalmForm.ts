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
 * `onTouched` alone flags a field the moment it loses focus, so clicking into
 * an input and out again: before typing a thing: paints "Enter a name" in
 * red. This keeps `onTouched` for what it is good at and drops only that case:
 *
 *   - a field left **empty** is not judged until the form is submitted (or a
 *     wizard step is checked with `trigger`), so a click alone never errors;
 *   - a field with **something typed in it** is checked when you leave it, and
 *     re-checked as you edit, so a bad email shows as soon as you move on;
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
            if (strict.current > 0 || submitted.current) return result
            // Field-level checks read only `errors`; the shape is the resolver's own.
            return { ...result, errors: withoutEmptyFields(result.errors, values) } as never
          }
        : undefined,
    [original],
  )

  const form = useForm<TFieldValues, TContext, TTransformedValues>({
    mode: 'onTouched',
    ...props,
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
