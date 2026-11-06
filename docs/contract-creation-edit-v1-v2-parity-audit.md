# V1 Subscription vs V2 Contract Creation, Addition and Editing Audit

Audit date: 5 November 2026 (Asia/Kolkata). Application source was not changed. This document and browser evidence are the deliverables.

## 1. Executive summary

V2 covers the principal contract-creation flow, including plan pricing overrides, multiple add-ons, editable plan credit grants, contract and per-charge commitments, phases, billing configuration, and creation-time customer inheritance. Existing-contract editing is narrower. The strongest migration gaps are aggregate subscription allowances, add-on quantities, post-creation inheritance management, existing entitlement editing, and time-window commitment editing.

This audit records **69 comparison units**: **37 Complete**, **14 Partial**, **9 Missing**, **1 Broken**, **8 Not Verified**, **0 proven Backend Blocked**, and **0 proven Intentional Removal**. There are 60 units with a corresponding V2 surface, partial path, or investigation result; that is **not** a count of fully migrated capabilities. These counts are calculated from the numbered matrix below, not estimated from component names. They describe the inspected frontend scope, not every capability of the backend or a claim of production readiness.

“Complete” means equivalent frontend capability and request mapping were established by source and, where specified, browser/tests. It does **not** certify a new write followed by reload. Persisted mutation isolation, financial calculation equivalence and propagation remain separate Not Verified rows. “Broken” is used for an internally demonstrable request-construction defect, with backend outcome explicitly distinguished.

### User-reported gaps, deduplicated

| Report | Current finding |
|---|---|
| Credit grant start date missing | Reproduced for **adding a one-time grant to an existing contract**. V1 has a required picker; V2 uses now. Neither initial-create modal exposes start date. |
| Add entitlement missing on create | Reproduced. V1’s Add Subscription Entitlement creates an aggregate monetary allowance across usage lines. V2 only overrides plan feature entitlements during creation. Its later Add entitlement creates a feature entitlement and is not equivalent. |
| Multiple add-ons missing on create | Not reproduced. Staged Storage and Analytics together; Review displays both. V1 batches choices in one dialog; V2 adds them sequentially. Existing-contract V2 dialog also supports multiple additions. |
| Add-ons cannot be customized | Too broad: Storage price override80→90 worked in the staged form. Missing fixed-charge quantities and narrower modification support remain real gaps. |
| Override row menu differs | Plan rows retain Override/Commitment/Coupon after a price override. **Extra custom charge** rows instead show Edit/Remove. The distinction is row provenance, not simply whether the price was overridden. |
| Quantity missing in override | Fixed plan quantity lives in the table; extra fixed quantity lives in Edit charge. Usage quantity is intentionally absent. Fixed **add-on** quantity is missing. |
| Generate invoice missing in cancellation | Not reproduced in current detail UI. Choose Immediately; Raise a final invoice now appears. Default end-of-period selection hides it. No cancellation was submitted. |
| Invoice badge wrong mapping | Sampled Open/Pending, Overdue/Pending and Paid/Succeeded combinations render consistently with current derivation. There is a concrete fallback risk when amountRemaining is absent; the user’s exact bad record was not identified. |

### Execution evidence and limits

B1 denotes the V1 browser; B2 denotes the V2 browser. Two local browser tabs were exercised in parallel with real development API data, not V2 mocks: V1 localhost:4316 and V2 localhost:4317. Both used Acme → Harshit’s home, environment `env_01M1DQKFMP700552AXFSWFJ032`. Creation used PUP Acme1792753923 (`cust_01M5M7C1WFQ91X66D56S7YVRY0`) and Usage properties test1792753923 (`plan_01M5M7BXZ11SY03B7FXPP14GQR`). Existing-record comparisons used Grp Parent1791813398, subscription `subs_01M4R6DCJHKBARJ9TKKRWZ5NKC`, with Grp Child1791813398 visible in both.

V1 revision: `870d8ca7ecbbbe670789171de4c158afc1337646`. V2 revision: `8b3c77762619d4f47dd7df90604dbbd10090ba9a`. Existing untracked customer-portal audit artifacts are unrelated to this report. V1’s server used a temporary process-level region-selection setting to keep local login on the development service; no environment file was edited.

Browser work changed only in-memory form drafts and navigation. No contract was created, cancelled, repriced, detached, or otherwise saved by this audit. Existing persisted records were read, but their creation history is not attributed to this audit. Backend source was not available. SDK support shows a representable request, not proof that the deployed backend accepts every combination.

Targeted existing tests passed: query104, domain55, UI20, total **179 tests /14 files**. Commands and their scope appear in section7. No new tests or application fixes were written.

Browser evidence:

- [V1 initial grant](audit-evidence/contracts/v1-credit-grant.png) and [V2 initial grant](audit-evidence/contracts/v2-credit-grant.png).
- [V1 existing grant start picker](audit-evidence/contracts/v1-existing-grant-start.png) and [V2 existing grant without start picker](audit-evidence/contracts/v2-existing-grant-no-start.png).
- [V2 immediate cancellation final-invoice switch](audit-evidence/contracts/v2-cancel-final-invoice.png).
- [V2 creation-time UTC commitment windows](audit-evidence/contracts/v2-create-time-windows.png).
- [V2 Review with two staged add-ons](audit-evidence/contracts/v2-review-two-addons.png); [review DOM evidence](audit-evidence/contracts/v2-review.txt), [V1 existing edit inventory](audit-evidence/contracts/v1-existing-edit.txt), [V2 existing charges inventory](audit-evidence/contracts/v2-existing-charges.txt).

## 2. V1 subscription workflow inventory

Repository root: `/Users/dinesh/src-code/flexprice-front`.

| Entry point / module | Implementation and responsibility |
|---|---|
| Global create `/billing/subscriptions/create` and customer-scoped create | [CreateCustomerSubscriptionPage][v1c] loads catalogues, defaults and taxes; sanitizes dates, phases, custom lines, overrides, commitments, credits, allowances, add-ons, hierarchy and the create payload. |
| Subscription detail `/billing/customers/:customer_id/subscription/:subscription_id` | `src/pages/customer/customers/CustomerSubscriptionDetailsPage.tsx`: lifecycle actions, stored billing configuration, invoice preview, charges, integrations and inherited rows. |
| Edit route with `/edit` suffix | [CustomerSubscriptionEditPage][v1e] wires per-section queries/mutations. There is no universal replacement save; individual sections mutate independently. |
| Creation form | `src/components/organisms/Subscription/SubscriptionForm.tsx`, `SubscriptionWithOverrides.tsx`, `SubscriptionPriceTable.tsx`, `AdditionalPlanPricesSection.tsx`, `PhaseForm.tsx`/`PhaseList.tsx`: plan/custom prices, additional cadences, grouping, quantity, dates and phase-specific discounts. |
| Charge edits | `src/components/molecules/Subscription/SubscriptionEditChargesSection.tsx` queries paged active lines; `SubscriptionLineItemTable/SubscriptionLineItemTable.tsx` chooses fixed modification versus usage override; [PriceOverrideDialog][v1o] builds difference-aware price updates. |
| Fixed quantity/price change | `src/components/molecules/Subscription/SubscriptionLineItemQuantityModifyDialog.tsx`, `src/utils/subscription/buildLineItemChangeModifyRequest.ts`, `lineItemPriceEdit.ts`: preview/execute and eligible flat-price restrictions. |
| Custom charges and commitments | `src/components/organisms/Subscription/AddSubscriptionChargeDialog.tsx`; commitment dialogs/editors; [subscription_line_item_commitment_helpers][v1b] hydrates stored window prices, preserves unchanged bucket IDs and serializes updates; [commitment_helpers][v1bv] validates amounts and bucket-dependent boundaries. |
| Add-ons | [AddAddonDialog][v1a], sibling `AddonDraftCard.tsx`, `ConfigureAddonDialog.tsx`, `ExistingAddonRow.tsx` and `SubscriptionAddonsSection.tsx`: staged additions/removals, pricing, quantity and usage commitment configuration. |
| Credit grants | Initial `CreditGrant/CreditGrantModal.tsx`; existing [EditSubscriptionCreditGrantModal][v1g]; `CancelCreditGrantModal.tsx` and edit section: start-date and cancellation differences matter between entry points. |
| Entitlements | [SubscriptionEntitlementsSection][v1ent], `SubscriptionEntitlementGrantDialog.tsx`, `EditSubscriptionEntitlementDrawer`: aggregate allowances and feature entitlements are distinct. Source-aware reset/delete and existing aggregate-grant rows are supported. |
| Coupons | [SubscriptionCoupon][v1coupon] filters currency/redemption eligibility for creation; edit Apply Coupon dialog carries scope, optional dates and coupon association actions. |
| Inheritance | [SubscriptionEditInheritingCustomersSection][v1i] adds external customer IDs through modify execute; [UpdateSubscriptionDrawer][v1u] changes parent subscription through PUT. The drawer is limited to parent selection, not arbitrary contract details. |
| API boundary | [SubscriptionApi][v1api], `src/types/dto/Subscription.ts`, `CreditGrant.ts`, `Entitlement.ts` and `src/utils/subscription/*`: snake_case HTTP bodies, direct Axios calls and React Query invalidation. |

