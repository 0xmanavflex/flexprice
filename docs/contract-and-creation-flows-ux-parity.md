# Contracts and creation flows: V1/V2 UX and parity review

Reviewed 6 November 2026. Implementation target: Portal V2. Reference: `../flexprice-front`.

## Scope and evidence

This report consolidates the contract amendment implementation, the supported invoice/integration follow-up, and the wider creation-flow review requested afterward. V1 and backend source were read, not modified. The work uses V2's existing kit, domain schemas, query layer and permissions.

**This is not a certification of complete live parity.** The route/form inventory below covers the discovered modules. Field and mapper review is deeper for contracts, customers, features, prices, invoices and integrations than for secondary configuration screens. Provider OAuth completion, external writes, payment capture, every role combination, and live persistence of the new contract amendments remain unverified. A source match or a mocked test is not evidence that a live workflow completed.

Evidence levels used below:

- **Source:** route, form/schema, wiring or request mapper inspected.
- **Component:** real Chromium component interaction and accessibility tests executed.
- **Assembly:** Playwright journey through the mocked application, real router and query wiring.
- **Live UI:** both localhost applications connected to the same development environment; existing records read, forms opened and changes staged without submission.
- **Live write:** not performed for this implementation batch.

V2 baseline: `8b3c77762619d4f47dd7df90604dbbd10090ba9a`. Reference V1 baseline: `870d8ca7` (short revision). Browser environment: **Harshit's home**, sandbox. Local applications: V1 port 4316, V2 port 4317. Never mix their customer/contract IDs across environments. Credentials and token URLs are intentionally omitted.

Related deeper evidence:

- [Contract functional audit](./contract-creation-edit-v1-v2-parity-audit.md)
- [Invoice and integration audit](./invoice-integration-v1-v2-parity-audit.md)
- [Customer portal audit](./customer-portal-v1-v2-parity-audit.md)

## 1. Route and workflow inventory

V1 paths below are relative to its console; source roots are `src/pages`, `src/components/molecules` and `src/components/organisms`. V2 page sources are under `packages/ui/src/pages`; application wiring is under `apps/console/src/pages`, with requests under `packages/query/src`. Repeated row-level dialogs are grouped with their owning workflow, rather than counted as independent routes.

