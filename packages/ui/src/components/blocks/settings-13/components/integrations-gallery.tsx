"use client"

import { ExternalLinkIcon, PlugZapIcon } from "lucide-react"
import { useState } from "react"
import {
  Frame,
  FrameFooter,
  FramePanel,
} from "@ui/components/reui/frame"

import { Button } from "@ui/primitives/button"
import { Item, ItemMedia } from "@ui/primitives/item"
import { Switch } from "@ui/primitives/switch"

import { integrationApps, type IntegrationApp } from "./data"

// ── Integration card ──

function IntegrationCard({ app }: { app: IntegrationApp }) {
  const [connected, setConnected] = useState(app.connected)

  return (
    <Frame>
      {/* Content */}
      <FramePanel className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Item className="bg-muted/60 border-background flex size-11 shrink-0 items-center justify-center border-2 p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border">
            <ItemMedia variant="icon" className="size-auto">
              {app.logo}
            </ItemMedia>
          </Item>

          <Button variant="ghost" size="icon-sm">
            <ExternalLinkIcon
              className="opacity-60"
              aria-hidden="true"
            />
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">{app.description}</p>
      </FramePanel>

      {/* Footer */}
      <FrameFooter className="flex flex-row items-center justify-between p-2">
        <Button
          type="button"
          size="sm"
          variant={connected ? "outline" : "default"}
          aria-pressed={connected}
          onClick={() => setConnected((c) => !c)}
        >
          {!connected ? (
            <PlugZapIcon
              aria-hidden="true"
            />
          ) : (
            ""
          )}
          {connected ? "Disconnect" : "Connect"}
        </Button>

        <Switch checked={connected} onCheckedChange={setConnected} />
      </FrameFooter>
    </Frame>
  )
}

// ── Main component ──

export function IntegrationsGallery() {
  return (
    <div className="w-full max-w-4xl space-y-4">
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
        {integrationApps.map((app) => (
          <IntegrationCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  )
}