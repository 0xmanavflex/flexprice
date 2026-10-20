import { type CreateEnvironment } from '@fp/domain'
import { useCreateEnvironment } from '@fp/query'
import { EnvironmentForm, type EnvironmentContact } from '@fp/ui/pages'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { mutationMessage } from '../settings/panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

/**
 * How someone asks for a production environment: V1's contact details
 * (`config/contact.ts`) — the community Slack invite, support email, and a
 * booked call.
 * TODO(checkout): production becomes a self-serve paid upgrade; these are
 * replaced by the checkout flow then.
 */
export const PRODUCTION_CONTACT: EnvironmentContact = {
  slackUrl:
    'https://join.slack.com/t/flexpricecommunity/shared_invite/zt-39uat51l0-n8JmSikHZP~bHJNXladeaQ',
  email: 'support@flexprice.io',
  bookCallUrl: 'https://calendly.com/nikhil-flexprice/30min',
}

export interface EnvironmentFormPageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Create an environment in a dialog over the current page.
 *
 * Opened from the environment switcher. It stays open on failure with the
 * API's own sentence under the fields (a tenant limit is a real 400), and on
 * success switches the console into what was just made — but only when the
 * response named it, since switching to an unknown id would 403 everything.
 */
export function EnvironmentFormPage({ open, onOpenChange }: EnvironmentFormPageProps) {
  const { session, setEnvironmentId } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)
  const create = useCreateEnvironment(token)

  return (
    <EnvironmentForm
      open={open}
      onOpenChange={onOpenChange}
      canCreateProduction={false}
      contact={PRODUCTION_CONTACT}
      isSubmitting={create.isPending}
      submitError={
        create.error ? mutationMessage(create.error, 'The environment could not be created.') : null
      }
      onSubmit={(draft: CreateEnvironment) =>
        create.mutate(draft, {
          onSuccess: (created) => {
            if (created.id) setEnvironmentId(created.id)
            onOpenChange(false)
          },
        })
      }
    />
  )
}