| Module and workflows | V1 entry and component family | V2 equivalent | Review and principal finding |
| --- | --- | --- | --- |
| Contract create; customer-scoped create; draft | `/billing/subscriptions/create`, customer `add-subscription`; `Subscription/SubscriptionForm`, `CreateCustomerSubscriptionPage` | `/contracts/new`, `/customers/:id/contracts/new`; `contracts/SubscriptionForm`, `SubscriptionFormPage` | Source, component, assembly, live UI. Five steps; full catalogue search; new shared allowances; tax search; draft protection. |
| Contract details, metadata, billing, pause/resume/cancel/activate | `/billing/subscriptions/:id`, nested customer subscription; `SubscriptionDetails`, edit header, `UpdateSubscriptionDrawer`, `SubscriptionCancelDialog` | `/contracts/:id`; `SubscriptionDetailView`, information forms and lifecycle dialogs | Source, component, assembly, live UI. Existing lifecycle remains; cancellation invoice option retained. |
| Contract charge additions, overrides, quantities, commitments, windows, end dates | Subscription edit; `SubscriptionEditChargesSection`, `AddSubscriptionChargeDialog`, `SubscriptionLineItemQuantityModifyDialog`, `CommitmentTimeBucketsEditor` | Charges tab; `ContractAddChargeForm`, `ContractUsageEditForm`, `ContractQuantityDialog`, `UsageTermsFields`, shared `ChargeSheet` | Source and component. Existing bucket IDs and prices preserved on window edits. No fake historical Revert. |
| Contract hierarchy and inherited customers | Subscription edit; `SubscriptionEditInheritingCustomersSection` | Overview hierarchy editor | Source, component, live UI. Parent change/clear and child add/remove now exposed after creation. |
| Contract entitlements; shared allowances | `SubscriptionEntitlementsSection`, grant dialog, entitlement override drawers | `ContractBenefitsEditor`, `SpendingAllowancesSection` | Source and component; live UI dialogs. Edit actual sources, not aggregate usage. Reset removes only this contract's override. |
| Contract add-on modification | `SubscriptionAddonsSection`, `AddAddonDialog`, `ConfigureAddonDialog` | `ContractSectionDialogs`, creation add-on configuration | Source and component; live staged removals. One modify call can add and remove together. |
| Contract coupons and taxes | `ApplyCouponDialog`, `RemoveCouponDialog`, tax association dialogs | `ContractSectionDialogs`, charge coupon dialog | Source and component; live coupon dialog. Existing-contract coupons now carry start/end dates and scope. |
| Customers create/edit; billing address, tax treatment, metadata | `/billing/customers`; `CreateCustomerDrawer`, customer details | `/customers/new`, `/customers/:id/edit`; `CustomerForm`, detail sections | Source and live UI. Required identity first; optional billing configuration/address; inline required errors. |
| Customer hierarchy, taxes, cards, provider links | Customer detail association sections | Customer detail, tax section, payment/card dialogs and integration controls | Source; earlier portal/integration audit. Card setup uses hosted provider flows; no new card saved. |
| Features and meters create/edit/clone; alerts | `/product-catalog/features/create-feature`; `AddFeature`, `FeatureDrawer`, alert dialog | `/features/new`, `/:id/edit`; `FeatureForm`, `FeatureCloneDialog`, alert controls | Source and live UI. Type drives meter fields; tags now load beyond 100. |
| Plans create/edit/duplicate; prices, entitlements, grants | `/product-catalog/plan`; `PlanDrawer`, `PlanForm`, `DuplicatePlanDialog` | `/plans/new`, `/:id/edit`, plan detail | Source; shared charge/entitlement component tests. Multi-write creation is not atomic; partial success navigates to saved plan. |
| Charge/price create/edit, override, schedule, pending deletion, history | Plan/add-on/cost-sheet `add-charges`; recurring/usage/tiered forms, `PriceOverrideDialog`, `UpdatePriceDialog`, `UpdatePriceDetailsDrawer` | Shared `ChargeForm`, `PriceOverrideForm`, `ChargeSheet` | Source and contract component tests. Current/upcoming/history labelled separately; only upcoming versions have delete action. |
| Catalogue entitlements create/edit/remove and grant-backed allowances | `AddEntitlementDrawer`, `EditEntitlementDrawer` | `product-catalog/entitlements/EntitlementForm`, grant fields | Source and component. Feature-type conditions retained; contract-only overrides do not rewrite a plan. |
| Credit grants create/edit/end | Credit grant forms, `EditSubscriptionCreditGrantModal` | `CreditGrantForm`, contract grant dialogs | Source and component; live cancellation dialog. Cancellation now asks effective day. |
| Add-on catalogue create/edit; charges and entitlements | `/product-catalog/addons`; `AddonDrawer`, add-charge pages | `/addons/new`, `/:id/edit`, detail sections | Source. Catalogue record first, nested pricing afterward; contract attachment remains a separate operation. |
| Coupons create/edit/archive; redemption limits and cadence | `/product-catalog/coupons`; `CouponDrawer` | `/coupons/new`, `/:id/edit`; coupon forms | Source. Fixed/percentage conditions, redemption interval and repeat count remain distinct from association dates. |
| Wallet create/top-up/debit/terminate; automatic top-up and alerts | Customer wallets; `CreateCustomerWalletModal`, wallet cards/dialogs | `CustomerWalletView`, `CustomerWalletsPage` | Source, prior checkout audit. Free credits, purchased direct/invoiced credits and pay-first checkout retain different payloads. |
| Taxes create/edit/archive and associations | `/billing/taxes`; `TaxDrawer`, association dialogs | `/taxes/new`, `/:id/edit`; `TaxRateForm`, customer/contract tax sections | Source. V1 exposes a fixed-amount option; current backend supports percentage only. V2 correctly offers percentage only. |
| Invoices create/edit/replace; finalize, void, preview/PDF, payment state | Customer invoice `create`, invoice edit/detail; `CreateInvoice`, `EditInvoicePage` | `/invoices/new`, `/:id/edit`; `InvoiceForm`, `InvoiceDetailView` | Source, component, assembly. Financial preview remains server-backed where available; partial refunds now separately labelled. |
| Payments manual record/process; provider payment links | `/billing/payments`, invoice payment actions | `/payments/new`; `PaymentForm`, invoice dialogs | Source. Method controls provider/wallet fields; process-now is explicit. No live payment processed. |
| Credit notes/memos create, process, refund target, void | `/billing/credit-notes`; customer credit note pages | `/credit-memos/new`; `CreditNoteForm`, detail | Source. Selected invoice line IDs and amounts retained; only nonempty credited lines submitted. |
| Provider connect/configure/disconnect; OAuth; sync; entity IDs | `/tools/integrations`; provider drawers and callback | `/integrations`, `/:provider`; connect/manage sheets and entity controls | Source, component, assembly, live mapping display. Zoho gateway editor, RBAC and actual contract IDs corrected. Targeted sync/completion need backend work. |
| Export connections, scheduled export, run now; delete/pause | `/tools/exports/s3`; `S3ConnectionDrawer`, `ExportDrawer`, `ForceRunDrawer`, export management | `/exports/s3`, connection/export details; `ExportForms` | Source. Credentials separate from bucket/task schedule; run range explicit. External delivery not tested. |
| Bulk imports and errors | `/tools/bulk-imports`; `ImportFileDrawer` | `/imports`; `CsvBoxImportButton`, import grid/sheet | Source. V1 drawer offers events/customers/features/prices and CSV/JSON; V2 entry is specifically event CSV. Wider import parity remains open. |
| Usage syncs/workflows execution inspection | `/tools/usage-syncs`, developer workflows | `/usage-syncs`, `/workflows`, detail sheets | Source. Primarily operational inspection; do not invent a creation form for a read-only source. |
| Webhook create/edit/filter, secret, retry/resend | `/developers/webhooks`; `AddEndpointForm` | `/webhooks/new`, `/:id`; `WebhookEndpointForm`, message sheet | Source. URL/description/event subscriptions kept; delivery retries are distinct from endpoint creation. |
| API keys create/revoke; service account create/rename/roles/delete | `/developers/api-keys`, `/developers/service-accounts`; `SecretKeyDrawer`, `ServiceAccountDrawer` | Settings API key/service-account panels | Source. One-time secret reveal and explicit role selection; no credentials created or access expanded. |
| Team invite, role edit, remove; password links | Settings team; `UsersSection`, `EditUserRolesDialog`, `PasswordLinkDialog` | Settings `MembersPanel` | Source. Invite, issued password/link and roles remain separate states. No invitations sent. |
| Environment create/rename/copy/promote | Environment menu; `EnvironmentEditor`, environment copy views | `/environments/new`, environment forms and copy dialog | Source. Sandbox default; production entitlement/upgrade respected; copying is queued and skips existing lookup keys. |
| Tags/groups create/delete; membership | `/product-catalog/groups`; `GroupDrawer` | `/groups/new`, detail and Settings tags | Source. V2 calls groups tags; type fixed at creation; no unsupported group update endpoint invented. |
| Price units create/rename/metadata | `/product-catalog/price-units`; `PriceUnitDrawer` | `/price-units/new`, detail inline edit | Source. Code/symbol/base currency/conversion are creation properties; post-create edit intentionally narrower. |
| Cost sheets create/edit; usage cost charges | `/product-catalog/cost-sheets`; `CostSheetDrawer`, charge pages | `/cost-sheets/new`, `/:id/edit`, shared charges | Source. Detail record and pricing are separate; no new cost arithmetic. |
| Organisation/profile/billing address | Settings team organisation info; `UpdateTenantDrawer` | Settings `ProfilePanel` | Source. Name, billing/support email, phone and address; partial updates, not replacement with an empty object. |
| Invoice numbering/defaults; subscription settings; tax engine | Settings billing configuration sections | Settings invoicing/subscription/tax panels | Source and numbering unit tests. Number preview now uses configured timezone. |
| Billing entities create/edit, numbering and tax IDs | Environment billing-entity configuration | `/settings/billing-entities/new`, `/:id`; `BillingEntityForm` | Source. Two-step creation, immutable identity separated from seller/numbering details. Live transition not tested. |
| Custom currencies/FX; wallet alerts/bonus credits | Settings custom currency/global forex/alerts | Settings currencies, FX, wallet and bonus panels | Source. Decimal conversion factors and settlement currency; no pricing-calculation changes in this patch. |
| Customer portal branding/access and onboarding actions | Settings portal and customer-onboarding tabs | Settings customer experience and onboarding panels | Source and prior portal audit. Ordered wallet/contract/feature actions; inherited settings preserved. |
| Appearance, SAML configuration and authentication | Settings appearance/SAML; login/signup/reset/set-password/SAML/OAuth; tenant onboarding | Settings appearance, auth forms/SAML sign-in, invitation and onboarding screens | Inventory/source. SAML sign-in is not proof of organisation-level SAML setup parity; full configuration comparison remains open. |
| Self-billing/upgrade/checkout | Settings billing and checkout routes | `/settings/usage-billing`, `/billing/checkout`, go-live flow | Source and prior checkout audit. Entitlement gating and hosted checkout remain; no purchase completed. |
| Pricing widget and customer portal self-service | Pricing widget, `/customer-portal`, checkout | `/pricing-widget`, customer portal surface | Source and prior audit. Separate product surfaces, not interchangeable with console CRUD forms. |

