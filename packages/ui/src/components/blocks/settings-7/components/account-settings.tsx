// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState, type ComponentType } from "react"
import { cn } from "cn"

import { useIsMobile } from "@ui/hooks/use-mobile"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ui/primitives/tabs"

import { BillingTab } from "./billing-tab"
import { SETTINGS_TAB_ITEMS } from "./data"
import { NotificationsTab } from "./notifications-tab"
import { ProfileTab } from "./profile-tab"
import { SecurityTab } from "./security-tab"

const TAB_COMPONENTS: Record<string, ComponentType> = {
  profile: ProfileTab,
  security: SecurityTab,
  notifications: NotificationsTab,
  billing: BillingTab,
}

// ── Settings Navigation ──

function SettingsNavigation({
  isMobile,
  activeValue,
}: {
  isMobile: boolean
  activeValue: string
}) {
  return (
    <div className={cn("min-w-0", isMobile ? "w-full" : "w-40 shrink-0")}>
      {isMobile ? (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max min-w-max justify-start gap-1 bg-transparent p-0">
            {SETTINGS_TAB_ITEMS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "w-full justify-start gap-3 px-3 py-1.5 shadow-none",
                  activeValue === tab.value ? "bg-muted!" : "bg-transparent"
                )}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      ) : (
        <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
          {SETTINGS_TAB_ITEMS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "w-full justify-start gap-3 px-3 py-1.5 shadow-none",
                activeValue === tab.value ? "bg-muted!" : "bg-transparent"
              )}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      )}
    </div>
  )
}

export function AccountSettings() {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState("profile")

  return (
    <div className="w-full max-w-4xl space-y-8">
      {/* Header */}
      <header className="px-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Account Settings
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Update your profile, access, notifications, and billing preferences.
        </p>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation={isMobile ? "horizontal" : "vertical"}
        className={cn("w-full gap-4 lg:gap-8")}
      >
        <SettingsNavigation isMobile={isMobile} activeValue={activeTab} />

        <div className="min-w-0 flex-1">
          {SETTINGS_TAB_ITEMS.map((tab) => {
            const TabComponent = TAB_COMPONENTS[tab.value]

            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <TabComponent />
              </TabsContent>
            )
          })}
        </div>
      </Tabs>
    </div>
  )
}