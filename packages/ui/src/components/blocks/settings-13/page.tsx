import type { ComponentProps } from "react"

import { IntegrationsGallery } from "./components/integrations-gallery"

export type { IntegrationApp } from "./components/data"

export function Page(props: ComponentProps<typeof IntegrationsGallery>) {
  return (
    <div className="flex w-full items-start">
      <IntegrationsGallery {...props} />
    </div>
  )
}
