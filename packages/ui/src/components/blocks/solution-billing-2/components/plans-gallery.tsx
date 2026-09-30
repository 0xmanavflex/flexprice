"use client"

import { TriangleAlertIcon } from "lucide-react"
import * as React from "react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ui/components/reui/alert"
import { toast } from "sonner"

import { Button } from "@ui/components/primitives/button"

import { CreatePlanDialog } from "./create-plan-dialog"
import { plans as demoPlans, type Plan } from "./data"
import { PlanTile } from "./plan-tile"
import { PlansHeader } from "./plans-header"

interface PlansGalleryProps {
  /** Omit to render the block's demo catalog. */
  plans?: Plan[]
  onCreatePlan?: () => void
  onEditPlan?: (planId: string) => void
}

export function PlansGallery({
  plans = demoPlans,
  onCreatePlan,
  onEditPlan,
}: PlansGalleryProps) {
  const isDemo = plans === demoPlans
  const [createOpen, setCreateOpen] = React.useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(isDemo)

  const liveCount = plans.filter((plan) => plan.status === "active").length

  function handleSave() {
    setHasUnsavedChanges(false)
    toast.success("Catalog saved", {
      description: "4 edits applied across the Scale and Enterprise plans.",
    })
  }

  function handleDiscard() {
    setHasUnsavedChanges(false)
    toast.info("Edits discarded", {
      description: "The catalog reverted to the version saved 14 min ago.",
    })
  }

  return (
    <div className="bg-background flex w-full flex-col">
      <div className="mx-auto w-full max-w-[1320px]">
        {/* Content-level header */}
        <PlansHeader
          liveCount={liveCount}
          metaLabel={`${plans.length} ${plans.length === 1 ? "plan" : "plans"}`}
          {...(isDemo
            ? {
                editorName: "Mara Whitfield",
                editorAvatar:
                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
                editedAt: "edited 14 min ago",
              }
            : {})}
          onCreatePlan={onCreatePlan ?? (() => setCreateOpen(true))}
        />

        <div className="mt-4 flex flex-col gap-4">
          {/* Unsaved changes banner */}
          {hasUnsavedChanges && (
            <Alert variant="warning">
              <TriangleAlertIcon
                aria-hidden="true"
              />
              <AlertTitle>Unsaved changes</AlertTitle>
              <AlertDescription>
                4 edits across the Scale and Enterprise plans are not published
                yet.
              </AlertDescription>
              <AlertAction>
                <Button type="button" variant="outline" onClick={handleDiscard}>
                  Discard
                </Button>
                <Button type="button" onClick={handleSave}>
                  Save changes
                </Button>
              </AlertAction>
            </Alert>
          )}

          {/* Plan tile gallery (the signature) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanTile
                key={plan.id}
                plan={plan}
                {...(onEditPlan ? { onEdit: onEditPlan } : {})}
              />
            ))}
          </div>
        </div>
      </div>

      <CreatePlanDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
