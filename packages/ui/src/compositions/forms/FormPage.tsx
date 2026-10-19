import { CircleAlertIcon } from '@ui/icons'
import type { ReactNode } from 'react'
import { FieldGroup, FieldSet } from '@ui/components/primitives/field'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import type { DetailCrumb } from '../detail/DetailShell'
import { FormToolbar, type FormToolbarProps } from './FormToolbar'
import { usePublishDetailTrail } from '../shell/ShellDetailTrail'
import { PageBody } from '../layout/Page'
import { Section } from '../layout/Section'
import type { FormFlow } from './useFormSteps'
import { WorkflowStepper } from './WorkflowStepper'

/**
 * The full-page shell for creating or editing a major resource.
 *
 * Create and Edit share it: the same body measure, and the actions sit in the
 * card under the fields. Edit is the same form prepopulated, so a person who has
 * created a plan already knows how to edit one. The surface is the reference
 * `Section` (never the Card primitive): it opens with what this form is for —
 * the title. The shell still owns the breadcrumb.
 *
 * Layout only: the `<form>` (and its state) lives in the caller. Pass the
 * form's `id` to `FormActions` so the bar can sit outside the `<form>` element.
 */
export const FormPageProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/page',
    'compositions/section',
    'compositions/form-toolbar',
    'compositions/workflow-stepper',
    'compositions/use-form-steps',
    'ui/field',
  ],
  note: 'Full-page create/edit shell. Either a toolbar pinned above the page (form-3 style: close, title, primary CTA; Previous/Next for a staged form) with the form beneath it — plus, optionally, a c-stepper-1 style stepper in the toolbar — or the Section surface with the actions at its foot.',
})

/** A stepper in the header: the form's `useFormSteps` flow, drawn as the header stepper. */
export interface FormPageStepper {
  flow: FormFlow
  label?: string
  /** Hide Previous/Next (and the submit), e.g. while a step's own sub-form is open. */
  hideNav?: boolean
}

/** What the pinned toolbar needs from the caller; the title is the page's own. */
export type FormPageToolbar = Omit<FormToolbarProps, 'title'> & {
  submitError?: string | null | undefined
}

interface FormPageBaseProps {
  title: string
  /** The way back, then this form. The shell header draws it; the parent crumb is a link. */
  trail: DetailCrumb[]
  children: ReactNode
  width?: 'wide' | 'narrow'
  className?: string
}

export type FormPageProps = FormPageBaseProps &
  (
    | {
        /** Pins close, title and the CTA above the page; the form cards sit directly beneath. */
        toolbar: FormPageToolbar
        footer?: never
        /** Optional. Draws the steps in the toolbar, between the title and the actions; omit for a plain single-page form. */
        stepper?: FormPageStepper | undefined
        /**
         * @deprecated Create forms no longer carry a preview rail. A preview
         * returns only on a future checkout review screen.
         * TODO(checkout-review): remove once no form passes it.
         */
        preview?: ReactNode | undefined
      }
    | {
        toolbar?: never
        stepper?: never
        preview?: never
        /** The bar at the foot of the surface: usually `FormActions` or a stepper's footer. */
        footer: ReactNode
      }
  )

export function FormPage({
  title,
  trail,
  children,
  toolbar,
  footer,
  stepper,
  preview,
  width = 'narrow',
  className,
}: FormPageProps) {
  usePublishDetailTrail(trail)

  if (toolbar) {
    const { submitError, ...toolbarProps } = toolbar
    const flow = stepper?.flow
    // A staged form submits from its last step (or any step when editing);
    // before that the toolbar's Next advances. There is no bottom step nav.
    const navHidden = Boolean(stepper?.hideNav)
    const hideSubmit =
      toolbarProps.hideSubmit ||
      (flow ? navHidden || !(flow.isLast || toolbar.mode === 'edit') : false)
    const onPrevious = flow && !navHidden && !flow.isFirst ? flow.back : undefined
    const onNext = flow && !navHidden && !flow.isLast ? () => void flow.next() : undefined
    const fields = (
      <FieldSet className="gap-0 pb-6">
        <FieldGroup className={cn(width === 'narrow' && !preview && 'mx-auto w-full max-w-3xl')}>
          {children}
        </FieldGroup>
      </FieldSet>
    )
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
        {/* The bar sits outside the scrolling region, so it stays put without
            `sticky`; the form cards are their own surfaces underneath. */}
        <FormToolbar
          title={title}
          {...toolbarProps}
          hideSubmit={hideSubmit}
          onPrevious={onPrevious}
          onNext={onNext}
          center={
            stepper && flow ? (
              <WorkflowStepper
                variant="header"
                steps={flow.workflow}
                currentStep={flow.step}
                onStepChange={flow.goTo}
                aria-label={stepper.label ?? 'Steps'}
              />
            ) : undefined
          }
        />
        <PageBody width="wide" className="self-center pt-6">
          {submitError ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
          <div
            className={cn(
              preview && 'grid gap-7 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start',
            )}
          >
            <div className="flex min-w-0 flex-col">{fields}</div>
            {preview ? <div className="min-w-0 lg:sticky lg:top-0">{preview}</div> : null}
          </div>
        </PageBody>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* The card fills the viewport: `flex-1` takes every pixel the shell
          leaves under the header, and the actions sit at its foot (`mt-auto`),
          so a short form is a full-height page rather than a small card
          floating in the middle of an empty one. A taller form scrolls. Always
          the full `wide` measure; `narrow` caps the fields, not the surface. */}
      <PageBody width="wide" className="self-center">
        <Section as="h1" title={title} className="flex-1" bodyClassName="flex flex-col">
          <FieldSet className="gap-0 pb-6">
            <FieldGroup className={cn(width === 'narrow' && 'mx-auto max-w-3xl')}>
              {children}
            </FieldGroup>
          </FieldSet>
          {footer ? <div className="mt-auto border-t pt-5">{footer}</div> : null}
        </Section>
      </PageBody>
    </div>
  )
}
