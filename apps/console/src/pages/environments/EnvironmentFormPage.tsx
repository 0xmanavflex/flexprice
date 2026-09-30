import { type CreateEnvironment } from '@fp/domain'
import { useCreateEnvironment } from '@fp/query'
import { EnvironmentForm } from '@fp/ui/pages'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { mutationMessage } from '../settings/panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

export interface EnvironmentFormPageProps {
  onCancel: () => void
  onDone: () => void
}

/**
 * Create an environment on its own page, `/environments/new`.
 *
 * Opened from the switcher and from Settings. It stays open on failure with the
 * API's own sentence under the form (a tenant limit is a real 400), and on
 * success switches the console into what was just made — but only when the
 * response named it, since switching to an unknown id would 403 everything.
 */
export function EnvironmentFormPage({ onCancel, onDone }: EnvironmentFormPageProps) {
  const { session, setEnvironmentId } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)
  const create = useCreateEnvironment(token)

  return (
    <EnvironmentForm
      trail={[{ label: 'Environments', onClick: onCancel }, { label: 'Create environment' }]}
      canCreateProduction={false}
      productionUnavailableReason="Set up with your account contact."
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={mutationMessage(create.error, 'The environment could not be created.')}
      onSubmit={(draft: CreateEnvironment) =>
        create.mutate(draft, {
          onSuccess: (created) => {
            if (created.id) setEnvironmentId(created.id)
            onDone()
          },
        })
      }
    />
  )
}