V1 creation can configure more than its plan: bespoke lines, price overrides, fixed quantity, per-line coupons, add-ons, aggregate allowances and inherited customers. It does not establish a general multi-plan contract editor merely because change/preview APIs exist. Nor does the inspected V1 creation page establish an unsaved-contract financial preview.

## 3. V2 contract workflow inventory

Repository root: `/Users/dinesh/src-code/portal`. A “contract” remains a subscription resource at the API boundary. Renaming has not introduced a separate `/contracts` backend entity.

| Layer / entry point | Implementation and responsibility |
|---|---|
| `/contracts/new`, customer-scoped form | [SubscriptionFormPage][v2p] and `apps/console/src/pages/subscriptions/CustomerSubscriptionFormPage.tsx`: query hooks, selected customer, catalogues, plan charges/default entitlements/grants, taxes, FX and hierarchy blockers. |
| Five-step presentation | [SubscriptionForm][form]: Contract; Charges & add-ons; Commitments & benefits; Billing; Review. Later step buttons are disabled until reached, not permanently unavailable. Review was reached successfully. |
| Form schema | [domain subscription][ds]: phases, price IDs, quantities, chargeCommitments, feature entitlement overrides, credit grants, taxes, FX, add-ons and inheritance. It has no aggregate subscription allowance or invoice-grouping field. |
| Create mapper | [query subscriptions][q] `toCreateSubscriptionRequest`: maps to SDK camelCase models; SDK outbound schemas produce snake_case. Phased and single-phase payload paths differ. |
| Existing `/contracts/:id` | [SubscriptionDetailPage][dp] wires lifecycle, lines/history, usage, invoices, section additions, tax/FX, metadata and integrations. [SubscriptionDetailView][detail] displays Overview, Charges, Invoices and Information; Usage is conditional on data. |
| Add to existing contract | No monolithic Add to Contract transaction: Add charge, Add add-on, Add credit grant, Add entitlement, Add coupon and Add tax each have separate draft and endpoint. [ContractSectionDialogs][sections] owns five section dialogs. |
| Add/edit/end charge | [ContractAddChargeForm][add], [ContractUsageEditForm][edit], `ContractChargeDialog.tsx`, [UsageTermsFields][ut]. Existing fixed charges use [ContractQuantityDialog][qty] and modify preview/execute. |
| Creation-time commitments | [ChargeCommitmentDialog][cc] supports bucket size, amount/quantity minimum, period, overage, true-up, per-bucket flag and UTC windows. It differs substantially from UsageTermsFields used for existing charges. |
| Add-on customization | `AddonChargesDialog` in [SubscriptionForm][form] is reused by [ContractSectionDialogs][sections]; price overrides and commitments are present, fixed quantity is not modeled. |
| Credits and entitlements | [CreditGrantForm][gf]; entitlement create form under `packages/ui/src/pages/product-catalog/entitlements/EntitlementForm.tsx`. Existing feature entitlement add is wired; existing entitlement edit/reset is not. |
| Read models / history | [query subscriptions][q] `toSubscriptionDetail`, `toSubscriptionLine`, `useSubscriptionLineHistory`, `useSubscriptionLineVersions`; [invoice mapper][im] derives domain invoice status via [invoice domain][id]. |

The “Edit contract” action is documented in source as opening the Charges tab. That redesign explains navigation, but does not establish product approval to remove V1 parent updates, inherited-customer additions, allowance grants or entitlement reset operations. No such removal was counted intentional.

## 4. Detailed parity matrix

Evidence is source-backed unless a browser or test is named. The numbered comparison units are the denominator used in section1.

