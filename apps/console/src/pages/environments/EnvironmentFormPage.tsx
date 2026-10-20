import { type CreateEnvironment } from '@fp/domain'
import { useCreateEnvironment } from '@fp/query'
import { EnvironmentForm } from '@fp/ui/pages'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { mutationMessage } from '../settings/panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

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
      // Both from `VITE_PLATFORM_CONFIG` in `env.ts`.
      canCreateProduction={env.platform.production.enabled}
      contact={env.platform.contact}
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
