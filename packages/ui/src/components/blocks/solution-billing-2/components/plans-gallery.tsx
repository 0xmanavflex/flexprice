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

import { Button } from "@ui/primitives/button"

import { CreatePlanDialog } from "./create-plan-dialog"
import { plans } from "./data"
import { PlanTile } from "./plan-tile"
import { PlansHeader } from "./plans-header"

export function PlansGallery() {
  const [createOpen, setCreateOpen] = React.useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(true)

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
    <div className="bg-background flex min-h-svh w-full flex-col">
      <div className="mx-auto w-full max-w-[1320px] p-3 md:p-4">
        {/* Content-level header */}
        <PlansHeader
          liveCount={liveCount}
          metaLabel={`${plans.length} plans`}
          editorName="Mara Whitfield"
          editorAvatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80"
          editedAt="edited 14 min ago"
          onCreatePlan={() => setCreateOpen(true)}
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
              <PlanTile key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </div>

      <CreatePlanDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}