| # | Module | Feature | V1 behavior | V2 behavior | Status | Evidence | Required action |
|---|---|---|---|---|---|---|---|
| 1 | Customer | Existing customer selection | Customer picker; customer-specific route locks customer | Same two entry points and selected-customer lookup | Complete | [V1 create][v1c], [V2 form page][v2p]; browser same PUP Acme | Retain selected-customer lookup |
| 2 | Customer | Search across a large catalogue | Published plan/add-on/coupon requests limit 1000; customer search component | Form-page picker requests page 1 size 100; selected customer fetched separately | Partial | [V1 create][v1c], [V2 form page][v2p] PICKER_PAGE | Add server search/pagination; test records beyond first 100 |
| 3 | Customer | Environment consistency | Session environment scopes API | Environment in session and URL; same sandbox visibly selected | Complete | Browser B1/B2; [V2 form page][v2p] | Keep environment-scoped query keys |
| 4 | Customer | Create inherited-customer associations | External IDs in inheritance payload | Inherited-customer picker and external IDs in same wire model | Complete | [V1 create][v1c], [V2 requests][q] toCreateSubscriptionRequest | Run persisted hierarchy scenarios |
| 5 | Customer | Creation conflict guards | Customer exclusion and backend errors | Own-contract/other-parent checks plus incompatible hierarchy combinations | Complete | [V2 requests][q] useInheritanceBlocks; [schema][ds] | Verify races against server |
| 6 | Customer | View inherited contracts | Parent lists child subscription rows | Same parent and child visible; inherited record is read-only | Complete | Browser Grp Parent → Grp Child; [detail][detail] | Verify propagation separately |
| 7 | Customer | Add inherited customers after creation | Modify execute type inheritance | Existing detail only lists inherited contracts; no attach callback | Missing | [V1 inheritance][v1i], [detail page][dp] | Add attach flow through modify endpoint |
| 8 | Customer | Change or detach parent after creation | Update drawer PUT parent_subscription_id; detach handler | Create supports parent; existing Edit contract only opens Charges | Missing | Browser update drawer versus Charges tab; [V1 update][v1u], [detail][detail] | Add explicit parent update with conflict checks |
| 9 | Customer | Billing customer versus parent contract | Billing-customer external ID differs from parent relation | Separate controls and mutually exclusive validation | Complete | Browser Billing step; [schema][ds], [requests][q] | Keep separate semantics in copy and payloads |
| 10 | Plan | Plan/currency/cadence defaults | Recurring plan prices seed choices; one-time included | Plan prices, customer currency, compatible cadence filter | Complete | [V1 create][v1c], [V2 form][form] | Test mixed period counts and FX combinations |
| 11 | Plan | Multiple plans or replacing the plan on an existing record | Change APIs exist; no connected replacement UI established in inspected pages | No connected plan-replacement flow found | Not Verified | [V1 API][v1api], [detail page][dp] | Establish intended product operation before calling a regression |
| 12 | Dates | Start/end, open end and scheduled creation | Start/end pickers; phases supply final end | Timestamp start/end, open final phase, contiguous phase boundaries | Complete | Browser review; [schema][ds], [requests][q]; date tests | Run boundary persistence cases |
| 13 | Dates | Sandbox duration message | UI says automatically ends in 45 days; create payload still takes chosen end | Review says until cancelled when blank; no equivalent warning | Partial | Browser V1 notice/V2 Review; [V1 create][v1c] finalEndDate | Verify backend cap and display actual rule consistently |
| 14 | Dates | Timezone handling | ISO dates and stored timezone surfaced | Customer timezone seeded; exact instants preserved by contractDateToInstant | Complete | [V2 form page][v2p], [date tests][dt], [requests][q] | Test DST and calendar-day boundaries end to end |
| 15 | Billing | Anniversary/calendar/custom anchor | Cycle and optional anchor | Bill-on choices map to cycle/anchor | Complete | Browser forms; [requests][q] | Keep billing anchor distinct from charge cadence |
| 16 | Billing | Invoice versus charge cadence | Price invoice_cadence separate from billing_period | Separate charge timing, period and contract period fields | Complete | Browser In arrears and Monthly; [charge form][cf] | Test mixed advance/arrear invoices |
| 17 | Billing | Proration | Creation behavior and fixed-change requests | Creation toggle; fixed quantity-change preview/execute | Complete | [requests][q], [quantity dialog][qty] | Verify actual invoice deltas |
| 18 | Billing | Invoice grouping by charge period | Optional per_billing_period grouping for additional cadences | No lineItemGrouping field or mapper in contract form | Missing | [V1 create][v1c] finalLineItemGrouping; [schema][ds], [requests][q] | Expose grouping; SDK already has field |
| 19 | Billing | Payment terms | Optional terms, None | Due-on-receipt default and net terms | Complete | Browser Billing; [schema][ds], [requests][q] | Verify resulting due dates |
| 20 | Billing | Taxes | Rate overrides with priority/auto-apply/behavior | Customer defaults and override records; add/remove associations later | Complete | [V2 form page][v2p], [requests][q], [section dialogs][sections] | Verify tax calculations and currency restrictions |
| 21 | Billing | Auto-invoice threshold | Usage-only validation; rejects fixed-charge combinations | Hidden for fixed charges and cleared from submitted draft; hierarchy conflict guard | Complete | [V1 create][v1c], [schema][ds], [V2 form][form] | Retain fixed-charge exclusion and test server rejection |
| 22 | Pricing | Flat/package/volume/slab pricing | Override and custom-charge forms support these models | Shared ChargeForm/PriceOverrideForm plus request mappings | Complete | [V1 override][v1o], [charge form][cf], [requests][q]; mapper tests | Run persisted model fixtures |
| 23 | Pricing | Meter/aggregation association | Choose existing meter; aggregation belongs to meter | Choose existing meter; bucket UI depends on meter aggregation | Complete | [charge form][cf], [add charge][add] | Do not describe meter creation as contract configuration |
| 24 | Pricing | Custom expressions | No contract-specific expression editor verified | No contract-specific expression editor verified | Not Verified | Repository search plus [charge form][cf] | Identify supported expression contract and V1 entry point |
| 25 | Pricing | Custom price units | Price-unit amounts and tiers | Shared price-unit amounts/tiers serialize correctly in mapper code | Complete | [V1 override][v1o], [requests][q] | Round-trip custom-unit fixtures |
| 26 | Pricing | Fixed plan quantity during creation | Quantity in override/table | Quantity input in fixed plan row, separate from price dialog | Complete | [V2 form][form] ChargeTable quantity column | Test quantity preservation when repricing |
| 27 | Pricing | Usage quantity blank | Pay-as-you-go, not a fixed purchased quantity | Blank quantity cell; usage requests omit quantity | Complete | Browser same usage plan; [requests][q] | Consider explanatory dash/copy |
| 28 | Pricing | Added versus plan charge row menus | Different handlers for bespoke versus plan rows | Extra row Edit/Remove; plan row Override/Commitment/Coupon/Reset | Partial | [V2 form][form] row.kind branch around 2123 | Expose equivalent business actions where valid |
| 29 | Pricing | Create additional fixed/usage charges | Inline line_items, repeated additions | ContractAddChargeForm drafts multiple extra charges | Complete | [add charge][add], [requests][q] toCreateLineItemRequest | Test every extra survives create |
| 30 | Pricing | Edit existing usage price | PUT line item; effective_from; difference-aware builder | PUT line item; model/amount/effective date, but always resends price | Partial | [V1 override][v1o], [usage edit][edit], [requests][q] | Add no-op/difference handling and history checks |
| 31 | Pricing | Fixed quantity/flat-price modification | Preview and execute line_item_change; restricted editable amount | Same preview/execute; sends only changed quantity/eligible amount | Complete | [quantity dialog][qty], [requests][q] toLineItemChangeRequest | Verify preview matches execute |
| 32 | Pricing | End charges/future versions | Terminate with effective date | End dialog and delete upcoming line; history query | Complete | [detail page][dp], [requests][q] toDeleteLineItemRequest | Check lineage and surviving original line |
| 33 | Pricing | Revert persisted price without duplicating history | Reset in price form is local; no dedicated historical-revert API established | Local Reset to plan during creation; no historical-revert action | Not Verified | [V1 override][v1o], [V2 form][form], [detail page][dp] | Specify cancel/reset/revert semantics and verify stored lineage |
| 34 | Add-ons | Multiple add-ons during create | One dialog can stage several | Sequential Add another stages several; Review showed two | Complete | Browser Storage90 and Analytics30/50; [V2 form][form] | Keep staged values when editing another add-on |
| 35 | Add-ons | Multiple add-ons on existing contract | Bulk adds/removes through modify execute | Dialog stages up to 20; multi-add uses bulk modify, single uses attach | Complete | [V1 addon][v1a], [section dialogs][sections], [requests][q] | Test single versus bulk billing parity |
| 36 | Add-ons | Add-on price customization | Per-charge override controls | Override price works; Storage80→90 reached Review | Complete | Browser B2; [V2 form][form] AddonChargesDialog | Retain this support; do not classify as entirely absent |
| 37 | Add-ons | Fixed add-on quantities | Per-charge quantity; serialized with overrides | No quantity field in dialog or AddContractAddon pricing payload | Missing | Browser V1 Storage quantity1 versus V2; [schema][ds], [requests][q] addonPricing | Add per-price quantity model and payload |
| 38 | Add-ons | Combined add/remove and modification | V1 modify stages adds/removals; existing rows configurable | V2 stages adds and removes individually; no equivalent combined editor | Partial | [V1 addon][v1a], [section dialogs][sections], [detail page][dp] | Provide netted modification and preview where required |
| 39 | Discounts | Create contract/charge coupon | Single whole coupon and per-price coupon map, currency/redemption filtering | Whole and per-plan-charge coupon; weaker option metadata/filtering | Partial | [V1 coupon][v1coupon], [V2 form page][v2p], [V2 form][form] | Carry eligibility metadata and validate before submit |
| 40 | Discounts | Existing coupon association scope/dates | Apply Coupon dialog has scope and optional start/end | Contract picker or row-targeted picker; mapper carries no dates | Partial | User image5; [section dialogs][sections], [requests][q] toAddCouponRequest | Add dates and scope summary without losing row targeting |
| 41 | Credits | Plan credit grant customization on create | Defaults can edit/remove; explicit empty overrides | Edit/add/remove/reset supported; creditGrantsChanged sends explicit empty | Complete | [V2 form][form] CreditGrantsStep; [requests][q]; request tests | Verify changed and unchanged defaults on saved records |
| 42 | Credits | One-time/recurring amounts/expiry/priority | Credit type, name, credits, conversion, expiry, priority | Same core settings; duration expiry also offered | Complete | Browser grant dialogs; [grant form][gf], [requests][q] | Validate recurring period and expiry round-trip |
| 43 | Credits | Initial creation grant start date | Initial modal has no start-date input | No start-date input | Complete | Browser saved v1-credit-grant/v2-credit-grant screenshots | Treat proposed initial-date support as enhancement in both |
| 44 | Credits | Existing-contract one-time grant start | Editable required start date seeded from subscription start | No picker; mapper uses now for one-time grants | Missing | Browser existing-grant screenshots; [V1 grant][v1g], [requests][q] subscriptionGrantStart | Add explicit date and disclose default |
| 45 | Credits | Recurring grant missing period end | V1 blocks when current-period end unavailable | V2 falls back to now when period end absent | Partial | [V1 grant][v1g] validation; [requests][q] subscriptionGrantStart | Block unknown schedule or agree explicit fallback |
| 46 | Credits | Separate top-up conversion rate | Distinct input and topup_conversion_rate | Only conversionRate in create domain/form | Missing | Browser grants; [V1 grant][v1g], [grant form][gf] | Preserve separate rate through plan-draft and contract requests |
| 47 | Credits | Schedule grant cancellation | V1 cancellation dialog carries effective_date | V2 detail cancellation callback passes only grant ID | Partial | [V1 edit][v1e], [detail page][dp], [requests][q] | Expose effective date if backend supports it |
| 48 | Entitlements | Override inherited plan entitlements | Feature override plus metered grant settings | Boolean/static/metered override schemas and mapper | Complete | [schema][ds], [requests][q] toOverrideEntitlement; request tests | Test config and multi-source entitlement cases |
| 49 | Entitlements | Create aggregate subscription allowance | Add Subscription Entitlement allowance across usage lines | Only inherited feature overrides; no subscriptionEntitlementGrants draft | Missing | Browser V1 allowance dialog/V2 empty section; [V1 create][v1c], [schema][ds] | Add allowance creation and serializer |
| 50 | Entitlements | Existing entitlement edit/reset/delete | V1 feature and aggregate grant edit/delete/reset | V2 add feature entitlement, displays usage; no edit/reset callbacks | Missing | [V1 entitlements][v1ent], [detail page][dp], [detail][detail] | Add source-aware editing/reset and aggregate allowance display |
| 51 | Commitments | Whole-contract amount/period/overage/true-up create | Top-level commitment fields | Same fields and read mapper; amount and quantity are distinct | Complete | Browser step3; [requests][q] toContractCommitment/create mapper | Verify spend/shortfall against billed output |
| 52 | Commitments | Plan charge amount/quantity commitments create | Per-price commitment map | ChargeCommitmentDialog and line_item_commitments keyed by price | Complete | Browser configure dialog; [commit dialog][cc], [requests][q] | Test nested wire numbers and IDs |
| 53 | Commitments | Windowed bucket create | Bucket size plus per-bucket flag | Bucket control + Apply to each bucket; correct request flags | Complete | Browser hourly flag; [commit dialog][cc], [requests][q] withBuckets | Verify consumption and transitions |
| 54 | Commitments | UTC time windows create | Time ranges with own commitment and price; richer price models | Time-window UI and nested commitmentTimeBuckets; only per-unit/package windows | Partial | Browser Window1; [V1 buckets][v1b], [commit dialog][cc], [requests][q] | Support V1 tiered-window pricing and custom-unit preservation |
| 55 | Commitments | Time-window constraints and overlap | V1 bucket-dependent minute/hour constraints; no overlap check in inspected helper | V2 equal-time guard; coarse hourly/15-minute choices; no cross-window check | Partial | [V1 validation][v1bv], [schema][ds], [commit dialog][cc] | Agree overlap policy; validate aligned ranges/wrapping server-side too |
| 56 | Commitments | Add/edit time windows on existing charge | V1 hydrates existing bucket prices and builds update payload | UsageTermsFields has no window editor; mapper omits commitmentTimeBuckets | Missing | [V1 buckets][v1b], [usage terms][ut], [requests][q] | Reuse full window editor and preserve existing bucket IDs |
| 57 | Commitments | Clear existing bucket/commitment | V1 explicitly clears windowed flag and time-bucket array | Blank bucket omitted; null commitment returns empty object | Broken | [V1 buckets][v1b], [requests][q] commitmentFields/toUpdateLineItemRequest | Send supported explicit clear semantics; prove response clears |
| 58 | Commitments | Commitments with multiple phases | V1 omits top-level line commitments in phased path | V2 similarly excludes chargeCommitments when phased | Partial | [V1 create][v1c], [requests][q], [V2 form][form] | Document restriction; agree phase-specific API support |
| 59 | Preview | Financial preview before creating record | No wired unsaved-contract invoice preview established | Review summarizes configuration; no invoice total or preview request | Not Verified | Browser Review; [V1 create][v1c], [V2 form page][v2p] | Confirm backend capability; do not label Review a financial preview |
| 60 | Preview | Existing invoice preview | POST invoices/preview and actual lines/totals | Same endpoint and amount; sampled parent total282 matches | Complete | Browser both parent views; [V1 API][v1api], [requests][q] | Boundary display differs; verify exclusive date labels |
| 61 | Lifecycle | Draft save and activation | Create DRAFT and activate with start | Save as draft plus activation start dialog/API | Complete | Browser buttons; [requests][q], [detail page][dp] | Run save/reload/activate with disposable fixtures |
| 62 | Lifecycle | Cancellation final invoice | Immediate cancellation invoice policy | Immediately reveals Raise a final invoice now; policy serialized | Complete | Browser cancellation screenshot; [detail page][dp], [requests][q] | Test both policy values; do not file missing-field bug |
| 63 | Lifecycle | Pause/resume/scheduled cancel | Lifecycle operations and optional schedule | Dedicated dialogs and SDK mutations | Complete | [detail page][dp], [requests][q] | Verify actual service transitions separately |
| 64 | Invoices | Status badge mapping | Document/payment status displayed in V1 vocabulary | Derived Open/Paid/Overdue plus separate payment status | Partial | Browser seven invoices; [invoice mapper][im], [invoice domain][id] | Investigate missing amountRemaining; obtain failing fixture |
| 65 | Persistence | Price history and mutation isolation | PUT/modify APIs; historical values depend on backend | History query and current/upcoming/history surfaces; no audit mutations performed | Not Verified | [requests][q], [detail page][dp] | Execute disposable before/after fixture matrix |
| 66 | Persistence | Inheritance billing/usage propagation | Backend-managed inherited mirror and consolidated preview | Existing mirror and consolidated preview read successfully | Not Verified | Browser Grp Parent/Child; [requests][q] | Verify changes propagate without duplicating charges |
| 67 | Persistence | Commitment consumption/carry/expiry | Usage and commitment details; backend computes consumption | Usage/commitment read mappers; no standalone carry-forward policy control | Not Verified | [requests][q] toSubscriptionUsage, [detail][detail] | Verify bucket boundaries, carry rules and balances with backend fixtures |
| 68 | Persistence | Responsive/access-control/error recovery | Component and permission guards exist; full matrix not exercised | Form validation/errors and RBAC composition; no role/device matrix run | Not Verified | [V2 form][form], [detail][detail] | Test reduced roles, small viewports, API failures and unsaved navigation |
| 69 | Creation | Custom-charge draft/trial restrictions | Create sanitizer can emit custom lines with draft/trial; no equivalent frontend guard established | Explicitly blocks extra charges in drafts/trials and add-ons during active trial creation | Partial | [V1 create][v1c], [V2 form][form] statusConflict | Verify deployed API limits and document approved sequence |

