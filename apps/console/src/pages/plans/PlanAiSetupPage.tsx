import { useState } from 'react'
import type { PricingSchema } from '@fp/domain'
import { APPLY_STEP_LABEL, useApplyPricingSchema, useParsePricing } from '@fp/query'
import type { ApplyStep } from '@fp/query'
import { PlanAiSetupView, Toaster, toast } from '@fp/ui/pages'
import { PageBody } from '@fp/ui/compositions'
import { toSubmitError } from './planMessages'

export interface PlanAiSetupPageProps {
  /** Back to the plans list, on cancel or once everything is created. */
  onDone: () => void
}

/**
 * Create a catalogue from a description of a pricing page.
 *
 * Parsing and creating are two mutations on purpose: the first writes
 * nothing, and what it answers is shown in full before the second runs. The
 * schema is held here rather than refetched, so reading it again is a
 * deliberate act and not something a re-render can trigger.
 */
export function PlanAiSetupPage({ onDone }: PlanAiSetupPageProps) {
  const [description, setDescription] = useState('')
  const [schema, setSchema] = useState<PricingSchema | null>(null)
  const [step, setStep] = useState<ApplyStep | null>(null)

  const parse = useParsePricing()
  const apply = useApplyPricingSchema()

  return (
    <PageBody>
      <Toaster />
      <PlanAiSetupView
        description={description}
        onDescriptionChange={(value) => {
          setDescription(value)
          // The schema on screen describes the old text; keeping it beside a
          // changed description would invite creating the wrong thing.
          if (schema) setSchema(null)
        }}
        onParse={() => {
          parse.mutate(description, { onSuccess: setSchema })
        }}
        isParsing={parse.isPending}
        parseError={parse.isError ? toSubmitError(parse.error, 'read') : null}
        schema={schema}
        onDiscard={() => {
          setSchema(null)
          parse.reset()
          apply.reset()
        }}
        onApply={() => {
          if (!schema) return
          apply.mutate(
            { schema, onStep: setStep },
            {
              onSuccess: (result) => {
                const plans = Object.keys(result.planIds).length
                toast(plans === 1 ? 'Your plan is ready.' : `${plans} plans are ready.`)
                onDone()
              },
              onSettled: () => setStep(null),
            },
          )
        }}
        isApplying={apply.isPending}
        applyError={apply.isError ? toSubmitError(apply.error, 'create') : null}
        applyStep={step ? APPLY_STEP_LABEL[step] : null}
        onCancel={onDone}
      />
    </PageBody>
  )
}