No unseen V1 workflow should be inferred to be absent solely because a filename did not match `Form` or `Drawer`: routes, nested dialogs and settings panels were included in discovery. The table is an inventory with explicit verification limits, not a claim that every listed branch was submitted end-to-end.

## 2. Field and workflow comparison

### Contracts: create and review

| Field family | V1 capability | V2 behavior after this patch | Validation, request and save semantics |
| --- | --- | --- | --- |
| Customer and plan | Search, customer-scoped creation, inherited customers and plan defaults | Customer first; plan appears after selection. Selected plan supplies charges, cadence, currency, trial and benefits. | Complete paged catalogue; IDs, not labels, submitted. Existing customer/contract association restrictions retained. |
| Start/end and billing | Start day, optional end/trial/anchor, anniversary/calendar billing | Dates/billing stay together; advanced collection, invoicing and FX remain later in flow. | End after start; hidden custom anchor cleared when billing choice changes. Existing date-to-instant mapper retained. |
| Charges | Fixed/usage, flat/package/tiered, quantities, unit, timing, cadence and overrides | Shared charge editors reused; plan defaults and contract overrides labelled; add-ons can be independently configured. | Conditional meter controls; decimal strings preserved; usage and fixed quantity have different meaning. |
| Discounts | Contract and charge scope, fixed/percentage | Scope and coupon selection remain separate. | Coupon association sends the selected scope only; replacing a scoped coupon preserves chosen dates. |
| Commitments | Amount/quantity, duration, overage, true-up, time windows/buckets | Contract commitment and per-charge commitments remain distinct. Existing usage windows are editable. | Positive values, overage ≥1, whole quantities, valid time boundaries and overlap checks. Overnight windows split for overlap validation. |
| Entitlements | Plan defaults, feature-type values, grant-based limits and overrides | Inherited and contract-only sources distinguished; add/edit/reset available. | Inherited edit creates a SUBSCRIPTION override with parent entitlement ID. Reset deletes only own override. |
| Shared spending allowance | Featureless allowance shared by usage charges | Amount, duration/every, allocation, stacking and optional start/end; shown on review. | Positive decimal amount, valid interval/dates; `subscription_entitlement_grants` in create request. Existing allowance edits change only supported quota fields. |
| Credit grants | One-time/recurring, expiry, priority, start | Grant editor retained; explicit cancellation effective day on details. | Existing credit-grant mapper; cancellation sends `effective_date`, not a silently invented timestamp. |
| Review and draft | Save draft and create with full setup | Five-step review remains; search/validation improvements do not collapse business options. | Save as draft uses existing draft path. Close/breadcrumb now confirm if dirty. Browser refresh/sidebar navigation are not globally guarded. |

