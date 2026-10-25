import { useEffect } from 'react'
import { useRenameEnvironment } from '@fp/query'
import { EnvironmentRenameForm } from '@fp/ui/pages'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { mutationMessage } from '../settings/panelKit'

/** The token the mocked build signs every request with: the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

export interface EnvironmentRenameFormPageProps {
  /** The environment being renamed; `null` closes the dialog. */
  environment: { id: string; name: string } | null
  onClose: () => void
}

/**
 * Rename an environment in a small dialog, opened from the switcher's pencil.
 *
 * Stays open on failure with the API's own sentence, and closes on success; the
 * mutation invalidates the environment list, so the switcher and the header
 * crumb pick up the new name from the server.
 */
export function EnvironmentRenameFormPage({
  environment,
  onClose,
}: EnvironmentRenameFormPageProps) {
  const { session } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)
  const rename = useRenameEnvironment(token)
  const { reset } = rename

  // A failure from renaming one environment is not the next one's to show.
  useEffect(() => {
    if (environment) reset()
  }, [environment, reset])

  return (
    <EnvironmentRenameForm
      open={environment !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      name={environment?.name ?? ''}
      isSubmitting={rename.isPending}
      submitError={
        rename.error ? mutationMessage(rename.error, 'The environment could not be renamed.') : null
      }
      onSubmit={(name) => {
        if (!environment) return
        rename.mutate({ id: environment.id, name }, { onSuccess: onClose })
      }}
    />
  )
}
