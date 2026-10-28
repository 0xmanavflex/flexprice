import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@fp/ui/primitives'

/** A link to the billing entities, for settings that live there once entities are on. */
export function EntityManagedLink({
  entityId,
  children,
}: {
  entityId?: string | undefined
  children: ReactNode
}) {
  return (
    <Button
      variant="link"
      size="xs"
      nativeButton={false}
      className="self-start px-0"
      // Base UI marks a non-native button `role="button"`; this navigates.
      render={
        entityId ? (
          <Link
            role="link"
            to="/settings/billing-entities/$entityId"
            params={{ entityId }}
            search={{ tab: 'details' }}
          />
        ) : (
          <Link
            role="link"
            to="/settings"
            search={{ section: 'billing-entities', tab: 'entities' }}
          />
        )
      }
    >
      {children}
    </Button>
  )
}