### Other field-level observations

| Flow | Order, defaults and conditions inspected | Request/save/error behavior and UX finding |
| --- | --- | --- |
| Customer | Name/external ID/email → billing entity when enabled, tax treatment/currency/timezone → optional address. Taxable default; currency may remain empty. | `toCreateCustomerRequest`/`toUpdateCustomerRequest`; country/state constraints and trimmed required identity. Live empty submit produced Name and External ID errors beside inputs. V2 leaves external ID blank rather than V1's `cust-` seed. |
| Feature/meter | Name/type first. V2 defaults metered; V1 begins without a selected type. Metered reveals event/filter/aggregation/field-or-expression, multiplier/grouping, units; Boolean/static/config suppress meter fields. | `toCreateFeatureRequest` nests meter in feature create. Edit mapper sends only mutable attributes. V2 chooses plural-unit defaults; explicit plural editing differs from V1 and needs a product decision if irregular names must be edited independently. |
| Plan | Details then prices/entitlements/grants. Tier/package/meter controls depend on charge type. | Plan creation plus nested requests are sequential. On partial completion, already-created plan is retained and opened; this is not an atomic transaction. Further retry/resume UX should name which nested item failed. |
| Add-on and cost sheet | Name/description/lookup key; prices managed on detail with shared forms. | Create/update the owning record separately from prices. No broad replacement payload or catalogue mutation from a contract override. |
| Charge/price | Type/meter/model before model-specific amount/package/tiers; billing timing/cadence, price unit, dates and terms. | Existing shared pricing mapper remains the source of arithmetic semantics. Editing a window does not submit a replacement price unless the price changed. Pending price deletion uses its endpoint; historical restore is not invented. |
| Entitlement | Feature selection determines enabled/static/config/finite/unlimited/grant controls. | `toUpdateEntitlementRequest` shared; aggregate usage is read-only. Unlimited editing enabled narrowly for the contract editor. Empty/error source states remain distinct. |
| Coupon | Name/code/type → amount+currency or percentage → once/repeated/forever and repetition count → redemption dates/limit/metadata. | Create mapper preserves cadence and redemption constraints. Catalogue redemption interval is not a substitute for contract-association dates. Editing does not silently change financial type. |
| Tax | Name/code/percentage/description; edit identity/status/description. | Backend `internal/types/taxrate.go` and DTO explicitly reject non-percentage types. V1's fixed option is not a safe frontend parity target. Financial rate remains immutable after creation. |
| Invoice | Customer → parties/dates/currency → lines/taxes → status/payment and notes. | `toCreateInvoiceRequest` sends ONE_OFF/MANUAL, decimal totals/amountDue, selected taxes and line periods. Draft/finalize explicit. Editing finalized invoices uses the existing replacement flow; no new lifecycle semantics. |
| Payment | Invoice, currency/amount, method; wallet/provider controls conditional; Process now explicit. | `toRecordPaymentRequest`; provider payment link response handled separately. Success does not imply external settlement unless returned state says so. |
| Credit memo | Invoice and reason → selected invoice-line amounts → memo/refund target/process now. | `toCreateCreditNoteRequest` omits unselected empty lines, keeps invoice line IDs. Refund target is not inferred from a displayed status badge. |
| Wallet | Create type/currency/conversion/description/initial credits; top-up free vs purchased then invoice/checkout/expiry/reference; auto-top-up threshold and amount. | `toCreateWalletRequest`, `toTopUpRequest`, `toUpdateAutoTopupRequest`. Checkout response means pending payment, not loaded credit. Existing card may be reused; this patch does not send another setup request. |
| Integration | Provider credentials/OAuth → scopes/sync settings → save/manage. Zoho now adds explicit invoice gateway configuration; QuickBooks new mode defaults by environment. | Existing opaque sync settings survive gateway edits. Connection writes use connection permission; entity mapping/sync writes use integration permission. Queue acceptance labelled queued. |
| Export | Connection credentials first; task data/schedule/bucket/region/prefix/compression/encryption/metadata; manual run has date/time range. | Separate connection/task/run operations; long-running run status not confused with successful creation. Provider delivery is unverified. |
| Imports | V1 entity and CSV/JSON choices versus V2 event CSV wizard. | V2 CSVBox validates/uploads then schedules import. This is a functional breadth difference, not a reason to display unsupported import options. |
| Webhook | URL, description, selected events; message retry separately. | Shared endpoint form and query hooks. URL validation, pending/error feedback; no real endpoint created in this batch. |
| Environment | Name/kind (sandbox default), entitlement/upgrade for production; rename separate; copy existing target/new sandbox. | Copy is asynchronous, excludes customers/contracts/invoices/balances and skips existing lookup keys. UI explains that repeat copy does not update prior copies. |
| Price unit/tag | Unit name/code/symbol/base currency/rate; tag name/lookup key/type. | Unit's post-create mutable subset is narrower; groups have no verified update route. Picker options now page through published tags by server-side entity type. |
| Team/API/service accounts | Invite email/name/roles; API name/expiry/type and one-time secret; service account name/roles then rename/edit. | Role choices and secret reveal are sensitive, intentionally not live-tested. No new universal form layout or permission bypass added. |
| Organisation/settings | Profile contact/address; numbering/timezone; currency factors/settlement; alerts; ordered onboarding actions and conditional wallet/contract/feature options. | Existing settings mappers retain their scope. Numbering preview now formats in configured timezone and explicitly reports unsupported zones. It remains an example sequence, not reserved next invoice number. |

