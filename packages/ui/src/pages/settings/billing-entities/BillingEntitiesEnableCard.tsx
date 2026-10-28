import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'

export const BillingEntitiesEnableCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/layout/Section'],
  note: 'Settings section that offers to enable billing entities, or says they are being enabled.',
})

export interface BillingEntitiesEnableCardProps {
  environmentName: string
  canEnable: boolean
  /** Why Enable is disabled, shown under the description. */
  disabledReason?: string | null
  onEnable: () => void
  /** The environment is assigning its customers to the default entity. */
  isEnabling: boolean
}

export function BillingEntitiesEnableCard({
  environmentName,
  canEnable,
  disabledReason = null,
  onEnable,
  isEnabling,
}: BillingEntitiesEnableCardProps) {
  return (
    <Section
      title="Billing entities"
      action={
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3"
          disabled={!canEnable || isEnabling}
          onClick={onEnable}
        >
          Enable billing entities
        </Button>
      }
    >
      {isEnabling ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Spinner aria-hidden className="size-3.5 motion-reduce:animate-none" />
          Enabling billing entities in {environmentName}…
        </p>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Issue invoices from more than one legal seller. Each billing entity has its own name,
            address, tax IDs and invoice prefix.
          </p>
          {!canEnable && disabledReason ? (
            <p className="text-muted-foreground">{disabledReason}</p>
          ) : null}
        </div>
      )}
    </Section>
  )
}