## 5. Field-level comparison

### Creation

| Field / configuration | V1 | V2 | Payload / implication |
|---|---|---|---|
| Customer | Global picker or customer-scoped ID | Same; chosen customer separately loaded | `customer_id`; an internal customer ID is not an external inheritance ID. |
| Plan | Published plans; plan prices/defaults | Plan choice and loaded charges/default entitlements/grants | `plan_id`; not a plan replacement operation. |
| Currency | Plan-compatible charge currency | Customer-seeded compatible charge currency; FX settings | Lowercase `currency`; payer billing currency is distinct. |
| Contract period/count | Period chosen, request count hardcoded1 | Domain period and positive integer count | `billing_period`, `billing_period_count`; validate compatible price counts. |
| Start | Date picker converted to ISO | Date/time with customer timezone | `start_date`; V2 `utcDay` is an alias of `contractDateToInstant`, not unconditional truncation to midnight. |
| End | Optional end or last phase end | Last phase end | `end_date`; blank remains absent. Backend sandbox duration was not proven from this frontend notice. |
| Cycle and anchor | Anniversary/calendar and billing date | Bill-on start/calendar/custom | `billing_cycle`, `billing_anchor`; these do not change a price’s invoice cadence. |
| Trial | Optional days, plan defaults | Nonnegative optional days; plan trial defaults | `trial_period_days`; V2 mapper omits0. Explicitly clearing a plan default needs a persisted fixture, not a schema-only assertion. |
| Proration | Toggle and invalid entitlement-override combination | Toggle; same combination rejected | `proration_behavior=create_prorations` or `none`. |
| Whole commitment | Amount, duration, overage, true-up | Same on step3 | `commitment_amount`, `commitment_duration`, `overage_factor`, `enable_true_up`. |
| Included/additional price IDs | Opt-in additional cadences and compatible prices | `includePriceIds`/opted-in choices | `include_price_ids`; price selection and invoice grouping are separate. |
| Charge grouping | Optional combine per subscription period | No field | V1 `line_item_grouping`; installed V2 SDK supports `lineItemGrouping`. Frontend gap. |
| Feature entitlement overrides | Plan feature overrides | Boolean/static/metered grant patches | `override_entitlements`; neither substitutes for aggregate allowance grants. |
| Aggregate allowance | Add allowance, reset interval, stacking, dates | Absent | V1 `subscription_entitlement_grants`; installed SDK supports this field, but V2 draft/mapper do not. |
| Plan credit defaults | Loaded then editable/removable | Loaded then edit/add/remove/reset | Unchanged V2 defaults omitted; changed defaults send `credit_grants`, including explicit `[]`. |
| Credit type/amount | One-time/recurring; credits | Same | Grant cadence and recurring period/count are not invoice cadence. |
| Grant conversion | Main and top-up conversion | Main only | `topup_conversion_rate` lost from V2 authoring model. |
| Grant dates | Initial dialog omits start | Initial dialog omits start | Do not claim a V1 initial-date control from the different edit modal. |
| Taxes | Override rate, priority, auto-apply, behavior | Customer defaults plus override records | `tax_rate_overrides`; rounding/actual tax result still unverified. |
| Add-ons | IDs, per-charge overrides/quantities/commitments/start | IDs, overrides/commitments/start | `addons`; fixed quantities absent in V2’s add-on authoring model. |
| Coupons | Whole subscription and per-price | Whole contract and per-plan-charge | `coupons`, `line_item_coupons`; eligible selection metadata is narrower in V2. |
| Payment terms | None or net terms | Due on receipt or net terms | `payment_terms` omitted for none. |
| Billing customer | External ID | Same-customer / another-customer choice | `inheritance.invoicing_customer_external_id`. |
| Inherited customers | External IDs | Explicit multi-selection with blockers | `inheritance.external_customer_ids_to_inherit_subscription`; not all children automatically. |
| Parent subscription | Existing update drawer; creation inheritance modes differ | Optional parent at creation | `inheritance.parent_subscription_id` on create; existing PUT update still missing in V2. |
| Auto-invoice threshold | Usage-only and combination checks | Field hidden for fixed charges and removed from submitted draft; hierarchy checks | `auto_invoice_threshold`; verify zero-value rules and direct schema callers separately. |
| FX | Custom rate windows | Global/custom availability and override windows | `fx_rates` with optional start/end. |
| Draft | Separate Save as Draft | Header Save as draft | `subscription_status=DRAFT`; activation is another request. |

### Addition and existing editing