## 3. Contract Details UX review

### Header, overview and billing

The existing `DetailShell` supplies breadcrumbs, title, status, copyable ID and one overflow menu. Tabs separate Overview, Charges, Usage, Invoices and Information; revenue/journal tabs remain conditional. Information contains contract/billing configuration and metadata rather than repeating every field above the fold. Customer/plan navigation and dates retain context. Lifecycle banners distinguish future, trial, paused, cancelling and cancelled states.

This patch does not rearrange financial data arbitrarily. Instead, it makes missing actions available where users encounter their data: hierarchy in customer associations, entitlement edit/reset at each contributing source, and shared allowances in a dedicated section. Section actions stay in their headers. Permission/read-only states suppress writes; cancelled contracts remain read-only.

### Charges, active versions and history

The charge model retains all line versions. Current/upcoming/history badges and start/end dates in the shared sheet establish which version is effective; ended versions remain inspectable. Overview has a bounded preview and Charges provides the complete view. A commitment opens the same charge's terms rather than a disconnected editor.

The explicit changes are window editing and safer serialization: preserve existing bucket IDs; omit bucket replacement price; preserve base price on terms-only edits; send an explicit empty bucket list when clearing windows. New windows receive the selected charge price in SUBSCRIPTION scope with its contract ID. Zero base commitment is valid when nonzero windows define the commitment. Overnight overlaps are validated.

