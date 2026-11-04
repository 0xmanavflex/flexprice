import { useEffect, useRef, useState } from 'react'
import {
  PRICING_TEMPLATE_SCHEMAS,
  type PricingSchema,
  type PricingTemplateId,
  pricingTemplateSchema,
} from '@fp/domain'
import { useApplyPricingSchema, useParsePricing } from '@fp/query'
import type { ApplyStep } from '@fp/query'
import { PlanAiSetupView, toast } from '@fp/ui/pages'
import { toSubmitError } from './planMessages'

/** How long "Your pricing has been created" stays up before Plans, as the reference. */
const CREATED_HOLD_MS = 1600
/**
 * A template is not sent to the model (as in V1): its schema is ready at once.
 * The draft card still walks its steps for this long, so a template reads as
 * drafted rather than appearing from nowhere.
 */
const TEMPLATE_DRAFT_MS = 2400

function isTemplateId(id: string | undefined): id is PricingTemplateId {
  return id !== undefined && id in PRICING_TEMPLATE_SCHEMAS
}

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
 *
 * The view fills the content area itself (its prompt ground and review
 * canvas run edge to edge), so there is no `PageBody` around it.
 */
export function PlanAiSetupPage({ onDone }: PlanAiSetupPageProps) {
  const [description, setDescription] = useState('')
  const [schema, setSchema] = useState<PricingSchema | null>(null)
  const [step, setStep] = useState<ApplyStep | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  const parse = useParsePricing()
  const apply = useApplyPricingSchema()
  // A template being "drafted": its schema is known, the card is still walking.
  const [templateDrafting, setTemplateDrafting] = useState(false)
  const templateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(templateTimer.current), [])

  // Hold the success card for a moment, then go to Plans with a toast.
  useEffect(() => {
    if (!created) return
    const timer = setTimeout(() => {
      toast.success('Your pricing has been created', { description: created })
      onDone()
    }, CREATED_HOLD_MS)
    return () => clearTimeout(timer)
  }, [created, onDone])

  return (
    <>
      <PlanAiSetupView
        description={description}
        onDescriptionChange={(value) => {
          setDescription(value)
          // The schema on screen describes the old text; keeping it beside a
          // changed description would invite creating the wrong thing.
          if (schema) setSchema(null)
        }}
        onParse={(text, templateId) => {
          setSchema(null)
          clearTimeout(templateTimer.current)
          if (isTemplateId(templateId)) {
            // A template sent as written: its own schema, no model, as in V1.
            parse.reset()
            setTemplateDrafting(true)
            templateTimer.current = setTimeout(() => {
              setTemplateDrafting(false)
              setSchema(pricingTemplateSchema(templateId))
            }, TEMPLATE_DRAFT_MS)
            return
          }
          parse.mutate(text, { onSuccess: setSchema })
        }}
        isParsing={parse.isPending || templateDrafting}
        parseError={parse.isError ? toSubmitError(parse.error, 'read') : null}
        schema={schema}
        onDiscard={() => {
          clearTimeout(templateTimer.current)
          setTemplateDrafting(false)
          setSchema(null)
          parse.reset()
          apply.reset()
        }}
        onApply={() => {
          if (!schema) return
          apply.mutate(
            { schema, onStep: setStep },
            {
              onSuccess: () => {
                const n = (count: number, noun: string) =>
                  `${count} ${noun}${count === 1 ? '' : 's'}`
                setCreated(
                  [
                    n(schema.features.length, 'feature'),
                    n(schema.plans.length, 'plan'),
                    schema.creditGrants.length
                      ? n(schema.creditGrants.length, 'credit grant')
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                )
              },
              onSettled: () => setStep(null),
            },
          )
        }}
        isApplying={apply.isPending}
        applyError={apply.isError ? toSubmitError(apply.error, 'create') : null}
        createStep={step}
        created={created !== null}
        onCancel={onDone}
      />
    </>
  )
}