| Operation / field | V1 control | V2 control | Remaining difference |
|---|---|---|---|
| New fixed/usage charge | Add charge dialog | Type choice, then shared charge form | Multiple additions are independent saves on existing contracts, not one global save. |
| Quantity on new fixed charge | Positive quantity | Positive whole quantity | V2 validates whole units; fractional-quantity compatibility requires an explicit rule/fixture. |
| Quantity on existing fixed line | Modify dialog with financial preview | Quantity dialog with preview | Both use modify endpoints; unchanged eligible amount is omitted in V2. |
| Meter on an existing line | Existing override uses existing meter context | Locked currency, period and meter | Changing an immutable association is a replacement operation, not evidence of a lost editable field. |
| Existing usage price | Diff-based override and effective date | Shared price editor and effective date | V2 always emits model and current price fields, even for a terms-only save. |
| Upcoming line removal | Termination/edit paths | Delete upcoming line with empty effective date | Actual original-line reactivation/lineage result not tested. |
| Existing subscription parent | Update subscription drawer | No equivalent edit control | V2 menu label Edit contract navigates to Charges. |
| Attach inherited customer | Add customers on edit page | Read-only inherited list | Missing callback/mutation path in contract detail. |
| Detach inherited subscription | V1 update mutation handler sets parent null; exact action exposure needs fixture check | No equivalent update path | Do not detach by cancelling the child. |
| Existing one-time grant start | Required picker | No picker; now | Reproduced live. |
| Existing recurring grant start | Current-period end; missing end blocks | Current-period end or now fallback | Fallback can move credit issuance to the wrong cycle; server outcome untested. |
| Scheduled grant cancellation | Effective date passed to delete | ID-only cancellation callback | Add date control and supported request field. |
| Existing feature entitlement | Source-aware edit, reset override, delete | Add and display only | Must preserve source/multi-source rules when adding actions. |
| Existing aggregate allowance | Separate grant rows and grant editor | Reads only features in entitlement mapper | Existing aggregate grants may be omitted from V2 detail as well as missing from creation. |
| Existing coupon dates/scope | Explicit scope and optional start/end | Whole picker or charge-context picker | Charge context supplies scope; start/end still absent. |
| Combined add-on changes | Bulk adds/removes in one modify | Multi-add bulk, separate remove | Netted change behavior differs; do not assume one-at-a-time removal has identical proration. |
| Basic name/description/renewal metadata | No broad form established; V1 update drawer only parent | Metadata adapter exists; no general contract-details editor | Do not invent V1 capabilities to populate a parity backlog. |

### Charge configuration and pricing

Both versions distinguish flat fee, package, volume tiered and slab tiered pricing. V2 uses `BillingModel.Tiered` plus `tierMode`, rather than a separate billing-model enum for every tier strategy. Package size becomes `transform_quantity.divide_by`. Currency-unit prices use `amount`/`tiers`; custom-unit prices use `price_unit_amount`/`price_unit_tiers`. V2’s shared charge form is therefore more substantial than the simple amount editor visible in some screenshots.

Selecting a meter associates its existing aggregation. Contract creation does not expose a general aggregation-expression editor. Custom expressions were not established as configurable through the inspected V1 subscription UI; this remains Not Verified rather than Missing. Meter schema, contract price, and usage aggregation must be tested together for any future expression support claim.

Fixed quantity belongs to the purchased line. Usage quantity is computed from events. The matching browser plan contains only usage charges: blank V2 quantity cells correspond to V1’s pay-as-you-go display. This cannot demonstrate a fixed-quantity loss. The add-on dialog comparison does demonstrate that loss: V1 Storage offers quantity1 alongside price80, while V2 can change price but offers no quantity entry.

V2 plan-charge rows show the same override/commitment/coupon capabilities after an override, with Reset to plan added. Newly authored extra charges go through a different branch with Edit/Remove. For extra usage lines, Edit carries basic usage terms, but does not expose the richer creation-time time-window editor. A coupon on a newly authored charge is not offered through the same row menu. Action parity should follow valid business operations, not force identical menus for incompatible row types.

### Commitment configuration by surface

| Surface | Minimum amount/quantity | Bucket + per-bucket | UTC time windows | Window pricing | Existing bucket identity |
|---|---|---|---|---|---|
| V1 plan override during create | Yes | Yes | Yes | Per-unit/package and tier strategies through bucket drafts | New draft |
| V2 plan override during create | Yes | Yes | Yes | Per-unit/package only | New draft |
| V1 add/edit custom usage line | Yes | Yes | Yes | Hydrated bucket price context | Preserves IDs when price unchanged |
| V2 add/edit custom usage line | Yes | Yes | No authoring UI | No serialized window array | Read model can carry IDs; update mapper omits them |
| V2 attach add-on | Yes for compatible usage price | Yes | Creation-style dialog | Same restricted window models | New attachment |
| Whole-contract commitment | Monetary amount | Not a time-window editor | No | Not applicable | Not a charge bucket |

Bucket size means the interval over which usage is aggregated. A windowed commitment applies the minimum to each bucket. Optional UTC time-of-day windows carry a separate commitment and price; they are not a contract start/end schedule. V2 creation serializes them only when `windowed`, `bucketSize`, `priceBase` and nonempty windows are all present. `priceBase` supplies meter, currency, cadence and entity association.

The V2 creation dialog uses hourly choices for bucket labels matching hour/day and otherwise15-minute choices. V1 derives allowable hour/minute steps from the actual bucket size. Both inspected validators reject equal start/end times; neither inspected helper establishes cross-window overlap rejection. Wrapping midnight is not automatically invalid merely because end is earlier than start. Overlap, midnight and boundary policy require backend agreement and fixtures.

No contract screen establishes configurable carry-forward between time buckets. Backend consumption, overage, expiration and bucket transitions must be verified against recorded usage. Do not infer these rules from a switch label.

## 6. Business logic differences

### Pricing and history

Creation-time Reset to plan is a **local draft operation**. In V2 it removes that price’s override, quantity, coupon and single-phase commitment together. It does not call a price mutation or historical-revert endpoint. This is broader than “reset price” and should be made explicit to users who have configured multiple terms on the row.

V1’s price override Reset also restores local input values; cancel restores the previous unsaved override state. A persisted rollback to an older active price is a different operation. No dedicated historical-revert mutation was established in either inspected workflow. V2 reads line history through `/subscriptions/lineitems/{id}/history`, but a readable history does not imply restore support.

For existing usage-price edits, V2 `toUpdateLineItemRequest` always emits billing model and price fields. `ContractUsageEditForm` submits without comparing them to the original. V1’s override builder computes differences and closes without a request when neither price nor commitment changed. V2’s fixed modification builder does compare quantity/amount and omits untouched amount. The usage path should adopt equivalent difference handling. A no-op or terms-only PUT may create a replacement price depending on backend semantics; the audit did not execute it and does not claim a duplicate was observed.

End/delete-upcoming is also not automatically a historical restore. The acceptance test must compare original line ID, price ID, start/end dates, predecessor/successor links, cancellation state and invoice amount before/after. Restoring the original numeric amount through a fresh price beginning today would not meet the requested historical-revert behavior.

### Commitments and clearing stored values

V2 creation has rich per-price commitments. Existing add/edit uses `UsageTermsFields`, which cannot author time windows, despite `LineCommitment.windows` being present in the read model. `toCreateLineItemRequest` and `toUpdateLineItemRequest` do not serialize those windows. The installed SDK supports `commitmentTimeBuckets`; this is a frontend omission rather than an established backend block.

There is a concrete clear-request defect. Selecting whole billing period makes bucketSize empty, but update mapping includes it only when truthy, so no clear field is emitted. Unchecking Add a commitment produces `commitment:null`; `commitmentFields` returns `{}`. That cannot explicitly communicate the user’s request to remove stored commitment fields. The backend’s precise clear convention still needs confirmation. V1 at least explicitly emits `commitment_windowed:false` and `commitment_time_buckets:[]` when disabling windowing. Do not promise the existing service clears a base monetary minimum unless confirmed separately.

V2 can clear commitment duration by sending the empty string; the installed SDK’s open-enum outbound serializer accepts strings. It is incorrect to claim that an enum type alone prevents this request. Conversely, mapper tests accepting an object do not prove the service implements the empty-string convention.

The phased create path excludes top-level per-price commitments in both frontends. This is a shared restriction, not evidence of a newly lost field. Existing commitment history, amounts and utilization are read-only summaries; neither UI establishes an independent commitment ledger editor with its own arbitrary effective/end dates.

### Credits and entitlements

Editing inherited plan credit drafts is implemented in V2. Removing every grant sets `creditGrantsChanged` and sends an explicit empty array; leaving defaults untouched omits the override. These are materially different semantics and are covered by request tests.

Initial grant creation and existing-contract grant addition use different V1 dialogs. V1 existing one-time grants start from an editable required date seeded to subscription start, while V2 issues them now. Recurring V1 grants require the current period end; V2 uses it when known but falls back to now otherwise. A missing period end should not silently decide a grant schedule.