**Revert:** no historical Revert action is currently wired in V2. `lineRevertDraft` is unused; wiring it would create a new version with a current date, which would violate the requested restoration behavior. Existing “Delete upcoming price” cancels a pending version. Historical restore needs a defined effective-date/history contract and is recorded as open, not simulated.

### Commitments, benefits, inheritance and activity

Amount/quantity, period/window, true-up and overage stay separate. No commitment consumption/balance is fabricated from configured amounts: authoritative consumption/history requires server data.

Entitlement aggregate usage remains a read view. Editable source rows name where their values came from; inherited edits become contract overrides. A reset confirmation restores inheritance by removing only that override. Featureless monetary allowances are shown separately, so they cannot be mistaken for feature limits or wallet credit grants.

Parent clear/change and inherited-customer add/remove now have contextual dialogs. Eligibility still rejects self/duplicates/existing conflicting associations. Parent change is blocked while inherited children exist, with an explanation, rather than sending a conflicting hierarchy request.

The existing Activity feed shows available audit events. It is not a complete diff ledger for every nested mutation; missing event details, precise before/after values and provider completion should remain absent unless the backend supplies them.

## 4. Creation, addition and editing improvements

- Five steps remain: Contract → Charges & add-ons → Commitments & benefits → Billing → Review. Customer precedes plan; complex optional configuration stays in its relevant step.
- Complete catalogue loaders fetch bounded pages. A partial page failure is an error, not an empty or deceptively complete set. Customer, plan, coupon, feature and unit selections can reach records after the first hundred; add-on/tax fetches use their complete scanner. Feature and price tags now also page by type.
- Tax additions use a searchable combobox; customer tax defaults remain present, with an add-another control.
- Close and external breadcrumb actions on a dirty contract configuration now ask “Discard this contract?” and offer Keep editing. Clean exit remains immediate. This narrow protection does not intercept all router/browser/environment changes; global protection remains a separate follow-up.
- Addition does not require recreating the whole contract. Charge additions, commitment/window edits, source entitlement changes, dated coupons and effective grant cancellation use their own mutations.
- Add-on changes stage existing association removals and configured additions together, then send one `addon_bulk_params` modification. Existing catalogue prices, quantities, overrides and commitments remain configurable; Apply is disabled until there is a net staged change.
- Submission/loading/errors remain attached to their form/dialog; failed operations keep the dialog open. No frontend success claims for asynchronous external completion.

## 5. Prioritized issues and disposition

| Priority | Issue | Disposition |
| --- | --- | --- |
| P1 | Contract rows showed customer integration IDs as if they belonged to the contract | Fixed: subscription-scoped mappings and Contract ID label. Empty actual mappings remain empty. |
| P1 | Inherited entitlement edits could target catalogue data or aggregated values | Fixed: source-based contract override/edit/reset, scope guard on delete. |
| P1 | Existing time windows could not be changed safely | Fixed: preserve bucket identity and prices, explicit clear, validation and serialization tests. |
| P1 | Shared usage spending allowance missing | Implemented create/detail support using backend entitlement grant fields. Live consumption/persistence still unverified. |
| P1 | Parent/inherited customers immutable in UI after create | Implemented contextual amendments with eligibility restrictions. Live mutation remains unverified. |
| P1 | Coupon schedule, combined add-on changes, effective grant cancellation missing | Implemented through existing modify/delete contracts, with selected dates/association IDs. |
| P1 | Integration write controls not differentiated by role | Fixed UI gates for connection versus integration writes; backend enforcement still authoritative. |
| P2 | Silent 100-item picker truncation | Fixed for contract catalogues, shared charge/feature/unit/tag pickers. Other independent settings pickers still need a pagination audit. |
| P2 | Dirty contract lost on close/breadcrumb | Fixed with kit confirmation; router-wide protection remains open. |
| P2 | Zoho gateways not editable; nested settings could be lost | Implemented nested editor and merge preserving unrelated settings. Provider acceptance not live-tested. |
| P2 | Partial refund displayed as full refund; numbering preview used wrong date boundary | Fixed independent partial-refund state and timezone-aware formatting with DST/year-boundary tests. |
| P2 | Queued sync reported like completed sync | Copy fixed. Correlated completion tracking requires backend result/job contract. |
| P2 | Plan create can partially succeed across nested requests | Existing safeguard retained; finer resumable progress and failed-item navigation not implemented. |
| P2 | Wider bulk import breadth missing | Documented functional gap: V2 event CSV does not replace every V1 import entity/format. |
| P3 | App-wide unsaved protection, irregular plural editing, all secondary picker pagination, exhaustive small-screen validation | Follow-up UX work; no unsupported fields or universal form abstraction invented. |

## 6. Implementation file map

