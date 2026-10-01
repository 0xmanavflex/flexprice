import { useWebhookDashboard } from '@fp/query'
import { EmptyState, LoadingRows } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { WebhookIcon } from 'lucide-react'
import { useSession } from '@/app/session'
import { Fact, Panel, PanelError, toFailure, SettingsBlock } from './panelKit'

/**
 * The way in to this tenant's Svix webhook portal.
 *
 * `GET /webhooks/dashboard`. Read-only on purpose: endpoints, retries, signing
 * secrets and delivery logs all live in Svix's own portal, and this console
 * has no route that edits any of them. What it can do is open the door.
 *
 * ## The response carries a live credential, and this file never shows it
 *
 * `useWebhookDashboard` answers `{appId, svixEnabled, token, url}`. **`token`
 * is a live Svix app token and `url` is a one-time sign-in link that logs its
 * holder into this tenant's webhook configuration.** Neither is rendered,
 * logged, copied to a clipboard, put in a `title`, a `data-` attribute, an
 * error message, a test name or a screenshot, and neither is persisted
 * anywhere — not in state that outlives the panel, not in `localStorage`, not
 * in a URL. `token` is not even destructured below.
 *
 * Concretely, that is why the "open" control is a `<button>` calling
 * `window.open` rather than an `<a href={url}>`: an anchor puts the credential
 * in the DOM, in the browser's status bar on hover, and in anything that
 * serialises the page — a DOM snapshot in a bug report, a session replay, an
 * accessibility-tree dump. A click handler hands the string to the browser and
 * lets it go. `noopener,noreferrer` stops the opened tab reaching back through
 * `window.opener` and stops a referrer carrying the link onward.
 *
 * `appId` is not a credential — it is the Svix application identifier, which is
 * what you match this environment against in a Svix dashboard — so it is shown.
 *
 * The link is single use. Once it has been handed over the panel refetches, so
 * the next press has a fresh one rather than replaying a spent link and landing
 * on a Svix error page.
 */
export function WebhooksPanel() {
  const { environmentId } = useSession()
  const dashboard = useWebhookDashboard(environmentId)

  const failure = toFailure(dashboard.error, 'your webhook settings')

  if (failure) {
    return (
      <Panel>
        <PanelError failure={failure} onRetry={() => void dashboard.refetch()} />
      </Panel>
    )
  }

  // The query is disabled until an environment is chosen, so "no id yet" has
  // to read as loading — `isPending` alone stays true forever in that state.
  if (!environmentId || dashboard.isPending || !dashboard.data) {
    return (
      <Panel>
        <LoadingRows rows={3} columns={2} />
      </Panel>
    )
  }

  const { appId, svixEnabled } = dashboard.data

  if (!svixEnabled) {
    return (
      <Panel>
        <SettingsBlock
          title="Webhooks"
          description="Flexprice delivers webhooks through Svix, which this deployment does not have switched on."
        >
          <EmptyState
            size="inline"
            icon={<WebhookIcon aria-hidden />}
            title="Webhooks are not enabled here"
            description="This deployment has no Svix integration configured, so there is no portal to open and no endpoints to manage. Ask whoever runs it to enable webhooks."
          />
        </SettingsBlock>
      </Panel>
    )
  }

  return (
    <Panel>
      <SettingsBlock
        title="Webhooks"
        description="Endpoints, signing secrets, retries and delivery logs are configured in Svix. This opens that portal, signed in as this environment."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Svix application">
            <span className="font-mono text-xs">{appId || '—'}</span>
          </Fact>
          <Fact label="Status">Enabled</Fact>
        </dl>

        <div className="flex flex-col gap-2">
          <div>
            <Button
              type="button"
              disabled={dashboard.isFetching}
              onClick={() => {
                // Read at the moment of the click and handed straight to the
                // browser. Never assigned to state, never logged.
                const link = dashboard.data?.url
                if (!link) return
                window.open(link, '_blank', 'noopener,noreferrer')
                // Single use — the next press needs a new one.
                void dashboard.refetch()
              }}
            >
              Open the Svix webhook portal
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Opens in a new tab. The sign-in link is single use, and this panel fetches a fresh one
            each time — use the button rather than bookmarking what it opens.
          </p>
        </div>
      </SettingsBlock>
    </Panel>
  )
}