V2 drops the separate top-up conversion rate from authoring and plan-grant drafts. Equal conversion values in a default fixture do not prove parity when a plan has distinct initial and top-up rates. The saved grant must retain both rates after an unrelated edit.

Feature entitlements and aggregate monetary allowances are distinct resources/semantics. V1’s `subscription_entitlement_grants` applies allowance across usage lines; V2’s `override_entitlements` patches plan feature entitlements. Adding a feature entitlement after creation does not recover the missing aggregate allowance. V2’s existing entitlement mapper consumes `features` and does not display V1’s aggregate grant collection. Existing edit/reset/delete also lacks callbacks, so merely adding an Add button to the wizard would not complete entitlement parity.

### Hierarchy, billing and propagation

A billing customer external ID changes who receives invoices. Inherited customer external IDs request mirrored subscriptions sharing configuration. Parent subscription ID groups an additional contract under another contract. These are separate associations, not aliases. V2 creation models all three and guards incompatible combinations; the existing detail page does not provide V1’s hierarchy editing operations.

The browser confirmed one inherited Grp Child row under the same Grp Parent record in both UIs. Both invoice previews totaled740 subtotal,458 discount,282 due. That supports existing-record read parity and consolidated-preview parity for this sample. It does not prove that changing a parent later updates every child, preserves child-specific history or attributes usage correctly. Those require controlled mutation fixtures.

V2 displays upcoming preview line end as Jan2 while V1 displays Jan1 for the same Dec2 monthly line. This appears consistent with exclusive versus inclusive date presentation, but the exact backend interval should be checked before changing either formatter. The amounts matched; the dates alone do not prove an extra day was billed.

### Invoice status and cancellation

The invoice mapper intentionally derives operator-facing status from document status, payment status, due date and amount remaining. Void/Skipped/Draft take precedence; successful payment or no remaining balance becomes Paid; overdue unpaid balance becomes Overdue; otherwise Open. Payment has its own column.

For the sampled parent, invoice INV-202611-00025 rendered Open/Pending, INV-202611-00013 Overdue/Pending and INV-202610-00032 Paid/Succeeded. No mapping failure was reproduced in these rows. However, `toInvoice` builds amountRemaining through a zero fallback before deriving status. An absent amountRemaining can therefore make an unpaid finalized invoice appear Paid. This is a source-supported risk, not a confirmed description of the user’s unidentified bad invoice. Test missing-balance and unknown-status fixtures before closing the report.

Immediate cancellation shows a final-invoice switch; period-end cancellation does not. V2 serializes an explicit `generate_invoice` or `skip` policy for immediate cancellation. The switch defaults off in this detail component. The correct business default and generated invoice result were not tested. The requested missing-field bug is not reproduced in this revision.

### Preview and interaction

V2 Review is a configuration summary with Edit links, not a calculated invoice preview. An older `ContractSummary` file includes estimate code, but the live wizard imports formatting helpers rather than rendering that estimate. Do not cite unused estimate code as current behavior. V1’s inspected creation page also did not establish an unsaved financial preview. The backend may need a new/extended preview contract; this audit cannot establish its absence from all services.

V2 explicitly rejects saving a draft containing extra custom charges and rejects trial creation containing those charges; it also blocks add-ons on a contract starting in an active trial. The source attributes these restrictions to backend status rules, but no deployed rejection was executed in this audit. V1’s inspected create sanitizer does not establish the same frontend guard, so classify this as a restricted path pending backend verification, not an approved removal. A persisted draft can be read and previewed through existing subscription/invoice endpoints in principle, but this audit did not save and activate a new draft. Existing fixed-line quantity/eligible-price changes have an actual modify preview step in both UIs. Adding a custom line, editing a usage price or adding add-ons does not pass through that same preview flow in the inspected V2 wiring.

Both versions retain asynchronous errors rather than treating an attempted request as success. V2 mutations invalidate subscription-family reads; section additions also invalidate related tax/usage/grant keys. That is evidence of refresh intent, not evidence that all server side effects are atomic. Responsive layouts, role matrices, navigation away with unsaved drafts, race conditions and failure recovery remain untested acceptance items.

## 7. API and backend gaps

### Endpoint map

Paths below are relative to the configured `/v1` API base. V1 calls Axios with snake_case bodies. V2 uses generated SDK methods and camelCase objects, converted by outbound schemas. A camelCase property in mapper source is not itself a wire-format bug.

| Operation | Endpoint / method | V1 / V2 mapping and verification |
|---|---|---|
| Create | `POST /subscriptions` | V1 `SubscriptionApi.createSubscription`; V2 `createSubscription(toCreateSubscriptionRequest(...))`. Response is subscription data; no create write executed. |
| Read detail | `GET /subscriptions/{id}`; V2 detail also searches by ID | Lines/grants use full read; subscription metadata comes from search with all statuses. Source and existing records verified. |
| Search contracts | `POST /subscriptions/search` | SDK `querySubscription`; environment/session scoped. |
| Add custom line | `POST /subscriptions/{id}/lineitems` | Price inline plus quantity for fixed; bucket/commitment for usage. Missing V2 window array on this path. |
| Update usage line | `PUT /subscriptions/lineitems/{id}` | Model/rate/tiers/package/effective date and commitment fields. SDK supports time buckets; V2 mapper omits them. |
| End line | `DELETE /subscriptions/lineitems/{id}` | Optional effective_from; actual historical result Not Verified. |
| Per-line history | `GET /subscriptions/lineitems/{id}/history` | V2 `getSubscriptionLineItemHistory`, queried when a charge sheet opens. Read support does not establish restore. |
| Fixed quantity/eligible amount | `POST /subscriptions/{id}/modify/preview`, then `/modify/execute` | `type=line_item_change`, `line_item_change_params.line_items[]`; preview maps changed resources and invoice summaries. |
| Attach one add-on | `POST /subscriptions/addon` | SDK addSubscriptionAddon; ID, pricing/commitments and optional start. V2 differs from bulk path used for multiple attachments. |
| Attach multiple add-ons | `POST /subscriptions/{id}/modify/execute` | `type=addon`, `addon_bulk_params.adds`; V1 also stages removes. No common V2 combined adds/removes editor. |
| Remove add-on | `DELETE /subscriptions/addon` | Association removal path; independent of bulk-add UI in V2. |
| Add/remove coupon | `POST /subscriptions/{id}/modify/execute` | `type=coupon`, action add/remove; V2 adds coupon_code and subscription or line ID, omits dates. |
| Add inherited customers | `POST /subscriptions/{id}/modify/execute` | V1 `type=inheritance` and external IDs; V2 create models these but existing detail has no attach hook. |
| Parent update / detach | `PUT /subscriptions/{id}` | V1 parent_subscription_id or null. V2 existing update hook inspected is metadata-only, not a hierarchy editor. |
| Entitlement add | `POST /entitlements` | V2 `createEntitlement`, entity type subscription. Feature entitlement addition differs from aggregate allowance. |
| Entitlement read | `GET /subscriptions/{id}/entitlements` | V2 maps features; recovery handles some successful-body SDK schema rejections. Aggregate-grant collection still not mapped. |
| Grant add | `POST /creditgrants` | Subscription scope plus required startDate; V2 injects implicit schedule. |
| Grant cancel | Credit-grant delete endpoint | V1 passes effective_date; V2 contract callback sends ID only. Confirm current deployed delete semantics before extending. |
| Tax associations | Tax association list/create/delete APIs | Shared hooks; subscription-family invalidation. Full financial result unverified. |
| Existing invoice preview | `POST /invoices/preview` | Existing subscription ID; browser parent totals match. No unsaved contract payload wired. |
| Activate/cancel/pause/resume | `POST /subscriptions/{id}/activate`, `/cancel`, `/pause`, `/resume` | Lifecycle SDK mutations; cancellation invoice policy verified in outbound mapping/tests, no lifecycle write executed. |
| Plan change | `/subscriptions/{id}/change/preview` and `/change/execute` in V1 API | No connected replacement UI established in either inspected current workflow. Do not count API presence as migrated UI. |

### Payload differences requiring work

1. **Aggregate allowances:** V1 sends `subscription_entitlement_grants`. V2 schema/form/create mapper omit it, while installed SDK CreateSubscriptionRequest supports `subscriptionEntitlementGrants`. Frontend implementation gap; backend validation still needs a real request fixture.
2. **Invoice grouping:** V1 conditionally sends `line_item_grouping=per_billing_period`; V2 has no draft field/mapper despite SDK `lineItemGrouping`. Frontend gap.
3. **Add-on quantity:** V1 emits fixed quantities by price. V2 addonPricing accepts priceOverrides and commitments but no quantity collection. A price override alone is not a quantity override.
4. **Time buckets on existing line:** SDK create/update models support `commitment_time_buckets`; V2 authoring/mappers omit them. Preservation and explicit clear need implementation.
5. **Credit top-up rate/start:** V2 authoring drops top-up conversion and explicit existing-grant start selection. Recurring fallback changes business behavior.
6. **Coupon dates:** Existing V2 request is action/code/scope only. Determine the supported modify API fields from deployed contract before wiring V1 dates; do not invent them.
7. **Hierarchy editing:** Existing V1 update and modify endpoints provide a demonstrated route to implement V2 controls. Mutation ordering, conflict validation and propagation need server verification.
8. **Clear semantics:** Omitting a field cannot express an explicit clear. Agree safe update values for bucket, commitment amount/quantity/duration and time buckets. Do not replace an omitted update with zero arbitrarily.