| Module | Previous behavior → new behavior | Principal files |
| --- | --- | --- |
| Allowances | Missing → validated shared usage monetary grants in create and details | `packages/domain/src/spendingAllowance.ts`; `packages/ui/src/pages/contracts/SpendingAllowancesSection.tsx`; `ContractBenefitsEditor.tsx`; `packages/query/src/subscriptions.ts` |
| Benefits | Read aggregate only → source edit/override/reset | `packages/query/src/contractBenefits.ts`, `entitlements.ts`; `packages/domain/src/entitlement.ts`; `ContractBenefitsEditor.tsx`; shared `EntitlementForm.tsx` |
| Hierarchy | Create-time only → post-create contextual associations | `ContractHierarchyEditor.tsx`; `apps/console/src/pages/subscriptions/SubscriptionDetailPage.tsx`; query subscription mutations |
| Charge terms | Existing windows effectively read-only → editable/preserved IDs and correct new-window scope | `UsageTermsFields.tsx`, `ContractUsageEditForm.tsx`; domain `contractCharge.ts`; query `subscriptions.ts` |
| Add-ons/coupons/grants | Separate/incomplete operations → staged combined change and explicit effective dates | `ContractSectionDialogs.tsx`, `SubscriptionDetailView.tsx`; domain `subscription.ts`; query `subscriptions.ts` |
| Creation | Capped options/nonsearchable tax/unguarded exit → complete search and confirmation | `contractPickers.ts`, `groups.ts`; `SubscriptionFormPage.tsx`, `planFormOptions.ts`, `FeatureFormPage.tsx`; `SubscriptionForm.tsx` |
| Integration mapping/RBAC | Customer IDs and broad write controls → correct contract entity and resource gates | `entityIntegrationLinks.ts`, `ContractIntegrations.tsx`, `ConnectorCard.tsx`, integration sheets/block, `useIntegrationSheets.tsx` |
| Zoho/QuickBooks | Gateways unavailable; default sandbox → gateway editor with preserved nested config; env-based new QB default | `ZohoGatewayFields.tsx`; domain `integrationConnect.ts`; query `integrations.ts`; connect/manage sheets |
| Invoice mapping/preview | Partial collapsed; timezone ignored → distinct partial state and configured-zone example | domain `payment.ts`, `settings/invoiceConfig.ts`; query `payments.ts`; `invoiceDocument.ts`, `InvoiceDetailView.tsx`, status tones |
| Async feedback | Ambiguous sync success → explicitly queued | Invoice/customer detail page mutation feedback |

New reusable parts have colocated stories. No UI dependency, theme, stylesheet or vendored component was added. Business arithmetic, lifecycle endpoints, V1 and backend remain unchanged. The mapper changes above restore already-supported fields and fix concrete identity/serialization bugs.

## 7. Remaining gaps, dependencies and decisions

### Backend contracts or product decisions

1. **Push to one provider:** existing IntegrationSyncRequest has entity type/ID, method and resync, but no provider or connection selector. Do not expose a provider picker that still broadcasts.
2. **Queued completion:** sync acceptance returns a message without a correlated job ID/result. Polling unrelated timestamps cannot establish that this requested sync finished.
3. **Historical price restoration:** define whether restore cancels a pending version or establishes a new effective version and what dates/audit history must result. Current UI supports pending deletion, not historical Revert.
4. **QuickBooks mode:** new default follows environment; mode remains editable. Whether to enforce environment permanently is a product/backend decision; existing connection modes are not silently rewritten.
5. **Fixed-amount tax:** current backend explicitly supports only percentage. V1's option is not evidence of backend acceptance.
6. **Complete nested audit/commitment consumption:** requires authoritative event/usage data. UI does not infer financial balances from configured quota.
7. **Organisation-level SAML setup and broad imports:** source inventory found differences; full configuration/import transport work is outside the confirmed safe fixes in this patch.

### Frontend validation and UX follow-up

- Live API create/read-back/edit/reset for every new amendment, including interactions between parent and inherited contracts.
- Provider OAuth and gateway configuration round-trip; accounting sync, error reconciliation and every role combination.
- Global unsaved-change guard, environment switch/refresh handling and consistent treatment across other long forms.
- Server-driven or incremental search for very large catalogues. Current complete bounded paging fixes reachability but still downloads the whole option set.
- Independent settings pickers, including onboarding plan choices and tag management, should be checked for their own caps.
- Recovery UI for partially-created plans, without replaying successful nested writes.
- Full viewport matrix for long tiers, window tables and every secondary configuration form; current screenshot evidence is desktop, not a mobile certification.

## 8. Verification record

### Executed successfully

