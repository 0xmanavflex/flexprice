import { useMemo, useState } from 'react'
import { BoxIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { Integration } from '@fp/domain'
import { ConnectorCard } from '@ui/compositions/layout/ConnectorCard'
import { Button } from '@ui/components/primitives/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { INTEGRATION_LOGOS } from '@ui/assets/integrations'

/**
 * The integrations gallery. The `settings-13` block is kept verbatim in
 * `components/blocks/settings-13`; the live page renders its layout (heading
 * and three-up grid) with the real catalogue through `ConnectorCard`.
 *
 * Connection state is real (`connections > 0`). Connect, Disconnect, Configure
 * and the on/off switch have no API yet: they update local state and toast.
 */
const ALL = 'All'

export interface IntegrationsBlockProps {
  integrations: Integration[]
}

function Logo({ integration }: { integration: Integration }) {
  const src = INTEGRATION_LOGOS[integration.id]
  return src ? (
    <img src={src} alt="" className="max-h-full max-w-full object-contain" />
  ) : (
    <span aria-hidden className="text-base font-medium">
      {integration.name.charAt(0)}
    </span>
  )
}

export function IntegrationsBlock({ integrations }: IntegrationsBlockProps) {
  const [connectedOverride, setConnected] = useState<Record<string, boolean>>({})
  const [disabled, setDisabled] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL)

  const listed = useMemo(() => integrations.filter((i) => !i.premium), [integrations])
  const options = useMemo(
    () =>
      [ALL, ...[...new Set(listed.flatMap((i) => i.categories))].sort()].map((value) => ({
        value,
        label: value,
        count:
          value === ALL ? listed.length : listed.filter((i) => i.categories.includes(value)).length,
      })),
    [listed],
  )

  const visible = integrations.filter((i) => {
    if (i.premium) return false
    if (category !== ALL && !i.categories.includes(category)) return false
    const needle = query.trim().toLowerCase()
    return needle === '' || `${i.name} ${i.description}`.toLowerCase().includes(needle)
  })
  const isConnected = (i: Integration) => connectedOverride[i.id] ?? i.connections > 0
  const connected = visible.filter(isConnected)
  const available = visible.filter((i) => !isConnected(i))

  const renderCard = (integration: Integration) => (
    <ConnectorCard
      key={integration.id}
      testId={`integration-${integration.id}`}
      name={integration.name}
      description={integration.description}
      docsUrl={integration.docsUrl}
      logo={<Logo integration={integration} />}
      connected={isConnected(integration)}
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

  const grid = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'
  const filtered = category !== ALL || query !== ''

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-16 2xl:px-14">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-72">
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground size-4" aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search integrations…"
            aria-label="Search integrations"
          />
        </InputGroup>
        <Select
          items={options}
          value={category}
          onValueChange={(next) => setCategory((next as string | null) ?? ALL)}
        >
          <SelectTrigger
            className="h-9! w-52 justify-start gap-2 pl-3 [&>svg]:ml-auto"
            aria-label="Category"
          >
            <span className="text-muted-foreground">Category</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                <span className="text-muted-foreground ml-auto pl-4 tabular-nums">
                  {option.count}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered ? (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-9"
            onClick={() => {
              setCategory(ALL)
              setQuery('')
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {connected.length > 0 ? (
        <section aria-labelledby="integrations-connected" className="space-y-3">
          <h2 id="integrations-connected" className="text-sm font-medium">
            Connected
          </h2>
          <div className={grid}>{connected.map(renderCard)}</div>
        </section>
      ) : null}

      <section aria-labelledby="integrations-available" className="space-y-3">
        <h2 id="integrations-available" className="text-sm font-medium">
          Available
        </h2>
        {available.length > 0 ? (
          <div className={grid}>{available.map(renderCard)}</div>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <BoxIcon className="size-4" aria-hidden="true" />
            No integrations match these filters.
          </p>
        )}
      </section>
    </div>
  )
}
