import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { EnvironmentForm, type EnvironmentFormProps } from './EnvironmentForm'

/**
 * Creating an environment, as a centred dialog.
 *
 * The same container as every other create flow: it has two fields and no
 * sequence, and it is always started from the switcher in the corner of
 * whatever you were already doing, so a dialog over the current page is right.
 */
export const EnvironmentCreateDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'EnvironmentForm in the shared form dialog.',
})

export interface EnvironmentCreateDialogProps extends Omit<EnvironmentFormProps, 'onCancel'> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnvironmentCreateDialog({
  open,
  onOpenChange,
  ...form
}: EnvironmentCreateDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New environment"
      description="Data does not cross between environments."
      size="sm"
    >
      <EnvironmentForm {...form} onCancel={() => onOpenChange(false)} />
    </FormDialog>
  )
}