- Domain unit suite: 623 tests in 54 files, confirmed in final run.
- Query unit suite: 719 tests in 63 files, confirmed in final run including SDK serialization and paging.
- Console unit suite: 627 tests in 70 files, confirmed in final run (Nx cache replay for this unchanged suite).
- UI unit project: 83 tests in 13 files.
- Focused new/changed component stories: 35 tests in 8 files (`SpendingAllowancesSection`, `ContractBenefitsEditor`, `ContractHierarchyEditor`, `ContractChargeDialog`, `ContractIntegrations`, Zoho fields and both connection sheets).
- Main flow component stories: 204 tests in 5 files (contract details/create, invoice details, entitlement forms, integrations block).
- Contract form including new discard-protection story: 60 tests in 1 file. Keeping editing preserves the selected customer; discard invokes cancellation once.
- Additional benefit/hierarchy component regression run: 7 tests in 2 files, including override identity on reset and external customer ID on association.
- Final static checks passed for all four changed projects; final story/E2E additions also passed UI/console typecheck and lint. Console production build passed, with existing chunk-size warnings. Vendor integrity, SDK operations/cast baseline, page matrix and Storybook anatomy checks passed. Generated page/anatomy maps were refreshed.
- Mocked assembled-app journeys: **10/10**, `subscription-create`, `subscription-detail`, `entity-integrations`, `invoice-actions`, one Chromium worker and isolated `https://api.flexprice.test/v1` origin. A final contract-only run passed **3/3**, including the added 390px keep-editing journey and desktop breadcrumb discard (11 unique passing journeys across these runs).

Commands:

```sh
pnpm nx run-many -t typecheck lint -p @fp/domain @fp/query @fp/ui console
pnpm nx run-many -t test -p @fp/domain @fp/query console
pnpm nx run @fp/ui:test -- --project=unit
pnpm nx run @fp/ui:test -- --project=storybook <affected story files>
env -u E2E_BASE_URL -u E2E_LIVE -u VITE_API_KEY -u VITE_FLEXPRICE_API_KEY \
  NX_LOAD_DOT_ENV_FILES=false E2E_PORT=4329 \
  VITE_FLEXPRICE_API_URL=https://api.flexprice.test/v1 \
  pnpm nx run console:test:e2e -- e2e/subscription-create.spec.ts \
  e2e/subscription-detail.spec.ts e2e/entity-integrations.spec.ts \
  e2e/invoice-actions.spec.ts --workers=1
pnpm nx run console:build
```

### Failures and limits retained in the record

- First E2E invocation inherited an empty base URL and failed navigation for all ten. Re-run disabled Nx dotenv loading.
- Five-worker run then passed six and failed four at initial access/loading or early form assertions; it also logged an uncovered revenue-recognition settings GET (404). The isolated mock-origin/one-worker run passed all ten. This does not establish that the parallel cold-start issue is fixed.
- One prior component assertion expected text content on what is now a searchable input. Updated it to assert its placeholder, then all five affected story files passed.
- First static pass after the new guard found a test-only `exact` option unsupported by Testing Library. Replaced it with an anchored role-name regex.
- The all-story sweep was interrupted after prolonged execution. **No complete UI story-suite pass is claimed.** Focused component coverage and the UI unit suite are the executed evidence.
- The first narrow-screen test tried to use an intermediate breadcrumb that the shell intentionally hides at that width. The corrected journey verifies retention at 390px, then changes to desktop width before checking breadcrumb exit; all three contract journeys passed.
- React's pre-existing script-tag warning appears in the mocked E2E app; it was not suppressed or treated as a passing assertion.
- No new live billing mutation, provider write, payment, credential creation or permanent deletion was submitted. The new amendment batch is not live-API certified.

### Rendered UI evidence

Both V1 and V2 were opened concurrently against Harshit's home. Live browser checks included customer required errors, metered versus Boolean fields, contract customer selection, dirty exit confirmation, combined add-on staging, source/allowance empty states, coupon date fields, hierarchy and credit-grant end-date dialog. Existing multi-charge/inherited-customer contract was inspected without mutation.

- [Combined add-on changes](./audit-evidence/implemented-contracts/combined-addons.png)
- [Credit-grant effective date](./audit-evidence/implemented-contracts/credit-grant-effective-date.png)
- [Unsaved contract confirmation](./audit-evidence/implemented-contracts/unsaved-contract-confirmation.png)

The first spending-allowance screenshot predates a small validation-message clearing fix; it is not used as proof of the final validation state.

## Result

The confirmed amendment and mapping gaps have concrete V2 implementations and focused regression evidence. The wider route/field review identifies safe existing differences and outstanding functional work without hiding it behind a blanket parity claim. Live persistence, provider completion, secondary configuration depth and exhaustive viewport/role coverage remain explicit release-validation work.
