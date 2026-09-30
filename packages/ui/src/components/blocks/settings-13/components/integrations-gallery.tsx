"use client"

import { ExternalLinkIcon, PlugZapIcon } from "lucide-react"
import { useState } from "react"
import {
  Frame,
  FrameFooter,
  FramePanel,
} from "@ui/components/reui/frame"

import { Button, buttonVariants } from "@ui/components/primitives/button"
import { Item, ItemMedia } from "@ui/components/primitives/item"
import { Switch } from "@ui/components/primitives/switch"

import { integrationApps, type IntegrationApp } from "./data"

// ── Integration card ──

function IntegrationCard({ app, live }: { app: IntegrationApp; live: boolean }) {
  const [demoConnected, setConnected] = useState(app.connected)
  const connected = live ? app.connected : demoConnected

  return (
    <Frame data-testid={`integration-${app.id}`}>
      {/* Content */}
      <FramePanel className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Item className="bg-muted/60 border-background flex size-11 shrink-0 items-center justify-center border-2 p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border">
            <ItemMedia variant="icon" className="size-auto">
              {app.logo}
            </ItemMedia>
          </Item>

          {app.docsUrl ? (
            <a
              href={app.docsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Setup guide for ${app.name ?? app.id}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <ExternalLinkIcon className="opacity-60" aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <div className="space-y-1">
          {app.name ? <h3 className="text-sm font-semibold">{app.name}</h3> : null}
          <p className="text-muted-foreground text-sm">{app.description}</p>
        </div>
      </FramePanel>

      {/* Footer */}
      <FrameFooter className="flex flex-row items-center justify-between p-2">
        {live ? (
          <span className="text-muted-foreground px-2 text-sm">
            {connected ? "Connected" : "Not connected"}
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant={connected ? "outline" : "default"}
            aria-pressed={connected}
            onClick={() => setConnected((c) => !c)}
          >
            {!connected ? <PlugZapIcon aria-hidden="true" /> : ""}
            {connected ? "Disconnect" : "Connect"}
          </Button>
        )}

        <Switch
          checked={connected}
          disabled={live}
          aria-label={`${app.name ?? app.id} connection`}
          onCheckedChange={setConnected}
        />
      </FrameFooter>
    </Frame>
  )
}

// ── Main component ──

export function IntegrationsGallery({ apps }: { apps?: IntegrationApp[] }) {
  const live = apps !== undefined
  return (
    <div className="w-full space-y-4">
      {/* Heading */}
      <div className="flex flex-col gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-muted-foreground text-sm">
            Enhance your workspace by linking external tools for communication,
            payments, and automation.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {(apps ?? integrationApps).map((app) => (
          <IntegrationCard key={app.id} app={app} live={live} />
        ))}
      </div>
    </div>
  )
}