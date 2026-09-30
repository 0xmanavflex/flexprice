import type { Integration } from '@fp/domain'
import { Page, type IntegrationApp } from '@ui/components/blocks/settings-13/page'
import { Stripe } from '@ui/components/primitives/svgs/stripe'

/** ReUI `settings-13`, fed the real integration catalogue and connection state. */
export interface IntegrationsBlockProps {
  integrations: Integration[]
}

function toApp(integration: Integration): IntegrationApp {
  return {
    id: integration.id,
    name: integration.name,
    description: integration.description,
    connected: integration.connections > 0,
    ...(integration.docsUrl ? { docsUrl: integration.docsUrl } : {}),
    logo:
      integration.id === 'stripe' ? (
        <Stripe className="size-6" />
      ) : (
        <span aria-hidden className="text-base font-semibold">
          {integration.name.charAt(0)}
        </span>
      ),
  }
}

export function IntegrationsBlock({ integrations }: IntegrationsBlockProps) {
  return <Page apps={integrations.filter((i) => !i.premium).map(toApp)} />
}
