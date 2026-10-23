import { useEffect } from 'react'
import { useCopyEnvironment } from '@fp/query'
import type { ShellEnvironment } from '@fp/ui/compositions'
import { EnvironmentCopyForm, toast } from '@fp/ui/pages'
import { env } from '@/env'
import { useSession } from '@/app/session'
import { mutationMessage } from '../settings/panelKit'

/** The token the mocked build signs every request with — the same one `useEnvironments` uses. */
const MOCK_TOKEN = 'mock-session-token'

export interface EnvironmentCopyFormPageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The environment the console is in: the one being copied. */
  current: ShellEnvironment
  environments: readonly ShellEnvironment[]
}

/**
 * Copy the current environment's published plans and features, opened from the
 * environment switcher. The API queues the copy and answers at once, so success
 * closes the dialog and says it is running; a failure (a tenant's environment
 * quota, say) stays in the dialog with the API's own sentence.
 */
export function EnvironmentCopyFormPage({
  open,
  onOpenChange,
  current,
  environments,
}: EnvironmentCopyFormPageProps) {
  const { session } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)
  const copy = useCopyEnvironment(token)
  const { reset } = copy

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  return (
    <EnvironmentCopyForm
      open={open}
      onOpenChange={onOpenChange}
      source={current}
      environments={environments}
      isSubmitting={copy.isPending}
      submitError={
        copy.error ? mutationMessage(copy.error, 'The environment could not be copied.') : null
      }
      onSubmit={(target) => {
        const targetName =
          'targetEnvironmentId' in target
            ? (environments.find((e) => e.id === target.targetEnvironmentId)?.name ?? 'the target')
            : target.name
        copy.mutate(
          {
            sourceEnvironmentId: current.id,
            target:
              'targetEnvironmentId' in target
                ? target
                : // The API's word for a sandbox.
                  { name: target.name, type: 'development' },
          },
          {
            onSuccess: () => {
              onOpenChange(false)
              toast.success(`Copying plans and features to ${targetName}`, {
                description:
                  'It runs in the background; they appear there in a few minutes. Anything already there is skipped.',
              })
            },
          },
        )
      }}
    />
  )
}
