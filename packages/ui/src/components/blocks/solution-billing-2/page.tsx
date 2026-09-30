import type { ComponentProps } from "react"

import { PlansGallery } from "./components/plans-gallery"

export type { Plan } from "./components/data"

export function Page(props: ComponentProps<typeof PlansGallery>) {
  return <PlansGallery {...props} />
}
