import { useState } from 'react'
import { toast } from 'sonner'
import type { Integration } from '@fp/domain'
import { ConnectorCard } from '@ui/compositions/ConnectorCard'
import { Stripe } from '@ui/components/primitives/svgs/stripe'

/**
 * The integrations gallery. The `settings-13` block is kept verbatim in
 * `components/blocks/settings-13`; the live page renders its layout (heading
 * and three-up grid) with the real catalogue through `ConnectorCard`.
 *
 * Connection state is real (`connections > 0`). Connect, Disconnect, Configure
 * and the on/off switch have no API yet: they update local state and toast.
 */
export interface IntegrationsBlockProps {
  integrations: Integration[]
}

function Logo({ integration }: { integration: Integration }) {
  return integration.id === 'stripe' ? (
    <Stripe className="size-6" />
  ) : (
    <span aria-hidden className="text-base font-medium">
      {integration.name.charAt(0)}
    </span>
  )
}

export function IntegrationsBlock({ integrations }: IntegrationsBlockProps) {
  const [connectedOverride, setConnected] = useState<Record<string, boolean>>({})
  const [disabled, setDisabled] = useState<Record<string, boolean>>({})

  return (
    <div className="w-full space-y-4">
      <div className="space-y-0.5">
        <h1 className="text-xl font-medium">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Enhance your workspace by linking external tools for communication, payments, and
          automation.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {integrations
          .filter((i) => !i.premium)
          .map((integration) => {
            const connected = connectedOverride[integration.id] ?? integration.connections > 0
            return (
              <ConnectorCard
                key={integration.id}
                testId={`integration-${integration.id}`}
                name={integration.name}
                description={integration.description}
                docsUrl={integration.docsUrl}
                logo={<Logo integration={integration} />}
                connected={connected}
                enabled={!disabled[integration.id]}
                onConnect={() => {
                  setConnected((s) => ({ ...s, [integration.id]: true }))
                  toast(`${integration.name} connect is a demo action — no request was sent.`)
                }}
                onDisconnect={() => {
                  setConnected((s) => ({ ...s, [integration.id]: false }))
                  toast(`${integration.name} disconnect is a demo action — no request was sent.`)
                }}
                onConfigure={() => toast(`Configure ${integration.name} is not available yet.`)}
                onEnabledChange={(on) => setDisabled((s) => ({ ...s, [integration.id]: !on }))}
              />
            )
          })}
      </div>
    </div>
  )
}