### Error handling, permissions and cache

V2 query hooks wrap SDK calls through the shared `call` adapter and invalidate subscription-family query keys after mutations. Contract-section changes also refresh related tax associations, customer usage and credit grants as appropriate. Dialogs show pending and error states. Detail gates charge editing for inherited/cancelled/cancelling records and adds custom charges only for active records. These source guards do not replace backend permissions or race validation.

A complete permission audit was not performed. Specifically unverified: a read-only role opening dialogs, a role losing update permission after loading, cross-environment IDs, stale parent conflict results, concurrent edits, and response-schema failures after an otherwise successful mutation. The report claims no permission bypass.

### Tests run for this audit

```text
pnpm nx run @fp/query:test -- src/subscriptions.test.ts src/subscriptionRequests.test.ts src/subscriptionDetailMappers.test.ts src/subscriptionInheritance.test.ts
# 4 files, 104 tests passed

pnpm nx run @fp/domain:test -- src/subscriptionCommitment.test.ts src/subscriptionDates.test.ts src/subscriptionValidation.test.ts src/subscriptionInheritance.test.ts src/contractCharges.test.ts src/contractCharge.test.ts src/invoicePaymentStatus.test.ts
# 7 files, 55 tests passed

pnpm nx run @fp/ui:test -- src/pages/contracts/SubscriptionForm.test.ts src/pages/contracts/ContractSummary.test.ts src/pages/contracts/chargePricing.test.ts
# 3 files, 20 tests passed
```

These tests validate helpers, mappers and some SDK outbound serialization. ContractSummary tests cover the helper/component file, not proof that its estimate is rendered by the current wizard. No backend integration suite, contract mutation E2E, full lint/build or comprehensive responsive test was run; application code was unchanged.

## 8. Critical functional gaps

The migration should not be signed off as full parity yet. The highest-confidence blockers are:

- **Aggregate allowance creation and maintenance:** users cannot create the V1 allowance on the V2 wizard, and the detail feature mapper does not recover that allowance collection.
- **Existing hierarchy management:** parent update and inherited-customer attach/detach operations are not represented by V2’s Charges-only Edit action.
- **Existing time-window commitments:** create-time support does not extend to existing-charge add/edit. Window pricing and IDs need a real round-trip path.
- **Explicit clearing:** existing bucket/commitment removal intent is omitted from the request in key cases. This is unsafe to present as a successful removal without response verification.
- **Add-on quantities:** quantity-dependent fixed add-ons cannot be configured equivalently at attach/create time.
- **Grant schedules and top-up rate:** existing one-time scheduling and separate top-up conversion are unavailable; missing recurring period end silently falls back to now.

Other material gaps are invoice grouping, source-aware entitlement editing/reset, coupon dates/eligibility, combined add-on modification, and no-op usage-price protection. Cancellation final invoice and multiple add-ons should not be filed as blanket missing features against this revision.

### Required scenario verification before parity sign-off

| Scenario from brief | Current evidence | Remaining verification |
|---|---|---|
| Fixed charges | Source, quantity/model mapper tests; existing parent fixed lines read | Create disposable record, reload every quantity/model and invoice output. |
| Usage charges | Same live usage plan and metered mapper tests | Persist meter, bucket, currency/unit and aggregation combinations; ingest known usage. |
| Multiple/custom charges | Extra-line array path inspected | Save mixed lines and verify no loss, duplication or unintended plan mutation. |
| Credit grants | Editable defaults source; live add dialogs | Save unchanged/changed/empty defaults, distinct top-up rate and scheduled grant. |
| Whole/charge commitments | Create schema and request tests | Reload then bill below/equal/above minimum with true-up on/off. |
| Windowed/time buckets | Live creation controls, nested mapping; existing edit gap | Verify overlap policy, wrap midnight, exclusive end, meter-dependent alignment, transitions and ID preservation. |
| Add a charge | Isolated line endpoint | Snapshot all existing lines/terms before/after; verify invoice delta. |
| Add/edit commitment | Basic terms path; missing windows/clear identified | No unintended repricing; unchanged window identities and supported clear behavior. |
| Revert price edit | Local reset only; no historical restore proven | Change/cancel/reset/future-delete/historical-restore fixtures with line/price lineage assertions. |
| Future price / ended charge | Effective-date and history code | Boundary execution and active-versus-upcoming/history rendering against server clock. |
| Inherited customers / parent modification | Existing child/read preview; creation guard tests | Attach/remove/change parent and prove usage, grants, commitments and invoice propagation. |
| Preview before save | Configuration Review only | Establish service contract for unsaved preview or explicitly approve draft-first workflow. |
| Future-dated contract | Instant-preserving date tests | Persist start at non-midnight, add charge on same day and test timezone/DST. |
| Mixed cadence | Compatible selections and request paths | All opt-in charges, one-time inclusion, counts and invoice grouping across periods. |
| Multiple currencies | One charge currency plus billing-currency/FX configuration | Supported FX conversion, custom-unit factors, incompatible coupon/add-on rejection and rounding. |

There is no evidence that one contract supports arbitrary mixed charge currencies merely because billing-currency conversion exists. Verify the intended currency model before making “multi-currency contract” an acceptance requirement.

## 9. Implementation checklist

Priorities below are proposed migration priorities, not claims of an observed production incident. Every task must use the current V2 kit and presentation/query/domain separation. No implementation was started.

