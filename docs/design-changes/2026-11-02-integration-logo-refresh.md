Title: Integration logos refreshed, with dark-mode marks

Old reference: the 2026-10-05 set copied from `flexprice-front`: a mix of PNG and SVG, several out of date (Stripe,
Chargebee, Paddle) and none cropped to the tile. In dark mode every logo tile was forced white
(`dark:bg-foreground`) so the colour marks stayed legible.
New reference: the "Integration Logo Set" (14 integrations from admin-dev `/integrations`). Every mark is an optimised
SVG with a square viewBox cropped tight to fill the tile. Light mode shows the official full-colour mark; dark mode
shows a white version of the same mark on the normal dark tile.

Why: product review on 2026-11-02. Current brand marks, crisp at every size, and no glaring white squares in dark mode.

Affected:
[x] assets: `packages/ui/src/assets/integrations/` holds the new light marks; `dark/` holds the white marks.
    `INTEGRATION_LOGOS_DARK` is keyed like `INTEGRATION_LOGOS` and falls back to it (Salesforce, PayPal).
[x] shared compositions: `ConnectorCard` logo tile drops `dark:bg-foreground dark:text-background
    dark:border-transparent`; it keeps its border in dark mode.
[x] pages: `IntegrationLogo`, `IntegrationMark`, `ConnectIntegrationSheet`, `ManageConnectionSheet` render both
    images and toggle them with `dark:hidden` / `hidden dark:block`.
[ ] visual baselines: `integrations` needs a refresh
[ ] tokens, typography: unchanged

Retired: the PNG logos for Chargebee, Paddle, Whop, Tabs and the three marketplaces; the forced-light tile in dark mode
(supersedes the dark-mode decision in `2026-10-05-integration-logos.md`).

Migration: none.
