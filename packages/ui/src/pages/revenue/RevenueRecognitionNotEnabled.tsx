import { Button } from '@ui/components/primitives/button'
import { MessageSquareTextIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'
import { SectionEmpty } from '../../compositions/feedback/SectionEmpty'
import { Section } from '../../compositions/layout/Section'

export const RevenueRecognitionNotEnabledProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Section',
    'compositions/feedback/SectionEmpty',
    'primitives/button',
  ],
  note: 'The body of a Revenue page when revenue recognition is off for the environment: what it does, and one outline way to ask Flexprice to turn it on. Replaces an error that read as a failure.',
})

export interface RevenueRecognitionNotEnabledProps {
  /**
   * Opens the console's contact path (the support chat, or an email). Omit it when the
   * deployment has none, and the message stands alone.
   */
  onContact?: (() => void) | undefined
}

/** Revenue recognition is off for this environment: say what it is and how to get it. */
export function RevenueRecognitionNotEnabled({ onContact }: RevenueRecognitionNotEnabledProps) {
  // The way to ask for it is the section's action, top right, as every section's is.
  return (
    <Section
      table
      title="Revenue recognition"
      showTitle={false}
      {...(onContact
        ? {
            action: (
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={onContact}>
                <MessageSquareTextIcon aria-hidden />
                Contact us to enable it
              </Button>
            ),
          }
        : {})}
    >
      <SectionEmpty
        scene="revenue"
        title="Revenue recognition isn't enabled yet"
        description="It spreads invoiced amounts over the months they are earned, and reports deferred and unbilled balances each month. Contact Flexprice to turn it on for this environment."
      />
    </Section>
  )
}
