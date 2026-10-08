import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { FormActions } from './FormActions'
import { WorkflowStepper, type WorkflowStep } from './WorkflowStepper'

/**
 * Step state for a multi-stage create or edit form.
 *
 * The form stays one react-hook-form instance owned by the caller; steps only
 * decide which section is on screen. Values therefore survive Previous/Next
 * (react-hook-form keeps unmounted fields' values), and a step's `validate`
 * (usually `form.trigger([...fields])`) gates Next so errors surface where the
 * person is, not at the end.
 *
 * In edit mode pass `unlockAll`: the record already exists, so every step is
 * reachable and the stepper is plain navigation over sections.
 *
 * The current step is controlled when `step`/`onStepChange` are given (a
 * `?step=` search param keeps it deep-linkable and back-button safe), and local
 * otherwise.
 */
export const FormStepsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/workflow-stepper', 'compositions/form-actions'],
  note: 'Stepper state + footer for multi-step forms; validates per step, keeps one form.',
})

export interface FormStepDef {
  id: string
  title: string
  /** A short line under the title in the header stepper. */
  description?: string
}

export interface UseFormStepsOptions {
  steps: readonly FormStepDef[]
  step?: string | undefined
  onStepChange?: ((id: string) => void) | undefined
  /** Resolve false to block leaving the step; errors are the form's to show. */
  validate?: ((id: string) => Promise<boolean> | boolean) | undefined
  unlockAll?: boolean
}

export interface FormFlow {
  steps: readonly FormStepDef[]
  step: string
  index: number
  isFirst: boolean
  isLast: boolean
  workflow: WorkflowStep[]
  next: () => Promise<void>
  back: () => void
  goTo: (id: string) => void
  /** Wrap `form.handleSubmit(...)`: Enter on a middle step advances instead of submitting. */
  guardSubmit: (submit: (event?: FormEvent) => unknown) => (event?: FormEvent) => unknown
}

export function useFormSteps({
  steps,
  step: controlled,
  onStepChange,
  validate,
  unlockAll = false,
}: UseFormStepsOptions): FormFlow {
  const [local, setLocal] = useState(steps[0]?.id ?? '')
  const [done, setDone] = useState<ReadonlySet<string>>(new Set())
  const raw = controlled ?? local
  const step = steps.some((s) => s.id === raw) ? raw : (steps[0]?.id ?? '')
  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === step),
  )

  const set = useCallback(
    (id: string) => {
      setLocal(id)
      onStepChange?.(id)
    },
    [onStepChange],
  )

  const workflow = useMemo<WorkflowStep[]>(() => {
    const firstOpen = steps.findIndex((s) => !done.has(s.id))
    const reachable = firstOpen === -1 ? steps.length : firstOpen
    return steps.map((s, i) => {
      const status: WorkflowStep['status'] =
        s.id === step
          ? 'current'
          : unlockAll || done.has(s.id)
            ? 'complete'
            : i <= reachable
              ? 'upcoming'
              : 'locked'
      return {
        id: s.id,
        title: s.title,
        ...(s.description ? { description: s.description } : {}),
        status,
      }
    })
  }, [steps, done, step, unlockAll])

  const next = useCallback(async () => {
    const current = steps[index]
    if (!current) return
    if (validate && !(await validate(current.id))) return
    setDone((prev) => new Set(prev).add(current.id))
    const following = steps[index + 1]
    if (following) set(following.id)
  }, [steps, index, validate, set])

  const back = useCallback(() => {
    const previous = steps[index - 1]
    if (previous) set(previous.id)
  }, [steps, index, set])

  const isLast = index === steps.length - 1
  const guardSubmit = useCallback<FormFlow['guardSubmit']>(
    (submit) => (event) => {
      if (!isLast && !unlockAll) {
        event?.preventDefault()
        void next()
        return
      }
      return submit(event)
    },
    [isLast, unlockAll, next],
  )

  return {
    steps,
    step,
    index,
    isFirst: index === 0,
    isLast,
    workflow,
    next,
    back,
    goTo: set,
    guardSubmit,
  }
}

export function FormSteps({
  flow,
  label = 'Steps',
  children,
}: {
  flow: FormFlow
  label?: string
  children: ReactNode
}) {
  return (
    <>
      {/* The stepper's titles are h3; this keeps the outline h1 → h2 → h3. */}
      <h2 className="sr-only">{label}</h2>
      <WorkflowStepper
        steps={flow.workflow}
        currentStep={flow.step}
        onStepChange={flow.goTo}
        aria-label={label}
      >
        {children}
      </WorkflowStepper>
    </>
  )
}

/**
 * Next, bottom right, with an arrow: the foot of a header-stepper form. Previous
 * lives in the toolbar where Cancel was. The final step has no Next — the
 * toolbar's primary action takes over there.
 */
export function StepNav({
  flow,
  isSubmitting = false,
}: {
  flow: FormFlow
  isSubmitting?: boolean
}) {
  if (flow.isLast) return null
  return (
    <div className="flex items-center justify-end gap-3 border-t pt-4">
      <Button type="button" onClick={() => void flow.next()} disabled={isSubmitting}>
        Next
        <ArrowRightIcon aria-hidden="true" />
      </Button>
    </div>
  )
}

export interface StepFooterProps {
  flow: FormFlow
  mode: 'create' | 'edit'
  noun?: string
  formId: string
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null | undefined
}

/**
 * Previous · Next (Cancel on the first step, where there is no Previous), becoming the submit on the last step. In edit mode
 * the submit is available on every step: nothing is gated behind reaching the end.
 */
export function StepFooter({
  flow,
  mode,
  noun,
  formId,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: StepFooterProps) {
  const showSubmit = flow.isLast || mode === 'edit'
  const previous = flow.isFirst ? null : (
    <Button type="button" variant="outline" onClick={flow.back} disabled={isSubmitting}>
      <ArrowLeftIcon aria-hidden="true" />
      Previous
    </Button>
  )
  const advance = flow.isLast ? null : (
    <Button
      type="button"
      variant={showSubmit ? 'outline' : 'default'}
      onClick={() => void flow.next()}
      disabled={isSubmitting}
    >
      Next
      <ArrowRightIcon aria-hidden="true" />
    </Button>
  )

  return (
    <div className="flex flex-col gap-2">
      <FormActions
        mode={mode}
        {...(noun ? { noun } : {})}
        formId={formId}
        {...(flow.isFirst ? { onCancel } : {})}
        isSubmitting={isSubmitting}
        submitError={submitError}
        between={
          <>
            {previous}
            {advance}
          </>
        }
        {...(showSubmit ? {} : { hideSubmit: true })}
      />
    </div>
  )
}
