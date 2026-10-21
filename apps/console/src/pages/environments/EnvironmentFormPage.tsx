import { AccountState, type CreateEnvironment } from '@fp/domain'
import { useCreateEnvironment, useSelfBillingStatus, useSelfBillingSummary } from '@fp/query'
import type { ShellEnvironment } from '@fp/ui/compositions'
import { EnvironmentForm, type EnvironmentContact, type ProductionOffer } from '@fp/ui/pages'
import { useAccountLock } from '@/app/selfBilling/AccountLock'
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
  /** The workspace's environments, to know whether production already exists. */
  environments: readonly ShellEnvironment[]
  /** Switches to an environment, for "Switch to Production". */
  onSelectEnvironment: (id: string) => void
}

/**
 * What Production means here, from the workspace's own Flexprice account.
 *
 * Without self-billing it is the approval note (the contact buttons). In the
 * trial — and while locked — it is the upgrade: paying creates the production
 * environment (the API raises the limit and creates "Production" on
 * activation). Live, with production already there, it is that environment;
 * live without one (rare), it is an ordinary create.
 */
function useProductionOffer(
  environments: readonly ShellEnvironment[],
  onSelectEnvironment: (id: string) => void,
  close: () => void,
): { production?: ProductionOffer; canCreateProduction: boolean } {
  const status = useSelfBillingStatus()
  const billed = Boolean(status.data?.enabled)
  const summary = useSelfBillingSummary({ enabled: billed })
  const { upgrade } = useAccountLock()
  if (!billed) return { canCreateProduction: false }
  const state = status.data?.state
  if (state === AccountState.Trialing || state === AccountState.Suspended) {
    return {
      canCreateProduction: false,
      production: {
        kind: 'upgrade',
        eventCap: summary.data?.events?.cap ?? null,
        onUpgrade: () => {
          close()
          upgrade()
        },
      },
    }
  }
  const existing = environments.find((environment) => environment.kind === 'production')
  return existing
    ? {
        canCreateProduction: false,
        production: {
          kind: 'exists',
          name: existing.name,
          onSwitch: () => onSelectEnvironment(existing.id),
        },
      }
    : { canCreateProduction: true }
}

/**
 * Create an environment in a dialog over the current page.
 *
 * Opened from the environment switcher. It stays open on failure with the
 * API's own sentence under the fields (a tenant limit is a real 400), and on
 * success switches the console into what was just made — but only when the
 * response named it, since switching to an unknown id would 403 everything.
 */
export function EnvironmentFormPage({
  open,
  onOpenChange,
  environments,
  onSelectEnvironment,
}: EnvironmentFormPageProps) {
  const { session, setEnvironmentId } = useSession()
  const token = env.apiKey ?? session?.token ?? (env.useMocks ? MOCK_TOKEN : null)
  const create = useCreateEnvironment(token)
  const offer = useProductionOffer(environments, onSelectEnvironment, () => onOpenChange(false))

  return (
    <EnvironmentForm
      open={open}
      onOpenChange={onOpenChange}
      canCreateProduction={offer.canCreateProduction}
      {...(offer.production ? { production: offer.production } : {})}
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