| Priority / task | Exact problem and expected behavior | V2 locations | Backend dependency | Acceptance criteria |
|---|---|---|---|---|
| P0 — explicit clear semantics | Whole-period selection/null commitment currently omits removal intent; make remove mean remove | `packages/query/src/subscriptions.ts` commitmentFields/toUpdateLineItemRequest; [UsageTermsFields][ut] | Confirm supported field-clearing values and response semantics | Configure bucket/window/minimum, clear each independently, reload and assert stored fields cleared; unrelated terms and prices unchanged; no success for an ignored clear. |
| P0 — aggregate subscription allowances | Restore V1 monetary allowance during create and existing management, distinct from feature entitlements | [schema][ds], [form][form], [V2 form page][v2p], [requests][q], [detail][detail] | SDK create field exists; verify deployed grant CRUD and entitlement response collection | Create amount/reset/stacking/date fixture, inspect wire, reload, display aggregate grant, edit/delete; verify cross-line allowance billing. |
| P0 — existing hierarchy editing | Add explicit attach/detach and parent update rather than implying Charges is a full edit | [detail page][dp], [detail][detail], [requests][q], subscription inheritance schemas | Existing V1 modify/PUT operations; verify server conflict and detach semantics | Attach valid child, reject own-contract/other-parent conflict, change/detach parent with confirmation, reload both records; prove consolidated usage/invoice propagation and no duplicate lines. |
| P1 — existing commitment time windows | Existing add/edit lacks window authoring and serialization | [usage edit][edit], [usage terms][ut], [add charge][add], [requests][q], domain contractCharge.ts | SDK supports array; need hydrated bucket prices and unchanged-ID convention | Add/edit/remove window with flat/package/volume/slab pricing, retain untouched bucket IDs/prices, preserve custom unit and effective date; reload and compare consumption. |
| P1 — add-on fixed quantity | Add per-price quantity alongside price override for create and existing attach | [form][form] AddonChargesDialog; [section dialogs][sections]; [schema][ds]; [requests][q] addonPricing | Verify override-line fixed quantity and bulk add schema on deployed service | Attach quantity3 at price80, reload quantity3 and invoice240; repricing preserves quantity; multiple add-ons retain independent quantities; usage sends no fixed quantity. |
| P1 — grant schedule and top-up conversion | Restore explicit one-time start and distinct top-up rate; avoid implicit now when recurring schedule unknown | [grant form][gf], domain creditGrant.ts, [requests][q] subscriptionGrantStart, plan grant mapper | SDK/deployed grant validation; supported date boundaries | Future/backdated start follows allowed policy; recurring uses known period end or blocks; changed plan grants retain distinct conversion/top-up rates after reload. |
| P1 — entitlement edit/reset | Existing feature entitlements display but lack source-aware update/reset/delete | [detail][detail], [detail page][dp], query entitlements.ts and subscriptions.ts | Source IDs and reset/delete API semantics | Modify subscription override, reset to plan, delete subscription-only entitlement; prevent invalid multi-source edit; unrelated grants unchanged. |
| P1 — usage price difference handling | Terms-only/no-op Save resends price fields; protect history and original effective dates | [usage edit][edit], [requests][q] toUpdateLineItemRequest | Confirm price-version semantics for mixed updates | No-op saves no request; terms-only save omits price; cancel/reset makes no mutation; future replacement removal and historical revert tests prove original line/price remains active when intended. |
| P1 — invoice grouping | Missing per-charge/per-billing-period grouping choice | [schema][ds], [form][form], [requests][q] | SDK supports field; verify compatible finer cadence rules | Same mixed-cadence fixture as V1 produces matching grouping and totals; default is preserved when omitted. |
| P1 — invoice badge evidence | Guard absent balance derivation and identify reported failing row | [invoice mapper][im], [invoice domain][id], shared StatusBadge.tsx | Confirm required invoice response balance/status fields | DRAFT/FINALIZED/VOIDED/SKIPPED × pending/succeeded/refund/failure × missing/zero/positive balance fixtures; unknown data must not silently assert Paid; reproduce user record before closing. |
| P2 — coupon dates/eligibility | Dates omitted and picker lacks full currency/redemption constraints | [section dialogs][sections], [V2 form page][v2p], [requests][q] | Confirm supported modify fields for effective dates | Subscription and line scope survive save; optional start/end persist; invalid currency/expired/exhausted coupon blocked; precise server errors shown. |
| P2 — combined add-on modification | V1 can net staged additions/removals; V2 separates them | [section dialogs][sections], [detail page][dp], [requests][q] | Bulk modify removes/proration convention | Mixed add/remove is one intended operation with no intermediate billing; retained add-ons/quantities/commitments unchanged; single and multi-add totals match. |
| P2 — grant cancellation date | Existing V2 cancellation cannot select date | [detail][detail], [detail page][dp], end-grant hook in [requests][q] | Deployed effective_date support | Immediate and scheduled cancellation reload correctly; recurring grants stop on intended boundary; error retains draft. |
| P2 — catalogue search/size | First-page100 pickers can omit valid catalogue items | [V2 form page][v2p] and query catalogue hooks | Paginated/filter API behavior | Select a customer/plan/add-on/coupon beyond100 through search; selected labels survive paging and reload; no silent fallback. |
| P2 — constraint parity | Window timing differs by bucket; threshold/trial clearing need explicit rules | [schema][ds], [commit dialog][cc], [form][form] | Agree overlap/wrap/bucket precision, trial-zero and threshold rules | Test every bucket boundary, valid wrap, overlap decision, fractional quantity policy, trial0 and fixed+threshold combinations at form and wire boundaries. |
| P2 — financial preview contract | Review lacks calculated financial impact; no unsaved preview contract established | [V2 form page][v2p], [form][form], query preview hooks | Determine whether service accepts draft create payload or requires persisted draft | Approved workflow shows server-derived lines, taxes, discounts, credits, commitments, proration and totals before activation; draft-first process explicitly documented if chosen. |
| P3 — row action and reset clarity | Extra/custom versus plan menus differ; Reset to plan clears several terms | [form][form] ChargeTable and reset callback | Valid coupon/commitment targeting for unsaved custom lines | Applicable actions discoverable for each row provenance; reset copy lists affected terms; keyboard and small viewport behavior verified. |
| P3 — lifecycle discoverability | Final invoice appears only for immediate cancellation; not a missing field | [detail page][dp] cancellation dialog | Confirm policy default | Timing-specific explanation; immediate both switch states produce correct wire policy; no final invoice incorrectly promised at period end. |
| P3 — environment/sandbox/date copy | V1 warning and V2 open-end Review may disagree with service policy | [form][form], [detail][detail], invoice period formatters | Actual sandbox cap and interval inclusivity | Copy reflects returned policy; exclusive/inclusive end labels consistent; no claim of extra billed day from display alone. |

### Source references

References are repository-relative so this report can be reviewed alongside both local repositories. V1 paths resolve to the sibling `flexprice-front` checkout. Source revisions are pinned in section1; line numbers can move after this audit.

[v1c]: ../../flexprice-front/src/pages/customer/customers/CreateCustomerSubscriptionPage.tsx
[v1e]: ../../flexprice-front/src/pages/customer/customers/CustomerSubscriptionEditPage.tsx
[v1api]: ../../flexprice-front/src/api/SubscriptionApi.ts
[v1o]: ../../flexprice-front/src/components/molecules/PriceOverrideDialog/PriceOverrideDialog.tsx
[v1i]: ../../flexprice-front/src/components/molecules/Subscription/SubscriptionEditInheritingCustomersSection.tsx
[v1u]: ../../flexprice-front/src/components/molecules/UpdateSubscriptionDrawer/UpdateSubscriptionDrawer.tsx
[v1a]: ../../flexprice-front/src/components/molecules/SubscriptionAddonsSection/AddAddonDialog.tsx
[v1g]: ../../flexprice-front/src/components/molecules/CreditGrant/EditSubscriptionCreditGrantModal.tsx
[v1ent]: ../../flexprice-front/src/components/molecules/SubscriptionEntitlementsSection/SubscriptionEntitlementsSection.tsx
[v1coupon]: ../../flexprice-front/src/components/molecules/SubscriptionCoupon/SubscriptionCoupon.tsx
[v1b]: ../../flexprice-front/src/utils/subscription/subscription_line_item_commitment_helpers.ts
[v1bv]: ../../flexprice-front/src/utils/common/commitment_helpers.ts
[v2p]: ../apps/console/src/pages/subscriptions/SubscriptionFormPage.tsx
[dp]: ../apps/console/src/pages/subscriptions/SubscriptionDetailPage.tsx
[form]: ../packages/ui/src/pages/contracts/SubscriptionForm.tsx
[detail]: ../packages/ui/src/pages/contracts/SubscriptionDetailView.tsx
[sections]: ../packages/ui/src/pages/contracts/ContractSectionDialogs.tsx
[add]: ../packages/ui/src/pages/contracts/ContractAddChargeForm.tsx
[edit]: ../packages/ui/src/pages/contracts/ContractUsageEditForm.tsx
[ut]: ../packages/ui/src/pages/contracts/UsageTermsFields.tsx
[cc]: ../packages/ui/src/pages/contracts/ChargeCommitmentDialog.tsx
[qty]: ../packages/ui/src/pages/contracts/ContractQuantityDialog.tsx
[gf]: ../packages/ui/src/pages/product-catalog/credit-grants/CreditGrantForm.tsx
[q]: ../packages/query/src/subscriptions.ts
[ds]: ../packages/domain/src/subscription.ts
[dt]: ../packages/domain/src/subscriptionDates.test.ts
[im]: ../packages/query/src/invoices.ts
[id]: ../packages/domain/src/invoice.ts

[cf]: ../packages/ui/src/pages/product-catalog/charges/ChargeForm.tsx

## V2 implementation update — 6 November 2026

This update describes local implementation after the audit. It does not change the audit’s original live verification results.

| Previously open item | Implemented V2 behavior |
| --- | --- |
| Spending allowances | Creation wizard and running-contract controls for a money allowance shared by all usage charges. Duration, allocation, stacking and optional start/end dates map to featureless subscription entitlement grants. Existing grants support quota edits and removal. |
| Contract hierarchy after creation | Change or clear the parent; add eligible inherited customers; remove inheritance by the customer’s external ID. Parent candidates and inherited children are paginated. A contract with inherited children must remove them before acquiring a parent. |
| Existing charge time windows | Add, edit, remove and clear UTC windows. Existing bucket IDs preserve their own prices; new windows start with the charge editor’s price in subscription scope. Window overlap and malformed times are rejected locally. Terms-only edits omit the base-price update. |
| Existing entitlements | Edit each contributing source separately. Plan/add-on sources create subscription-scoped overrides linked to the selected parent entitlement. Existing contract sources update in place. Reset deletes only a contract’s override so its inherited value applies again; net-new contract entitlements can be removed. |
| Coupon dates | Optional start and end dates on contract and line-item coupons, with correct mutually exclusive scope and date ordering. |
| Combined add-on changes | One dialog stages additions and association removals; one `addon_bulk_params` modification applies the combined set. Removals default to period end. Changes are not submitted until Apply. |
| Credit-grant cancellation date | End-grant dialog collects the effective day and passes it to `DELETE /creditgrants/{id}` rather than substituting the current time. |
| Picker truncation | Customers, plans, coupons, features, price units and parent candidates are fetched in bounded pages to completion. Existing complete add-on/tax scans are no longer sliced to 100 in contract forms. Search covers the resulting complete catalogues; loading/failure is explicit. |

Validation includes domain rules, SDK outbound serialization (including new versus existing bucket prices), full domain/query/console unit suites, focused browser stories, and local browser staging against Harshit’s home sandbox read data. No contract, entitlement, add-on, coupon or credit-grant mutation from this implementation was submitted to the live API. Successful live persistence, proration and rollback therefore remain a separate verification step.
