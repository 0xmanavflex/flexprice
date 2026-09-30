"use client"

import { GlobeIcon, LockIcon, PencilIcon, PlusIcon } from "lucide-react"
import * as React from "react"
import { Badge } from "@ui/components/reui/badge"
import {
  Frame,
  FrameFooter,
  FramePanel,
} from "@ui/components/reui/frame"
import { cn } from "cn"
import { toast } from "sonner"

import { Button } from "@ui/components/primitives/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@ui/components/primitives/item"
import { Switch } from "@ui/components/primitives/switch"

import {
  statusLabel,
  statusVariant,
  type BillingInterval,
  type Entitlement,
  type Plan,
} from "./data"
import { DotSeparator } from "./dot-separator"
import { EditPlanDialog, type EditablePlanDetails } from "./edit-plan-dialog"

// ── Feature list (card-41 ItemGroup grammar) ──

function Features({ items }: { items: Entitlement[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-xs">Features</h4>
      <ItemGroup className="gap-0!">
        {items.map((item, index) => (
          <div key={item.id} className="contents">
            <Item size="sm" className="flex-nowrap px-0 py-0">
              <ItemMedia>{item.icon}</ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full min-w-0">
                  <span className="truncate text-sm leading-5 font-medium">
                    {item.label}
                  </span>
                </ItemTitle>
              </ItemContent>
              <ItemActions className="shrink-0">
                <span className="text-muted-foreground text-sm leading-5 tabular-nums">
                  {item.value}
                </span>
              </ItemActions>
            </Item>
            {index < items.length - 1 ? (
              <ItemSeparator className="my-2 border-t border-dashed bg-transparent" />
            ) : null}
          </div>
        ))}
      </ItemGroup>
    </div>
  )
}

function PublicToast({ children }: { children: string }) {
  return <span>{children}</span>
}

interface PlanTileProps {
  plan: Plan
}

export function PlanTile({ plan }: PlanTileProps) {
  const [active, setActive] = React.useState(plan.status === "active")
  const [isPublic, setIsPublic] = React.useState(plan.isPublic)
  const [interval, setInterval] = React.useState<BillingInterval>("monthly")
  const [editOpen, setEditOpen] = React.useState(false)
  const [extraEntitlements, setExtraEntitlements] = React.useState(0)
  const [details, setDetails] = React.useState<EditablePlanDetails>({
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice,
    perSeat: plan.perSeat,
    interval: "monthly",
  })

  const isArchived = plan.status === "archived"
  const status = active ? "active" : isArchived ? "archived" : "draft"
  const price =
    interval === "monthly" ? details.monthlyPrice : details.annualPrice
  const intervalLabel = interval === "monthly" ? "mo" : "yr"
  const entitlementCount = plan.entitlements.length + extraEntitlements

  function handleToggleActive(next: boolean) {
    setActive(next)
    toast.success(
      <PublicToast>
        {next ? `${details.name} is active` : `${details.name} set to draft`}
      </PublicToast>,
      {
        description: next
          ? `New signups can subscribe to ${details.name} from today.`
          : `${details.name} is hidden from new signups until you reactivate it.`,
      }
    )
  }

  function handleTogglePublic(next: boolean) {
    setIsPublic(next)
    toast.success(
      <PublicToast>
        {next ? `${details.name} is public` : `${details.name} is private`}
      </PublicToast>,
      {
        description: next
          ? `${details.name} now shows on the public pricing page.`
          : `${details.name} is sales-only and hidden from public pricing.`,
      }
    )
  }

  function handleSaveDetails(nextDetails: EditablePlanDetails) {
    setDetails(nextDetails)
    setInterval(nextDetails.interval)
    toast.success(<PublicToast>{`${nextDetails.name} updated`}</PublicToast>, {
      description: `Plan details saved at $${nextDetails.monthlyPrice.toLocaleString()} monthly and $${nextDetails.annualPrice.toLocaleString()} annually.`,
    })
  }

  function handleAddEntitlement() {
    setExtraEntitlements((count) => count + 1)
    toast.success(
      <PublicToast>{`Entitlement added to ${details.name}`}</PublicToast>,
      {
        description: `${details.name} now lists ${
          plan.entitlements.length + extraEntitlements + 1
        } entitlements. Save to apply.`,
      }
    )
  }

  return (
    <Frame
      dense
      className={cn("flex h-full flex-col", isArchived && "opacity-80")}
    >
      {/* Content */}
      <FramePanel className="flex flex-1 flex-col gap-4">
        {/* Identity row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-foreground text-sm font-semibold">
                {details.name}
              </h3>
              <Badge variant={statusVariant[status]}>
                {statusLabel[status]}
              </Badge>
              <span className="text-muted-foreground text-xs tabular-nums">
                {plan.id}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {isPublic ? (
                <GlobeIcon
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <LockIcon
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{isPublic ? "Public" : "Private"}</span>
              <DotSeparator />
              <span className="tabular-nums">
                {plan.subscribers.toLocaleString()} subscribers
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${details.name} details`}
            onClick={() => setEditOpen(true)}
          >
            <PencilIcon
              className="opacity-60"
              aria-hidden="true"
            />
          </Button>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-foreground text-2xl font-semibold tabular-nums">
            ${price.toLocaleString()}
          </span>
          <span className="text-muted-foreground text-sm">
            {details.perSeat
              ? `per seat / ${intervalLabel}`
              : `/ ${intervalLabel}`}
          </span>
        </div>

        {/* Features */}
        <Features items={plan.entitlements} />

        {/* Add-ons */}
        {plan.addOns.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-muted-foreground text-xs">Add-ons</h4>
            <div className="flex flex-col gap-1.5">
              {plan.addOns.map((addOn) => (
                <div
                  key={addOn.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {addOn.icon}
                    <span className="truncate">{addOn.label}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {addOn.price.startsWith("Included")
                      ? addOn.price
                      : `$${addOn.price}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add entitlement */}
        <Button
          type="button"
          variant="outline"
          className="mt-auto"
          onClick={handleAddEntitlement}
        >
          <PlusIcon
            aria-hidden="true"
          />
          Add entitlement
        </Button>
        <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
          <span>{entitlementCount} entitlements</span>
          <DotSeparator />
          <span>
            {plan.addOns.length} add-
            {plan.addOns.length === 1 ? "on" : "ons"}
          </span>
        </p>
      </FramePanel>

      {/* Footer: active + public toggles */}
      <FrameFooter className="flex flex-col gap-2 p-3">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="text-foreground">Active</span>
          <Switch
            checked={active}
            onCheckedChange={handleToggleActive}
            aria-label={`Toggle ${details.name} active`}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="text-foreground">Public</span>
          <Switch
            checked={isPublic}
            onCheckedChange={handleTogglePublic}
            aria-label={`Toggle ${details.name} public`}
          />
        </label>
      </FrameFooter>

      <EditPlanDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        planId={plan.id}
        details={details}
        onSave={handleSaveDetails}
      />
    </Frame>
  )
}