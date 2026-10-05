Title: Integration cards show the V1 brand logos

Old reference: the integrations gallery showed the Stripe mark for Stripe and a one-letter placeholder for every other
connector, in a fixed 44px square tile.
New reference: every connector in the catalogue shows its real brand logo, the same artwork the V1 console uses. The
tile is still 44px tall and at least 44px wide, and grows to fit a wordmark (capped at 96px of logo).

Why: product review on 2026-10-05. Letters in boxes read as unfinished; V1 already had the artwork.

Affected:
[x] shared compositions: `ConnectorCard` logo tile `size-11` -> `h-11 min-w-11 px-2`, so wide wordmarks (Razorpay,
    HubSpot, Zoho, Stripe) stay legible instead of shrinking to a sliver. Square marks render exactly as before.
[x] pages: `IntegrationsBlock` renders `INTEGRATION_LOGOS[id]` and falls back to the initial for an unknown id
[x] assets: `packages/ui/src/assets/integrations/` holds 16 logos copied from `flexprice-front`. V1 hot-linked Stripe,
    Salesforce, PayPal and Zoho from Wikimedia / zohowebstatic and inlined Razorpay and HubSpot as data URIs; all are
    now local files, so nothing depends on a third-party host.
[x] visual baselines: `integrations`
[ ] tokens, typography: unchanged

Retired: the letter placeholder logos; the `Stripe` primitive on the integrations page (the primitive remains for the
sign-in screen).

Decision: design owner, 2026-10-05. V1's separate dark variants for Razorpay, HubSpot and Moyasar are not needed: the
tile is already light in dark mode (`dark:bg-foreground`), so the full-colour marks stay legible.

Migration: none. Salesforce and PayPal logos are included for when those premium connectors become connectable.
