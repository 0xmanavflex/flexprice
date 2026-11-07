# V1 vs V2 — Invoice Flow, Integrations and Data-Mapping Parity Audit

Audit date: **6 November 2026**, Asia/Kolkata. Application code was not changed; no PR or implementation was started.

## 1. Executive summary

V2 has a substantial invoice lifecycle and a separate centralized Integrations section. It does **not** yet satisfy the requested contextual integration experience or full data fidelity. The most important findings are lost applied-tax/allowance explanations, missing zero-charge inspection, customer mappings used in contract context, dropped nested provider settings, and push controls that queue all eligible providers rather than one selected provider.

The invoice matrix contains **41 inspected comparison units**: 21 Complete, 11 Partial, 4 Missing, 1 Broken, 4 Not Verified. The integration matrix contains **31 inspected comparison units**: 5 Complete, 15 Partial, 6 Missing, 1 Broken, 4 Not Verified. Neither matrix establishes a proven Backend Blocked removal or an approved Intentional Removal. Counts are computed from the numbered rows in sections 5–6 and exclude the provider inventory, which is a different denominator.

“Complete” here means frontend/read/request parity was established within the stated scope. It does not certify a newly executed external sync or lifecycle mutation. Partial and Not Verified rows explicitly capture those limits. The generic and additional-request requirements are distinguished from actual V1 parity: V1 also lacks some requested row-menu actions and its provider-looking push menu still sends an all-provider request.

### What matched in the parallel browsers

Both local apps used Acme → **Harshit’s home** (`env_01M1DQKFMP700552AXFSWFJ032`) with real development API data, not mock fixtures. B1 means V1 at localhost:4316; B2 means V2 at localhost:4317.

- On invoice **INV-202611-00031** (`inv_01M6PB0QQWC2YT4BH98636WQ74`), both showed Base 100 + Seat 10, subtotal 110, tax 2.20, total 112.20, paid 0 and remaining 112.20 USD. Both showed issue 5 Nov and due 6 Nov2026. Both showed the same Chargebee invoice ID 26631 and Stripe external invoice ID.
- V1 displayed Finalized/Pending. V2 detail displayed Finalized/Payment pending. These are consistent document/payment states; Pending is not an invoice-document status.
- Both provider galleries showed Stripe, Razorpay, Chargebee and Zoho connected. Stripe’s saved sync choices matched: customers off, plan/subscription inbound on, invoice/price outbound on.
- The same staged one-off line, quantity 3 at unit price 2.3456, displayed 7.04 in each UI. No invoice was saved.
- Existing invoice edit forms expose line, metadata, due-date and status controls. V2 explains when a finalized invoice becomes a draft replacement.

### Confirmed gaps and mapping concerns

1. **Invoice tax data is truncated.** V1 shows applied tax name/code/source, 2% rate, exclusive behavior and taxable 110/tax 2.20. V2 shows only tax 2.20 and drops the richer detail from its read model.
2. **Contract mappings are not subscription mappings.** For Grp Parent’s contract, V1’s subscription integration table has no external subscription IDs. V2 shows the customer’s Stripe `cus_…`/Razorpay `cust_…` IDs and labels copy actions as customer IDs. That customer context can be useful, but cannot establish contract sync.
3. **Nested connection settings are projected away.** `toIntegrationConnection` reduces each sync_config entry to inbound/outbound flags. V1 Zoho’s `invoice_sync_settings.payment_gateways` cannot survive that projection; changing sync choices can send the reduced object back. No backend write was performed to trigger loss.
4. **Requested push locations are incomplete.** Invoice/customer Related can offer a combined push; the inspected main invoice More and row menus do not. Subscription-specific push/mapping controls are absent in V2.
5. **External sync success is unproven.** Queue acceptance is not provider completion. Existing external IDs were read, but no new push/retry/disconnect, external payment, credential save or lifecycle write was executed.
6. **Some extra display is useful; some is noisy.** Total versus remaining, provider IDs and real Activity are useful. A mostly blank unit-price column, repeated raw hosted-link metadata, redundant line subtitles and raw subscription-ID memo deserve refinement. Section10 gives field-by-field keep/change decisions.

### Scope and reproducibility

V1 revision `870d8ca7ecbbbe670789171de4c158afc1337646`; V2 revision `8b3c77762619d4f47dd7df90604dbbd10090ba9a`. Repositories: `/Users/dinesh/src-code/flexprice-front` and `/Users/dinesh/src-code/portal`.

Only navigation, read operations, opening dialogs and unsaved calculations were exercised. Existing records were not created by this audit. No invoice was sent, finalized, voided, paid or repriced; no provider was connected/disconnected or pushed. This preserves the shared environment while making the remaining mutation/provider checks explicit, rather than claiming they passed. Fresh OAuth/connection validation, external worker transformations, webhook propagation, duplicate prevention and backend permission enforcement remain Not Verified without an isolated disposable test journey and provider-side evidence. They are not counted as backend failures.

**Tests passed:** V2 query39 + domain78 + console11 + API2 = **130 tests /14 files**. V1 invoice-edit/menu/connection tests added **43 tests /4 files**. Total **173 existing tests /18 files**. These are unit/component/request tests, not external integration tests.

Evidence is stored under [audit-evidence/invoice-integrations](audit-evidence/invoice-integrations/), with selected screenshots/DOM inventories linked below. Source links are defined at the end.

## 2. V1 invoice feature inventory

| Surface | Route / source | Actual capability |
|---|---|---|
| Global list | `/billing/invoices`; [InvoicePage][v1list] | Server-search ledger, filters/sorts/page, document and payment badges, conditional subscription-customer enrichment, row menus. The sampled Billing Entity column actually contains customer links: a V1 labeling problem, not a V2 rule to copy. |
| Customer invoices | `src/pages/customer/tabs/CustomerInvoiceTab.tsx` | Customer-filtered invoice table; customer-scoped Create one-off action. |
| One-off create | `/billing/customers/:customerId/invoices/create`; [CreateInvoice][v1create] | Issue date, currency, repeated line name/quantity/unit amount, tax associations, calculated subtotal and create. Coupons heading remains but its picker is commented out and selectedCoupon is never set. Do not count that heading as working coupon authoring. |
| Details | `/billing/invoices/:invoiceId`; `src/pages/customer/invoices/InvoiceDetailsPage.tsx` and customer detail wrappers | Overview/Payments/Credit Notes, tenant/customer blocks, invoice facts, applied tax and summary, line explanations/zero switch, integrations, metadata. |
| Edit | `/billing/invoices/:invoiceId/edit`; [EditInvoicePage][v1edit] | Due date, metadata, eligible payment/status changes, line modifications, reapply existing coupons, replacement confirmation and returned-ID chaining. |
| Row operations | [InvoiceTableMenu][v1menu], status/payment modals | Downloads, hosted invoice, comms, record payment, edit, recompute and status updates with invoice/write checks and state restrictions. |
| Lines and totals | [InvoiceLineItemTable][v1lines], `grantAllowance.ts`, `LineItemGrantInfo.tsx`, `InvoiceTaxAssociationTable.tsx` | Amounts, billing periods, grants/allowances and tax provenance. Includes zero-charge inspection and positive-only line CSV exports. |
| API | [InvoiceApi][v1api] | Search/get/create/update; modify execute; payment/status; finalize/void/attempt; preview; PDF; compute/recalculate; comms trigger. |
| Settings | [InvoiceConfigurationSection][v1set] and `useInvoiceConfiguration.ts` | Invoice number scheme, timezone/sequence, due-date/finalization delay and stored configuration. |

Draft deletion, arbitrary duplication, a standalone uncollectible status and a complete bulk-action ledger workflow were not established in this V1 frontend. Do not turn the brief’s example list into fabricated V1 features.

## 3. V2 invoice feature inventory

| Layer / surface | Source | Actual capability |
|---|---|---|
| `/invoices` | [InvoiceListPage][list], [InvoiceGrid][grid] | Server-backed search/filter/sort/page, optional document-status/period columns, total/remaining/payment columns, customer navigation, provider badges and row actions. |
| `/invoices/new` and preset customer entry | [InvoiceFormPage][cp], [InvoiceForm][form] | One-off draft or finalize, number, customer, currency, issue/due dates, line notes/periods, tax overrides, memo and metadata. Customer/rate pickers request first100 records. |
| `/invoices/:invoiceId` | [InvoiceDetailPage][dp], [InvoiceDetailView][view] | Invoice document plus Payments/Credit memos, real Activity, metadata, Related; lifecycle handlers and entity mappings. |
| `/invoices/:invoiceId/edit` | [InvoiceEditPage][ep], [form] | Shared authoring UI, diffLines, chained save to returned replacement ID, due date/metadata/payment/status, line add/update/remove. |
| Query/domain | [invoice query][iq], [domain invoice][di], [payment rules][ps] | Exact-string transport amounts, status derivation, request mapping, response projections, preview/lifecycle/payment queries and cache refresh. |
| Display adapter | [invoiceDocumentAdapter][adapter], [invoiceParties][parties] | Billed customer selection, issuer snapshot selection, rate lookup/guarded derivation, API totals, number conversion for display, related IDs and Activity. |
| Exports and hosted links | [invoiceCsv][csv], [API invoice][apii], `packages/query/src/invoiceHostedLink.ts` | Positive-amount line CSV, PDF presigned-link route and separately resolved hosted invoice URL. |
| Settings | [InvoicesPanel][set], [config domain][config] and query settings hooks | Complete invoice-config record, environment keying, reset confirmation, entity-prefix handling and live example. |
| Integration controls | [entity mapping hooks][entity], [ContractIntegrations][marks] | Invoice-scoped mapping reads, link/unlink and combined push/pull; customer controls use separate hooks, subscriptions are not included in the generic mapped-entity union. |

“Record payment” opens the payment-creation workflow; “Update payment status” changes an invoice’s payment state; “Retry payment” attempts collection. They are not interchangeable. “Recalculate” is also distinct from edit and arbitrary duplicate.

## 4. Integration feature inventory

Both repositories contain **14 self-serve billing/CRM/marketplace providers** in the main catalogue, plus **2 premium placeholders** (Salesforce and PayPal) and **S3 as a separate export connector**. V2’s live gallery omits the premium placeholders, while they remain in the domain catalogue. This is not proof of missing working Salesforce/PayPal connectors.

The following table records fields and sync directions established in source, not vendor marketing or a claim of tested external operation. Webhook subscriptions are application-provided instructions; registering them at a provider was not performed.

| Provider | Connection and key fields | Configured directions / entities | Particular parity considerations |
|---|---|---|---|
| Stripe | API secret key, publishable key, webhook signing secret | Customer out; plan in; subscription in; invoice out; price out | Do not infer outbound subscription push from inbound subscription import. Saved choices matched in both browsers. |
| Razorpay | Key ID, secret, webhook secret | Invoice out; payment webhook events | Card setup is separate from invoice sync. Provider account test/live mode follows keys and needs explicit verification. |
| Chargebee | Site, API key, webhook username/password | Invoice out | Webhook Basic auth pair changes together. Plan/price copy in descriptions is not evidence of a corresponding connection toggle. |
| HubSpot | Private access token, client secret | Invoice/deal/quote out | Provider handles CRM objects; contract→deal/quote worker transformation not available in these repos. |
| Zoho Books | OAuth client ID/secret, organization ID, regional accounts server, webhook secret | Invoice out; customer in | V1 also stores invoice payment-gateway settings including PayPal method; V2 omits those controls and drops nested config. Alias catalogue ID zoho maps to provider_type zoho_books. |
| QuickBooks | OAuth client ID/secret, sandbox/production metadata, optional income account, webhook verifier | Invoice out; payment in | V1 derives account environment from Flexprice environment; V2 defaults sandbox and offers a selector. No fresh consent was executed. |
| Nomod | API key, webhook secret | Invoice out, payment-link webhook events | Not a generic customer/subscription push capability by itself. |
| Moyasar | Secret key, optional publishable key, optional success/cancel URLs, webhook secret | Invoice out, paid/failed webhook events | Autopay/card setup is a distinct workflow. Existing tests cover optional-key/metadata behavior, not payment completion. |
| Paddle | API key, optional client-side token/redirect URL, webhook secret | Invoice out; transaction/subscription webhooks | Webhook event subscription does not mean an outbound Flexprice contract action exists. |
| Whop | API key, company ID, optional product ID, webhook secret | Invoice out; payment webhooks | Product creation on first sync is source-described behavior, not provider-verified here. |
| Tabs | API key | Invoice out | No separate webhook spec in V2 connection registry. |
| AWS Marketplace | IAM role ARN, region and tenant/environment external ID | Usage metering; customer/subscription/plan association paths in V1 | Usage-sync jobs differ from pushing invoice documents. No cloud-role changes or scripts executed. |
| GCP Marketplace | Workload identity external_account JSON | Usage metering and marketplace associations | Validation checks JSON type; federation/setup script exists. No credentials supplied or cloud IAM modified. |
| Azure Marketplace | Tenant/client IDs and client secret | Usage metering and marketplace associations | No generic invoice-out flag in the spec. |
| S3 exports | S3 connection drawer/export workflow | Export data pipelines | Separate V2 `/exports/s3` pages; do not offer invoice Push to S3. |
| Salesforce / PayPal catalogue cards | Premium disabled placeholders in V1; catalogue-only entries V2 | No working self-serve connector established | Their absence from V2’s live self-serve gallery is not a verified functional regression. |

Provider source inventory: V1 `src/components/molecules/*ConnectionDrawer/*.tsx`, [Integrations][v1int], `integrationsData.ts`, [ConnectionApi][v1conn], [IntegrationMappingApi][v1mapi]; V2 [connection specs][spec], [connection query][conn], [connection API][conna], central pages and `ConnectIntegrationSheet`/`ManageConnectionSheet`.

## 5. Invoice parity matrix

| # | Module | Feature | V1 behavior | V2 behavior | Status | Evidence | Required action |
|---|---|---|---|---|---|---|---|
| 1 | List | Identity/customer/amount | Number, amount_due, document/payment status and customer under Billing Entity heading | Number/customer/date/total/remaining/payment/integration columns | Partial | Browser invoice31; [V1 list][v1list], [V2 grid][grid] | Keep total and remaining distinct; clarify heading and optional status |
| 2 | List | Document status column | Visible Draft/Finalized/Voided/Skipped | Same labels via invoiceDocumentStatus, hidden by default | Complete | [grid] optional status; browser Finalized detail | Consider visible default; not a missing field |
| 3 | List | Customer versus subscription customer | Conditional second customer column for distinct subscription_customer_id | Billed customer ID checked; subscription customer identity not modeled | Missing | [v1list] enrichment; [invoice query][iq] InvoiceWire | Preserve payer and service-customer distinction |
| 4 | List | Search/filter/sort/page | Granular invoice-number/customer/status filters and paging | Server query mapping; first100 customer options; optional derived page-local filter | Partial | [iq] toInvoiceFilter; [list][list] | Server-search customer choices; test derived filters across pages |
| 5 | List | Environment isolation | Session-scoped API | X-Environment-ID in raw adapter; same sandbox selected | Complete | [API invoice][apii], browser | Role/cross-environment enforcement still separate |
| 6 | List | Row lifecycle actions | Edit/status/payment/recompute/download/communication menus | Finalize/record/edit/send/void/PDF/CSV; fewer payment/status actions | Partial | [V1 menu][v1menu], [V2 rows][rows] | Align row/detail capabilities and eligible states |
| 7 | List | Ledger bulk/export actions | Per-invoice CSV/PDF established, not bulk ledger export | Per-invoice CSV/PDF; no bulk lifecycle flow established | Not Verified | [v1menu], [rows] | Establish V1 baseline before calling missing |
| 8 | Create | Customer-scoped/global one-off | Customer-scoped one-off form | Global/customer-scoped one-off with picker | Complete | Browser staged same customer; [create page][cp] | Test selected customer beyond first100 |
| 9 | Create | Quantity-times-price amount | Computes quantity times entered amount before request | Exact decimal helpers compute line amount; mapper sends amount not unit rate | Complete | Browser 3×2.3456→7.04; [form][form], [iq] | Persist precision/rounding fixture separately |
| 10 | Create | Draft/finalize/number/due date | Create endpoint; fewer authoring controls | Save draft or finalize; optional number, due date, line periods, notes | Complete | Browser form; [iq] toCreateInvoiceRequest | Validate duplicate number and saved result |
| 11 | Create | Tax defaults/overrides | Customer tax associations; priority, behavior, auto apply | Same request fields with customer prefill | Complete | [V1 create][v1create], [cp], [iq] | Verify service-calculated tax totals |
| 12 | Create | Coupon picker | Coupons heading but picker commented; selectedCoupon never set | No create coupon selector | Complete | [v1create] around327; [form] | Not a verified V1 regression; separate enhancement |
| 13 | Create | Usage/contract invoice creation | Contract lifecycle generates invoices; one-off form not metering UI | Same distinction; custom one-off lines are not linked usage prices | Complete | [V1 API][v1api], [cp], subscription hooks | Verify backend usage-cycle fixtures |
| 14 | Create | Server financial preview/duplicate protection | No wired unsaved one-off server preview or idempotency established | Local subtotal/tax indication; no server preview/idempotency established | Not Verified | [v1create], [form], [iq] | Test server duplicate prevention and authoritative totals |
| 15 | Detail | Stored line and monetary totals | Subtotal/tax/net/paid/remaining | Same sampled110+2.20=112.20 and correct invoice mappings | Complete | Browser invoice31, [iq], [adapter][adapter] | Keep API totals authoritative |
| 16 | Detail | Applied-tax breakdown | Applied Taxes rate/source/behavior/taxable amount/tax amount and summary | Only aggregate tax mapped/displayed | Missing | Browser invoice31; [iq] detail shape, [view][view] | Map tax applications/summary and render detail |
| 17 | Detail | Allowance/credit allocation detail | Grant allowance metadata and line explanations | Aggregate prepaid total; line grant/allowance metadata dropped | Missing | [V1 lines][v1lines], [iq], [adapter] | Preserve billing explanations without recomputing totals |
| 18 | Detail | Zero-amount lines | Show Zero Charges switch | Filters zero lines out; no switch | Missing | Browser V1; [view] lines.filter | Allow auditing free/included/zero-usage charges |
| 19 | Detail | Description/meter identity | Display/plan/meter labels plus line metadata | Picks first available description; retains price ID, loses meter IDs and rich metadata | Partial | [iq] toInvoiceDetail; [v1lines] | Keep fields needed to explain usage and original price |
| 20 | Detail | Unit price column | No comparable unit-price column in sampled V1 table | New rate column; blank for sampled fixed lines; guarded lookup/derivation | Partial | Browser invoice31; [adapter] unitPrice | Resolve unavailable identity transforms; avoid fabricated package/tier rates |
| 21 | Detail | Bill-from/bill-to association | Tenant/expanded customer; risk payer mismatch handled in V1 list | Checks expanded customer ID and separately fetches billed customer; issuer snapshot-aware | Complete | [parties][parties], [dp][dp], [iq] | Verify historical snapshot versus current contact policy |
| 22 | Detail | Issuer contact consistency | Billing email in sampled detail | Help email in detail fallback; billing email in edit/create | Partial | Browser31 detail versus edit; [adapter], [parties] | Use consistent issuer contact policy |
| 23 | Detail | Payments and credit memos | Separate tabs | Separate queries/tabs with retry/truncation handling | Complete | Browser0/0 tabs; [dp], [view] | Persisted payment/refund scenarios unverified |
| 24 | Detail | Activity/metadata/related records | Metadata and related navigation; no equivalent full activity rail established | Backend activity rail plus editable metadata and Related links | Complete | Browser Activity and same metadata; [dp], [adapter] | Do not label general activity as provider-sync history |
| 25 | Edit | Due date/metadata/status | Existing edit page and endpoint sequencing | Equivalent edit page and chained update/payment/line/lifecycle calls | Complete | Browser edit; [ep][ep], [iq] runInvoiceEdit; tests | Persist each multi-step sequence and recovery |
| 26 | Edit | Line additions/updates/removes | Modify execute; replacement ID followed | Diffed lines; sequential removes/updates/adds, follows returned ID | Complete | [V1 edit][v1edit], [ep], [iq]; tests | Partial failure can leave saved intermediate changes |
| 27 | Edit | Finalized line-edit confirmation | Warns before void/copy workflow | Explains replacement and confirms before saving | Complete | Browser edit notice; [form] | Verify new draft/replacement IDs and original preserved |
| 28 | Edit | Due-date clear/time precision | Picker can carry timestamp; blank handling through update | Day-only edit sends midnight UTC; nullable clear field | Partial | Browser V1 time/V2 day; [ep], [iq] | Agree calendar-day contract and test clear serialization |
| 29 | Edit | Paid invoice row discoverability | Finalized paid invoice edit route/menu supported | Detail permits edit; list only draft/open/overdue | Partial | [v1menu], [rows], [view], [ep] | Offer allowed paid-invoice metadata/due-date edit from row |
| 30 | Lifecycle | Finalize/void | Dedicated endpoints and status menu | Dedicated endpoints, pending guards; void excludes paid/part-paid | Complete | [v1api], [dp], [rows], domain invoice | Execute disposable state-transition fixtures |
| 31 | Lifecycle | Recompute/recalculate | Compute draft/skipped; replace eligible finalized, block already replaced | Detail uses recalculate-v2 for draft; void+recalculate for unpaid; skipped blocked | Partial | [v1menu], [iq], domain invoiceRecalculation | Verify endpoint semantics/skipped behavior/replacement guard |
| 32 | Lifecycle | Manual payment status | Invoice/payment endpoint and state-specific transitions | Transitions plus succeeded-payment record guard; separate record-payment route | Complete | [payment rules][ps], [dp], [iq] | Verify server enforcement and partial amounts |
| 33 | Lifecycle | Retry collection/send | Payment attempt and comms trigger | Same endpoints, pending/error handling; retry when failed | Complete | [v1api], [iq], [view] | No actual collection or communication executed |
| 34 | Lifecycle | PDF/CSV/hosted URL | PDF presigned route, CSV charged lines, hosted URL | Same PDF route; raw-string CSV; hosted link resolved separately | Complete | [apii], [rows], [csv][csv]; tests | Verify actual downloaded artifact and provider link ownership |
| 35 | Lifecycle | Draft delete/duplicate/uncollectible | No connected workflow established in inspected V1 source | No equivalent proved; recalculate is not arbitrary Duplicate | Not Verified | [v1api], [v1menu], [rows] | Confirm actual baseline/service API, avoid invented gaps |
| 36 | Status | Document versus payment state | Separate wire status badges | Derived operational status plus inverse document label and payment column | Complete | Browser Finalized/Payment pending; [domain invoice][di] | Keep concepts distinct in filters and labels |
| 37 | Status | Partial refund/initiated distinctions | Separate labels for initiated/partially refunded | Domain folds initiated into pending and partial refund into refunded | Partial | [payment domain][pd], [v1list] | Preserve raw subtype for financial interpretation |
| 38 | Status | Missing-balance fallback | V1 displays wire document status directly | Absent amountRemaining becomes zero before Paid derivation | Broken | [iq] toInvoice, [di] deriveInvoiceStatus | Do not infer paid from unknown balance |
| 39 | Settings | Invoice configuration | Numbering/timezone/sequence/delay/due days/purchased-credit flag | Dedicated invoice panel and complete record mapper | Complete | [V1 settings][v1set], [V2 settings][set], schema/tests | Verify write preservation/reset and entity-owned prefixes |
| 40 | Settings | Timezone-aware example number | Timezone is configurable; example behavior needs baseline fixture | previewInvoiceNumber uses UTC calendar components regardless timezone | Partial | [config domain][config] | Label UTC or honor configured timezone; do not claim next sequence |
| 41 | Persistence | Full lifecycle end-to-end | Existing records read; no disposable mutation journey executed | Same limitation | Not Verified | Browser/read evidence and test log | Create/reload/edit/finalize/pay/void fixtures before sign-off |

## 6. Integration parity matrix

These rows cover central management, entity scope and the requested contextual actions independently. Backend support means a client/API contract was found, not a provider-side execution passed.

| # | Entity | Integration / feature | V1 action | V2 action | Backend support | Status | Evidence / required action |
|---|---|---|---|---|---|---|---|
| I1 | Central | All providers | Dedicated tools integrations catalogue and provider drawers | Dedicated sidebar/page plus reusable connect/manage sheets | Connections CRUD present | Complete | [V1 integrations][v1int], [V2 central][central]; browser four connected |
| I2 | Central | Credential connection | Provider drawers collect specific credentials | 14 self-serve specs; secret fields write-only in manage | POST/PUT connections represented | Complete | [connection specs][spec], [connection hooks][conn]; browser Stripe |
| I3 | Central | OAuth QuickBooks/Zoho | Init/complete callback plus session keys | Shared callback with session/code/state/realm/org checks | OAuth endpoints represented; consent not executed | Partial | [callback][oauth], [V1 OAuth][v1oauth]; Verify fresh consent, expired/denied states and reconnect |
| I4 | Central | Zoho invoice gateway settings | invoice_sync_settings.payment_gateways configuration | No gateway editor; nested settings projected away | Existing V1 connection payload demonstrates field | Missing | [V1 Zoho][v1zoho], [spec], [conn]; Restore gateway options, methods and round-trip |
| I5 | Central | Nested sync configuration preservation | V1 sends provider-specific nested settings | Connection mapper keeps only inbound/outbound; update copies reduced config | Service merge semantics not executed | Broken | [conn] toIntegrationConnection + [spec] toConnectionChanges; Preserve opaque nested settings on unrelated saves |
| I6 | Central | Environment/region settings | QuickBooks environment derived from Flexprice; Zoho regional server | QuickBooks defaults sandbox with freely selectable production; Zoho regions present | Environment header and metadata present | Partial | [V1 QB][v1qb], [spec]; Validate intended account/environment match |
| I7 | Central | Update/disconnect/reconnect | Provider edits and archive confirmation | Reusable manage, rotate supported secrets, disconnect confirmation | PUT/DELETE connections present | Complete | [central], [spec], browser manage; no save/disconnect executed |
| I8 | Central | Health/expired credentials | Connection presence and sync errors; full health dashboard not established | Connected means published connection, no live credential health feed | No verified health endpoint in inspected client | Not Verified | [conn], [V1 connection API][v1conn]; Separate configured status from verified healthy status |
| I9 | Central | Billing-entity connections | Baseline requires further V1 fixture | Provider page and entity-aware connection handling | billing_entity_id represented | Partial | [central], [conn], connectionForEntity; Test multiple accounts and entity-specific invoice targets |
| I10 | Customer | List three-dot push | No baseline provider-specific list push established | Mappings column only, no push row action | Generic sync can represent customer | Missing | [customer list][cl], [customer page][cdp]; Add requested contextual actions; distinguish new requirement from V1 baseline |
| I11 | Customer | Detail push | Integration card per-provider menu triggers generic push | Related combined push when eligible; not main More menu | POST integrations/sync customer id | Partial | [V1 mapping card][v1map], [cdp], [marks][marks]; Move/expose in main menu with accurate all-provider wording |
| I12 | Customer | Mapping/link/unlink | Customer-scoped IDs, external URL, timestamps | Customer-scoped ID/link/unlink; external URL dropped | GET mappings/link CRUD present | Partial | [customer mappings][cm], [marks]; Keep external URL and state; test returned mapping |
| I13 | Contract | List push/mapping | V1 subscription context distinguishes subscription mappings | No corresponding subscription mapping/push control | V1 generic entity_type subscription represented | Missing | [contract page][sdp], [entity hooks][entity] MappedEntityType; Add actual subscription scope after capability confirmation |
| I14 | Contract | Detail identity mapping | IntegrationMappingCard uses subscription ID | Reads customer mappings using customerId; badges show customer external IDs | Backend subscription mapping endpoint used by V1 | Missing | Browser Grp Parent; [sdp], [V1 subscription][v1sub]; Keep customer links explicitly separate; add subscription mappings |
| I15 | Contract | Provider push capability | V1 disables unsupported directions using current_config | No subscription push wired; Stripe spec only inbound subscription | Outbound subscription support must be confirmed per provider | Not Verified | [v1map], [spec]; Do not invent Push contract to Stripe from inbound support |
| I16 | Invoice | List three-dot push | V1 generic row menu lacks integration push; detail integration card has it | Row menu lacks push; mapping badges present | Generic invoice sync endpoint exists | Missing | [rows], [V1 menu][v1menu]; Implement explicit requested row action with capability gates |
| I17 | Invoice | Detail three-dot push | Provider integration-row menu exposes push/pull | Combined Related push; main More lacks push | POST integrations/sync invoice id | Partial | Browser invoice31; [dp], [marks]; Expose from main menu without pretending provider-selective execution |
| I18 | Invoice | Correct external invoice IDs | Chargebee26631/Stripe invoice ID from invoice mappings | Same IDs match; not customer IDs | GET integrations/mappings invoice id | Complete | Browser invoice31; [entity] fetchEntityIntegrationLinks |
| I19 | Invoice | Pull payment/status | Per-provider integration menu, config gated | Combined pull shown for configured inbound invoice sync | method pull; backend result not verified | Partial | [entity], [dp], [v1map]; Confirm supported invoice inbound directions and outcomes |
| I20 | Invoice | Open provider record | Uses mapping provider_url when safe | Mapping projection omits provider URL; copy ID only | V1 mappings response includes URL | Missing | [v1map], [cm] toIntegrationLinks, [marks]; Preserve safe URL and render contextual action |
| I21 | Shared | Dynamic provider resolution | Server base/current integration config drives action eligibility | Connection sync flags plus static provider catalogue | V1 GET integrations/config not consumed by V2 | Partial | [v1map], [entity], [spec]; Use authoritative capabilities, entity/state/permission gates |
| I22 | Shared | Provider-selective versus all-provider push | Per-provider-looking V1 menu still sends no provider | Truthful combined provider names, same generic request | No provider selector in inspected sync request | Partial | [API sync][sync], [V1 mapping API][v1mapi]; Agree provider-targeted backend contract or explicitly keep push-all |
| I23 | Shared | Queued versus completed state | Toast sync triggered | Toast Pushing, background description; no completion polling | Sync call only queues; mapping refresh immediate | Partial | [dp], [entity], [sync]; Track job completion/error, poll final mapping/status |
| I24 | Shared | Push double-click protection | isSyncing disables V1 integration menu | Push/pull Button has no pending prop or single-flight guard | Backend dedupe not verified | Partial | [v1map], [marks], [entity]; Disable during request; verify server idempotency |
| I25 | Shared | Linkable provider support | Connection/config-based rows, marketplace special cases | Any connected not-yet-mapped provider offered; no entity capability filter | Link endpoint acceptance unknown per provider | Partial | [entity] linkable; [spec]; Filter supported entities/account/environment and validate on server |
| I26 | Shared | Mapping timestamps and state | Created/updated plus optional provider URL | Timestamps retained in link model/tooltips; no sync-job state/history | Mapping presence is not completed recent sync | Partial | [cm], [marks], browser; Expose clear distinction and job errors/history |
| I27 | Other | Plan/payment mappings | V1 generic entity mapping card/API | V2 shared hooks allow invoice/plan/payment; customer separate | Generic mapping/link/sync represented | Partial | [entity] MappedEntityType; integration columns; Test actual supported provider/entity pairs independently |
| I28 | Other | Marketplace associations/usage | AWS/GCP/Azure map customer/subscription/plan; usage reporting separate | Central specs plus usage-sync pages; contract customer marks insufficient | Usage job and mapping contracts separate | Partial | [spec], [V1 mapping card][v1map], query usageSyncs.ts; Verify marketplace entity mappings, contracts and usage outcomes |
| I29 | Other | S3 export connector | S3 drawer under export workflow | Separate Exports/S3 connection pages | Connections plus export API represented | Complete | apps/console/src/pages/exports/S3ConnectionsPage.tsx; V1 S3 drawer; Do not list S3 as invoice push provider |
| I30 | External | Success/retry/duplicate/void propagation | No controlled external test executed | Existing mapping read only; no new push verified | Worker/provider implementation unavailable in these repos | Not Verified | Audit execution log; Run sandbox provider journey with isolated disposable entities |
| I31 | Permissions | UI/server role enforcement | V1 connection and invoice write checks; integration-card baseline mixed | Shared action scopes exist; all connect/push/link roles not exercised | Backend must enforce tenant/env/entity permissions | Not Verified | [V1 menu][v1menu], [central], [marks], [entity]; Exercise reduced roles and direct API denial cases |
## 7. Centralized Integrations section

### What exists

V1 `/tools/integrations` and V2 `/integrations` are independent of invoice settings. V2 has a main-sidebar Integrations entry, connected/available groups, provider search/category filtering, connect sheets, manage sheets and provider-specific connection pages when billing entities are enabled. The central-section requirement is already substantially met; a new parallel settings destination is not needed.

V2 connects from a registry in `packages/domain/src/integrationConnect.ts`, rather than duplicating each provider drawer. Credential-based providers create a connection through `POST /connections`. QuickBooks and Zoho use `/oauth/init`, save non-secret pending-session context, redirect to the provider, and complete through `/oauth/complete` at `/tools/integrations/oauth/callback`. The callback checks code, state, pending session and provider-specific realm/organization fields. It handles denial/missing-state/expired local context. Actual provider consent, state validation by the backend and token refresh were not executed.

The saved Stripe configuration was browser-compared without saving. Its name and sync directions matched. Existing credential fields were blank in V2 manage, with “Leave blank to keep the current value.” This is appropriate: a frontend must not reconstruct or display a saved secret. The write field name `encrypted_secret_data` does not prove client-side encryption; the client transmits entered credentials to the configured API over the connection workflow, and encryption at rest is a backend concern. No credential values were read from environment files or entered into these forms during this audit.

### Connection presence is not health

V2 labels a provider Connected when a published connection is present. That is a configuration fact, not proof that the credentials still authenticate, the webhook is registered, an OAuth token refreshed, or the last invoice sync succeeded. `webhook_secret_set` can signal a missing configured webhook secret, but is not a general health monitor. Last successful/failed sync and per-entity error state need a real service feed. Neither frontend’s mere catalogue presence establishes complete health visibility.

V2’s connection query paginates all published connections. The catalogue join still limits visible providers to known specs. Premium placeholders are deliberately filtered by `IntegrationsBlock`; S3 is intentionally handled under Exports. These distinctions are sensible, but unfamiliar published providers must not silently disappear from administration without a diagnostic path.

### Confirmed connection data-loss path

V1 Zoho stores:

```json
{
  "sync_config": {
    "invoice": { "inbound": false, "outbound": true },
    "customer": { "inbound": true, "outbound": false },
    "invoice_sync_settings": {
      "payment_gateways": {
        "enabled": true,
        "gateways": ["paypal"],
        "paypal_payment_method": "standard"
      }
    }
  }
}
```

This is a structural illustration from the V1 payload builder, not a captured credential-bearing request. V2 `toIntegrationConnection` loops each sync_config object and retains only boolean inbound/outbound. The `invoice_sync_settings` object therefore becomes `{}`. `toConnectionChanges` starts with the already projected `connection.syncConfig`; if a known sync switch changes, the update includes the reduced nested object. The frontend has lost information before the service sees the request.

This is counted Broken at the mapping/request-construction layer. Whether the deployed backend merges, ignores or replaces the nested object was not tested, so no saved connection was deliberately corrupted to demonstrate it. The implementation must preserve opaque provider-specific settings even when the current UI does not edit them. V1’s gateway editor also needs an equivalent V2 control, not just opaque preservation.

AWS’s region is another example of sync_config containing something other than entity direction flags. It is written under `sync_config.aws_marketplace`; the same projection cannot faithfully represent that full object on read. Do not model every sync_config entry as a pair of booleans.

### Environment and account behavior

All inspected raw connection operations use the configured API base and `X-Environment-ID`. Both browsers were kept in Harshit’s home sandbox. V1 derives QuickBooks sandbox/production from the active Flexprice environment and presents it read-only. V2’s generic QuickBooks spec defaults to sandbox and offers both sandbox and production without an equivalent environment-coupling guard in this spec. This is a concrete configuration-policy difference, not a demonstrated cross-environment data leak.

Zoho’s regional accounts server is explicitly represented, including India, US, Europe, Australia and Japan. Webhook URLs incorporate tenant/environment, and optionally connection ID where billing-entity/per-connection mode is used. Marketplace external IDs include tenant/environment. An OAuth return after an environment switch, an entity-owned connection in a different account, and stale cache across environment changes remain test cases requiring backend enforcement evidence.

### Security and permissions boundaries

V1 central connection cards inspect connection/write permission. V2 routes use `RouteAccessGate`/`AccessScope`; `/integrations` is a connection-read route, while invoice create/edit routes explicitly require writes. Shared `EntityList` row actions use write checks. However, the examined invoice detail `MenuAction`, integration Related push buttons and connect/manage surfaces do not themselves consume the same write gate in those components. Read access to a page must not be treated as proof that each mutation control is permission-aware.

This is an action-gating coverage concern, not a claim of a backend authorization bypass. Only the existing account was used. A reduced-role browser and direct forbidden-request checks are still required. Backend tenant/environment/entity permissions must remain authoritative regardless of UI gating.

## 8. Entity-level push actions

### Location and scope matrix

| Entity surface | Actual V1 location | Actual V2 location | Assessment against requested interaction |
|---|---|---|---|
| Customer list row | No provider-selective push established in inspected global row menu | Customer integration marks, no push action in list wiring | Requested contextual push is missing; do not claim V1 list parity without evidence. |
| Customer detail main menu | Integration actions primarily in IntegrationMappingCard row menus | Main detail has customer operations; mapping/push in Related | Aggregate customer push supported in source when customer outbound is on, but not in the requested main three-dot menu. |
| Contract list row | Subscription navigation/lifecycle; provider-specific list push not established | No subscription-scoped provider push/mapping hook | Missing requested action. Must first confirm actual outbound support per provider. |
| Contract detail | IntegrationMappingCard with `entity_type=subscription`, using subscription ID | `useCustomerIntegrationLinks(customerId)`, customer link/unlink marks | Not equivalent. The copied IDs are correctly labeled customer IDs, but do not describe external contracts. |
| Invoice list row | Invoice lifecycle menu; no integration push established | Invoice lifecycle menu and mapping badges, no push | Requested row push missing in V2; a requirement beyond the established V1 row baseline. |
| Invoice detail main three-dot | Invoice lifecycle actions; integrations have their own row menus | Same lifecycle menu, no push/pull entry | Requested central contextual access is missing. |
| Invoice detail integration rows | Per-provider-looking menu with generic Push/Pull to Integration | One combined Related action, e.g. Push to Stripe, Razorpay, Chargebee, Zoho | Functionally queues generic sync but offers no chosen-provider targeting. |
| Mapping/header mark menu | Link/unlink and provider record access in V1 card | Copy ID/unlink via header/Related menus | V2 drops the provider URL and offers no open-record action. |

The inspected Stripe configuration has customer outbound off. A missing **enabled customer push** in this live account cannot itself prove the source path is missing; the source has the callback and appropriately computes no Stripe customer push target in that configuration. By contrast, invoice outbound is enabled and the combined invoice action is visible.

### Generic push is not provider-selective

Both clients’ inspected synchronization body is:

```json
{
  "entity_type": "invoice",
  "entity_id": "inv_example",
  "method": "push"
}
```

There is no provider or connection selector. The V1 menu visually belongs to one provider row but still calls this generic endpoint. V2’s combined names describe that fan-out more honestly, but the requested “Push to this provider” behavior cannot be obtained simply by rendering one menu item per provider while sending the same body.

Before adding provider-specific menu items, either establish a supported targeted backend operation or label the operation explicitly as pushing to **all eligible integrations**. Do not simulate targeting by temporarily changing global sync settings. Capability resolution must consider connected state, supported entity/direction, invoice state, billing entity/account, mapping state and permissions. V2 currently derives provider names mostly from connection sync flags; it does not consume V1’s `/integrations/config` authoritative base/current capability information.

### Queue acknowledgment, retry and concurrency

`POST /integrations/sync` queues work. V2 says Pushing and describes background work; it does not falsely say the external invoice is already synced. That is good copy. But it refreshes mapping queries immediately without tracking a returned job, completion, provider errors or a later mapping appearance. A successful HTTP acknowledgment can therefore leave old mappings on screen after the actual job finishes.

The shared Related push/pull Buttons do not receive mutation pending state, and no single-flight ref is wired for these sync actions. Repeated clicks can queue more than one request; backend idempotency remains unverified. V1 disables its integration menu while isSyncing. V2 invoice lifecycle actions separately have an in-flight guard, which does not protect integration pushes.

There is no dedicated failed-sync item with error reason/retry count/history in the inspected entity read model. Repeating the generic push is not proof of a safe retry, upsert or duplicate protection. Backend worker/provider evidence must distinguish create-only, update-only, upsert and explicit re-sync. This audit does not assume any of those outcomes from a button.

### Correct mapping identity

The sampled invoice’s Chargebee26631 and Stripe invoice ID match V1. This read path calls mappings with `entity_type=invoice` and the invoice’s internal ID. It is correctly distinct from customer mappings.

The contract sample shows the opposite scope issue: V1 subscription mapping IDs are all absent, while V2 displays mapped customer IDs. The same customer may have several contracts, so reusing customer association data cannot answer which external subscription/deal/quote corresponds to this contract. The contract view may retain a clearly labeled “Customer integrations” summary, but needs a separate subscription-scoped mapping model. An external Stripe customer ID must never be passed as an external subscription ID.

V2 `toIntegrationLinks` retains one published mapping per provider, trimming provider/external IDs and keeping created/updated timestamps. It drops `provider_url` and collapses multiple same-provider records to the first. A single mapping per provider may match a backend uniqueness rule, but multi-connection/billing-entity behavior must be verified rather than assumed. A published mapping proves an association exists; it is not the latest push’s completion state or a synchronization history.

## 9. API and backend dependencies

### Invoice endpoints and payloads

Paths below are relative to the configured API `/v1` base. V1 uses Axios snake_case DTOs. V2 reads invoices through a raw adapter plus `fromWire`, and writes many operations through generated SDK camelCase models/outbound snake_case serializers. CamelCase in mapper source alone is not a mapping defect.

| Operation | Method / endpoint | Mapping and evidence |
|---|---|---|
| Search | `POST /invoices/search` | V2 maps limit/offset, sort, invoice-number contains filter, customer/entity scope and all stored statuses; skips line items for lists. Derived Paid/Overdue filtering is page-local and explicitly labeled. |
| Read invoice | `GET /invoices/{id}` | Raw adapter preserves available response fields; `toInvoiceDetail` then narrows them. Missing applied taxes/grants are projection omissions, not proof the API lacks them. |
| One-off create | `POST /invoices` | Customer, currency, ONE_OFF, MANUAL, dates, draft/finalized, amounts, lines, taxes, optional number/memo/metadata. V2 form computes line amount from quantity×unit input; API amount is the line total. |
| Edit own fields | `PUT /invoices/{id}` | V2 dueDate, metadata and applyDiscount. Customer/currency/issue date/description are read-only after create in the UI; not a universal invoice replacement payload. |
| Modify lines | `POST /invoices/{id}/modify/execute` | Remove/update/add operations, follow returned replacement invoice ID. Untouched lines omitted; finalized edits can return a draft copy. |
| Payment status | `PUT /invoices/{id}/payment` | Uppercase payment state; optional partial amount for Pending. Separate from recording a Payment entity or charging a gateway. |
| Status transition | V1 `PUT /invoices/{id}/status`; dedicated finalize/void in both | Dedicated `POST /finalize` and `/void` are used by V2 lifecycle actions. Valid server states must be verified independently. |
| Collection attempt | `POST /invoices/{id}/payment/attempt` | V2 Retry payment callback; no collection attempted in this audit. |
| Comms | `POST /invoices/{id}/comms/trigger` | Triggers configured communication, not provider sync; no email/message was sent. |
| Preview | `POST /invoices/preview` | Existing contract invoice preview path. Not wired as a new one-off authoring server preview. |
| Recompute draft | V1 `POST /invoices/{id}/compute?sync=true`; V2 `POST /invoices/{id}/recalculate-v2` | Different operations must be verified against service semantics. V1 includes skipped compute; V2 detail currently blocks skipped recalculation. |
| Recalculate replacement | `POST /invoices/{id}/recalculate` | V2 detail may void unpaid finalized invoice first, then queue replacement; existing refs prevent repeating void in that mounted detail attempt. Full replacement guard/history still needs testing. |
| PDF | `GET /invoices/{id}/pdf?url=true` | Resolves presigned PDF URL; tests verify endpoint/header. Read may render missing PDF server-side. No actual exported file was inspected this run. |
| Hosted URL | Invoice hosted-link adapter | V2 resolves separately from narrowed invoice domain; hosted payment page is distinct from external mapping provider_url. |
| Invoice config | `GET/PUT/DELETE /settings/invoice_config` | Environment-specific full record; complete-field preservation and reset confirmation. Billing entity may own prefix. |

An edit is a sequence of operations, not a proven transaction: own fields, payment status, line mutations, final lifecycle operation. Source/tests follow replacement IDs correctly, but a later error can occur after an earlier write succeeds. Retry must not duplicate lines or repeat void/finalize, and the UI must explain any partial save. No such mutation was executed here.

### Integration endpoints and identifiers

| Operation | Method / endpoint | Important fields / limits |
|---|---|---|
| List/current connection | `GET /connections`, `GET /connections/{id}` | Published connection records, provider_type, metadata, sync_config, billing_entity_id, created_at. V2 paginates list; projection currently loses non-direction settings. |
| Connect/update/archive | `POST /connections`, `PUT /connections/{id}`, `DELETE /connections/{id}` | Credentials under encrypted_secret_data; settings under metadata/sync_config. Delete is archive in the frontend contract; provider records are not claimed deleted. |
| OAuth | `POST /oauth/init`, `POST /oauth/complete` | Provider, credential material at init; session/code/state plus realm/organization at complete. No fresh authorization executed. |
| Authoritative integration capabilities | V1 `GET /integrations/config` | integrations[].provider plus base_config/current_config by entity. V2 does not consume this in the inspected entity resolver. |
| Read mappings | `GET /integrations/mappings?entity_type=…&entity_id=…` | Provider type/external ID/URL, internal entity ID/type, status, timestamps. V2 invoice path uses invoice ID; contract context currently uses customer path. |
| Link/unlink | `POST /integrations/link`, `DELETE /integrations/link` | entity_type, entity_id, provider_type, provider_entity_id as appropriate. Manual association is not a successful sync. |
| Queue push/pull | `POST /integrations/sync` | entity_type/entity_id/method only; no selected-provider parameter in inspected client contract. Worker transformation and idempotency unavailable here. |
| Legacy secrets integration | V1 `/secrets/integrations/{provider}` and linked/by-provider reads | Legacy IntegrationsApi exists; current central drawers principally use connections. API file presence does not prove a separate working UI journey. |
| Alternative entity-mapping CRUD | V1 `/entity-integration-mappings` | Distinct API DTO exists. Do not conflate its external_id field with current `/integrations/mappings` provider_entity_id projection. Establish active callers before replacing endpoints. |
| Webhooks | Provider/tenant/environment, optionally connection-ID route | Both frontends display registration addresses/events. Backend signature validation, event dedupe, payment ingestion and void propagation were not inspected in a backend repository. |

The browser’s existing Stripe/Chargebee invoice IDs establish persisted associations already exist. They do not prove how Flexprice line amounts, taxes, discounts, credits, due dates or payment states were transformed into those provider records. The actual provider transformation is not implemented in these frontend repositories: only the entity ID is sent to sync. Full bidirectional synchronization, automatic finalization/void mirroring and external duplicate prevention must not be claimed from these clients.

### Required external journey and edge-case evidence

| Scenario | Evidence established | Still required |
|---|---|---|
| No connections | Source computes no push targets from empty connection set | Browser with isolated empty test environment; no incorrect actions. |
| Multiple connections | Four providers visible and combined invoice push named | Correct account/billing entity routing; provider-side record for each intended target. |
| Unsupported provider/entity | Static sync specs omit unsupported directions | Authoritative capability filtering for push, pull and manual link; direct server rejection. |
| Customer missing/existing mapping | Customer hooks use customer ID; current Stripe customer outbound off | Controlled enable/test account; push/re-push and verify no duplicate customer. |
| Contract sync | V1 subscription mapping API; V2 missing scope identified | Confirm provider-specific support before implementing/dispatching. |
| Unmapped/mapped invoice | Existing mapped invoice read verified | Queue push, track job success, verify external invoice and returned mapping; repeat safely. |
| Failure/retry | Error callbacks exist | Invalid/expired test credentials and failed dependency cases; error detail, safe retry and completion. |
| Draft/void invoice | Lifecycle guards inspected; sync state not fully gated | Provider-valid operation restrictions and actual external void/draft behavior. |
| Disconnect/reconnect | Confirmed dialog/source operations | Isolated connection archive/reconnect; actions refresh and old mappings handled correctly. |
| Concurrent/duplicate push | V2 missing UI pending protection identified | Single-flight UI and backend idempotency under simultaneous requests. |
| Sandbox/Production mismatch | Current sandbox header and QuickBooks policy difference | Cross-environment IDs denied; provider account mode checked; OAuth return after switch rejected or routed safely. |
| External record exists | Manual link model exists | Link existing external ID; verify owner/account/type, upsert policy and no duplicate invoice. |
| Webhook status update | Event guides and inbound specs exist | Signed duplicate/out-of-order events, refund/partial-refund and failure propagation. |

### Test commands and limits

```text
# V2
pnpm nx run @fp/query:test -- src/invoices.test.ts src/invoiceRequests.test.ts src/integrations.test.ts src/entityIntegrationLinks.test.ts
# 39 passed /4 files
pnpm nx run @fp/domain:test -- src/invoice.test.ts src/invoicePaymentStatus.test.ts src/invoiceRecalculation.test.ts src/integrationConnect.test.ts src/connectionId.test.ts src/settings/invoiceConfig.test.ts
# 78 passed /6 files
pnpm nx run console:test -- src/pages/invoices/invoiceDocumentAdapter.test.ts src/pages/invoices/invoiceParties.test.ts src/pages/invoices/invoiceCsv.test.ts
# 11 passed /3 files
pnpm nx run @fp/api:test -- src/invoices.test.ts
# 2 passed /1 file

# V1, using its installed runner without changing package-manager state
node node_modules/vitest/vitest.mjs run src/pages/customer/invoices/EditInvoicePage.test.tsx src/components/molecules/InvoiceTable/InvoiceTableMenu.test.tsx src/components/molecules/MoyasarConnectionDrawer/MoyasarConnectionDrawer.test.tsx src/utils/common/connection_metadata_helpers.test.ts
# 43 passed /4 files
```

No full build/lint, live payment test, provider OAuth consent, external sync E2E, role-switch browser suite or small-viewport matrix was run. Existing tests do not cover every mapping concern found in this audit. In particular, passing current connection tests does not establish opaque nested sync_config preservation.

## 10. Critical workflow gaps and data meaning

### V2 mapping: correct, missing, misleading or extra

| Data / display | Finding | Does it make sense? / decision |
|---|---|---|
| Invoice number | Same stored number in both detail views; no fabricated ID-as-number fallback | Keep. Draft placeholder should remain distinct from a real assigned number. |
| Billed customer | V2 validates expanded customer ID and loads customer_id separately | Correct association strategy. Preserve service-customer separately for grouped invoicing; do not silently discard that second identity. |
| Contract reference | V2 retains subscription_id and opens contract route | Correct ID, but raw ID label is weak for people. Resolve a meaningful plan/customer label without confusing it with an invoice number. |
| Document badge | V2 detail shows Finalized, not Pending; optional list status uses document projection | Correct for sampled known states. Hidden-by-default status is a discoverability tradeoff, not wrong mapping. |
| Payment badge | Pending/Succeeded match sampled records | Preserve partial-refund/initiated distinctions where operators need them. V2’s domain compression is lossy. |
| Unknown/missing balance | moneyOr turns missing amountRemaining into zero; derivation can return Paid | Incorrect certainty from missing data. Counted Broken at mapping layer; no failing production invoice was attributed to this path. Use explicit unknown or supported fallback. |
| Amount versus amount due | V2 list Amount=total, Amount due=amountRemaining | Useful extra column: settled110 invoice can show110 and0. “Remaining balance” would align directly with source semantics; do not replace original amount_due value in the model. |
| Subtotal/tax/total/paid/remaining | Sampled API figures match110/2.20/112.20/0/112.20 | Keep authoritative totals. Do not reconstruct invoice total by summing currently visible/nonzero lines. |
| Money display conversion | Query keeps decimal strings, document adapter converts through Number | Source-supported precision risk for very large/high-precision values, not a reproduced mismatch in this sample. Format exact money rather than silently converting an entire billing document to binary floats. |
| Unit price | Extra column reads price by ID or derives exact reversible quotient; sampled Base/Seat show dash | Guarded blank is preferable to a fabricated tier/package rate. Resolve why basic fixed rates are unavailable (price load/model/identity transform) before treating this column as useful coverage. Do not infer from rounded amount/quantity when it cannot reproduce the actual rate. |
| Zero-amount charge lines | V2 removes them with line.amount!==0 and has no show-zero control | Missing audit information, not unnecessary data. Included allowances/free usage can matter even when monetary amount is zero. |
| Applied tax | V2 preserves totalTax but not tax_summary/applied tax rows | Total is correct but insufficient to explain jurisdiction/rate/exemption/inclusive behavior. Restore breakdown on demand. |
| Credit/allowance data | Aggregate prepaid credits retained; grant allowance metadata not carried through line projection | Missing explanation. Distinguish credit-note adjustments, prepaid wallet credits, coupons and included allowance. They are not interchangeable “credits.” |
| Line names/subtitles | V2 can show Base, Fixed charge, Base (Fixed Charge) | Redundant extra display in this sample. Keep meaningful note; suppress exact/semantic repetition rather than removing all descriptions. |
| Bill-from address/contact | Issuer snapshot used when supplied; otherwise current tenant fallback | Snapshot preference is sound. Detail fallback prefers helpEmail, create/edit uses billingEmail; reconcile or label intended contact. Do not claim a source address changed on the stored invoice. |
| Bill-to address | Current customer lookup used when available | Identity is safer than wrong expanded customer. Historical contact snapshot policy remains unverified; a current customer address is not necessarily the issued document’s frozen address. |
| Service period | V2 uses UTC dates and displays inclusive-looking start–end labels | Preserve exact endpoints and explain end exclusivity consistently. No observed amount mismatch from these labels. |
| Invoice integration IDs | Same invoice mapping IDs in both browsers | Correct and useful. Existing mapping is not proof of latest successful push or correct external invoice content. |
| Contract integration marks | V2 shows customer external IDs, not subscription mapping IDs | Useful only if explicitly customer context; insufficient/misleading as contract sync evidence. Add real subscription mapping panel/actions. |
| Header badges + Related mappings | Compact provider marks repeated as detailed IDs/actions | Reasonable summary/detail split. Avoid a third redundant full mapping table. |
| Hosted invoice URL in metadata and Related | Same payment link can appear as a long raw metadata value and a usable link | Usable link is useful. Raw operational metadata can be collapsed/read-only technical detail; do not imply it is the provider management record URL. |
| Activity rail | Backend activity events distinguish user/workflow updates | Useful extra audit context. Repeated workflow events can be grouped, but must not be presented as sync history unless they contain actual sync outcomes. |
| Connection Connected label | Published connection exists | Valid configuration status, not live health. Label configured/connected with unknown health if needed. |
| Provider nested settings | sync_config narrowed to direction flags | Incorrect loss of provider data. Preserve raw provider options even when hidden from the editor. |
| Settings example invoice number | Example uses UTC and configured start sequence, not actual next counter | Extra preview is useful only as an example. Respect configured timezone or explicitly state UTC; never imply it is the next issued number. |
| Purchased-credit completion flag | V2 models a persisted invoice-config field alongside numbering/delay | Not “extra junk”: preserving an otherwise hidden stored field avoids resetting it on unrelated saves. Its placement/copy can be improved. |

### Journeys that cannot yet be signed off

- Explain an invoice’s complete tax and allowance allocation, including zero-cost lines, solely through V2 detail.
- Manage Zoho’s V1 invoice payment gateways or safely guarantee opaque nested provider settings survive a V2 sync-setting edit.
- Read/link/push the **contract’s own** external subscription identity through V2; customer marks do not fulfill this journey.
- Use a main customer/contract/invoice row/detail menu to target a single connected provider, with authoritative capability checks and no unintended fan-out.
- Watch a queued invoice push through provider completion/failure, inspect the external mapping/record URL and retry with proven duplicate safety.
- Demonstrate full invoice create/edit/finalize/payment/refund/void/communication persistence or external bidirectional behavior from this audit’s unit/browser reads alone.

V2’s invoice lifecycle is substantially implemented; it is not accurate to label the whole module missing. Nor is it accurate to sign off complete invoice/integration parity based on these passing unit tests and correct sampled totals. The remaining work is both frontend fidelity and controlled backend/provider verification.

## 11. Prioritized implementation checklist

These are proposed tasks; no code changes were made. P0 items are limited to concrete correctness risks, not every missing convenience. Use V2 kit components and its existing page/query/domain separation; do not recreate V1 markup or provider-specific copy/paste drawers.

| Priority / task | Exact problem / expected behavior | Relevant V2 files | API/backend dependency | Acceptance criteria |
|---|---|---|---|---|
| P0 — preserve opaque sync settings | Direction-only mapper drops nested Zoho/AWS configuration; retain full provider-specific objects and update only intended paths | [conn] toIntegrationConnection; [spec] ConnectionFormValues/toConnectionChanges; domain integration.ts | Verify PUT merge/replacement semantics | Seed Zoho invoice_sync_settings.payment_gateways and AWS region plus unknown keys; rename and toggle known sync separately; inspect outgoing payload/reload and assert every unrelated nested value survives. |
| P0 — unknown balance must not mean Paid | Missing remaining balance defaults zero before status derivation | [iq] toInvoice; [di] deriveInvoiceStatus | Confirm response-required fields and safe fallback policy | Missing/null/unknown balance with Pending cannot silently become Paid; zero valid balance and terminal states still correct; same result across list/detail/contract invoice table. |
| P1 — subscription-scoped integration identity | Contract page uses customer integration links and excludes subscription from generic mapped union | [sdp], [entity], [marks], contract domain types | `/integrations/mappings` with subscription entity; confirm outbound provider support | Customer and subscription external IDs differ in fixture; page shows both accurately, copies correct type, link/unlink targets subscription ID, inbound-only Stripe subscription does not gain fake outbound push. |
| P1 — requested three-dot sync actions | Row/main detail menus lack requested integration operations | [rows], [view], [cl], [cdp], contract list/detail, shared action resolver | Authoritative capabilities and possible provider-targeted sync API | Every supported customer/contract/invoice surface exposes correct actions; unsupported/disconnected providers absent; mapped/unmapped/state/role/account cases tested; a named provider action never silently pushes all providers. |
| P1 — capability/account resolver | Connection flags are treated as capabilities; invoice resolver aggregates across any connection | [entity], [conn], [cdp], [spec] | V1 `/integrations/config` or approved capability service; billing-entity routing | Two entities with different provider accounts show only correct invoice targets; base/current capability, direction, state and role all gate actions; correct internal ID and environment header sent. |
| P1 — tax/allowance data fidelity | Aggregate totals omit applied-tax and grant explanation structures | [iq] InvoiceDetailWire/toInvoiceDetail; domain invoice.ts; [adapter]; [view] | Existing invoice tax/grant response fields, possible association query | Sample2% exclusive tax shows taxable 110/tax 2.20 and source; inclusive/exempt/multiple-tax fixtures work; allowances/prepaid/coupon/credit-note amounts distinct; totals remain server authoritative. |
| P1 — sync queued/completed/error model | Immediate mapping refresh after queue has no completion/history tracking | [entity], [dp], shared sync hook/API | Job/status/error/correlation endpoint or workflow events | Queued/syncing/completed/failed states accurate; success only after external confirmation; mapping refresh after completion; visible provider error and retry; no optimistic Synced badge. |
| P1 — safe concurrent push/retry | Related sync buttons have no pending/single-flight binding | [marks], [entity], [cdp], [dp] | Backend idempotency/deduplication key/semantics | Double-click sends one UI request; two clients cannot create duplicate external records; mapped re-push performs agreed update/upsert; failed retry does not duplicate. |
| P1 — permissions coverage | Detail/Related/central mutation controls do not consistently use shared write gates | [view] MenuAction; [marks]; integrations sheets; route access definitions | Backend connection/invoice/customer/subscription write permissions | Read-only role can inspect but not connect/save/unlink/push/finalize; direct requests denied server-side; permitted reader still downloads/copies/navigates. |
| P1 — environment policy | QuickBooks account mode differs from V1 environment coupling; OAuth return/account selection unverified | [spec], useIntegrationSheets.tsx, [oauth], oauthSession.ts | Tenant/environment/session/account enforcement | Sandbox cannot accidentally target production under approved policy; explicitly intentional cross-mode use labeled/validated; OAuth callback after environment switch safe; region and webhook route match connection. |
| P2 — Zoho gateway editor | V1 gateway list/PayPal method absent in V2 | [spec], ConnectionFields.tsx, ManageConnectionSheet.tsx | `sync_config.invoice_sync_settings.payment_gateways` support | Enable/disable and choose supported gateways/method; validate nonempty enabled list; read/edit/save/reload retains V1 values; no rewrite on unrelated save. |
| P2 — provider record URL and mapping state | provider_url lost; mapping presence substitutes for richer record info | [cm] toIntegrationLinks; domain IntegrationLink; [marks] | Mapping response URL/status/account identity | Safe external URL retained and openable; timestamps meaningful; unknown URL/state shown as unknown; multiple same-provider account fixtures follow server uniqueness rule. |
| P2 — zero charges and service-customer identity | Zero rows always filtered; grouped payer/service customer distinction dropped | [view], [iq], [grid], [adapter] | Existing invoice fields | Toggle zero lines without altering totals; grouped invoice shows billed and service customer separately; related links use correct IDs. |
| P2 — refund/unknown payment fidelity | Partial refunds/initiated/unknown states compressed | [pd], query payments.ts, [iq], badges | Confirm wire states and transitions | Full versus partial refund visible with correct amounts; initiated not claimed completed; unknown states not silently inferred as Pending/Paid; action eligibility remains safe. |
| P2 — recalculate parity and repeat prevention | V1 compute/skipped versus V2 recalculate-v2/detail restrictions; row/detail mismatch | [iq], [di], [rows], [dp] | Confirm compute/recalculate-v2/recalculate semantics and replacement marker | Draft/skipped/finalized/void/manual/part-paid/already-replaced fixtures show valid options, explicit confirmation and correct endpoint; replacement not queued twice. |
| P2 — multi-step edit recovery | Sequential update/payment/line changes can partially persist; replacement IDs must survive retry | [ep], [iq] runInvoiceEdit/applyLineChanges | Transaction/correlation support or explicit resumable steps | Inject failure after each operation; display actual persisted invoice/new ID; retry adds no duplicate line and never re-voids old record; unaffected line IDs unchanged. |
| P2 — catalogue/filter scope | First100 customer/rate choices; derived statuses only narrow fetched page | [list], [cp], [iq], [grid] | Server search/derived-status support | Find customer beyond100, correct counts/pagination, no false empty-ledger conclusion; derived page-local scope obvious unless moved server-side. |
| P2 — exact money and meaningful rates | Document adapter converts decimals to Number; added rate column often blank | [adapter], [view], invoiceDocument types | Stable historical price read and transform semantics | High-precision/large/tier/package/custom-unit examples retain exact totals; plain fixed rate available where supported; never print rounded quotient as actual historical rate. |
| P3 — display density and clear labels | Repeated line type/note, technical memo/raw URL, ambiguous Amount due/contact labels | [adapter], [view], [grid], [parties] | None beyond product vocabulary/snapshot policy | Preserve audit detail on demand; concise unique line labels; Remaining balance meaning explicit; identical contact source across create/edit/detail or intentional labeled difference. |
| P3 — honest configured health/preview | Connected is not health; invoice-number example uses UTC regardless timezone | integrations UI, [config], [set] | Health feed if added; actual next sequence not exposed | Label configured versus verified health; no fabricated last sync; example respects timezone and says example, not next number. |

### Evidence files

- [V1 central Integrations](audit-evidence/invoice-integrations/v1-central-integrations.png), [V2 central Integrations](audit-evidence/invoice-integrations/v2-central-integrations.png); [V1 catalogue DOM](audit-evidence/invoice-integrations/v1-central-integrations.txt), [V2 catalogue DOM](audit-evidence/invoice-integrations/v2-central-integrations.txt).
- [V1 invoice detail](audit-evidence/invoice-integrations/v1-invoice-detail.png), [V2 invoice detail](audit-evidence/invoice-integrations/v2-invoice-detail.png); corresponding [V1 DOM](audit-evidence/invoice-integrations/v1-invoice-detail.txt) and [V2 DOM](audit-evidence/invoice-integrations/v2-invoice-detail.txt).
- [V1 staged calculation](audit-evidence/invoice-integrations/v1-create-calculation.png), [V2 staged calculation](audit-evidence/invoice-integrations/v2-create-calculation.png); [V1 create fields](audit-evidence/invoice-integrations/v1-create.txt), [V2 create fields](audit-evidence/invoice-integrations/v2-create.txt).
- [V1 edit fields](audit-evidence/invoice-integrations/v1-edit.txt), [V2 edit fields](audit-evidence/invoice-integrations/v2-edit.txt).
- [V1 Stripe configuration](audit-evidence/invoice-integrations/v1-stripe-config.png), [V2 Stripe configuration](audit-evidence/invoice-integrations/v2-stripe-config.png); [V1 settings DOM](audit-evidence/invoice-integrations/v1-stripe-config.txt), [V2 settings DOM](audit-evidence/invoice-integrations/v2-stripe-config.txt).
- [V1 subscription integration inventory](audit-evidence/invoice-integrations/v1-contract.txt), [V2 customer mappings in contract context](audit-evidence/invoice-integrations/v2-contract.txt), [V2 contract screenshot](audit-evidence/invoice-integrations/v2-contract-customer-marks.png).

### Source references

[v1list]: ../../flexprice-front/src/pages/customer/invoices/InvoicePage.tsx
[v1create]: ../../flexprice-front/src/pages/customer/invoices/CreateInvoice.tsx
[v1edit]: ../../flexprice-front/src/pages/customer/invoices/EditInvoicePage.tsx
[v1menu]: ../../flexprice-front/src/components/molecules/InvoiceTable/InvoiceTableMenu.tsx
[v1lines]: ../../flexprice-front/src/components/molecules/InvoiceLineItemTable/InvoiceLineItemTable.tsx
[v1api]: ../../flexprice-front/src/api/InvoiceApi.ts
[v1set]: ../../flexprice-front/src/pages/settings/billing/InvoiceConfigurationSection.tsx
[v1int]: ../../flexprice-front/src/pages/insights-tools/integrations/Integrations.tsx
[v1conn]: ../../flexprice-front/src/api/ConnectionApi.ts
[v1mapi]: ../../flexprice-front/src/api/IntegrationMappingApi.ts
[v1map]: ../../flexprice-front/src/components/molecules/IntegrationMappingCard/IntegrationMappingCard.tsx
[v1zoho]: ../../flexprice-front/src/components/molecules/ZohoBooksConnectionDrawer/ZohoBooksConnectionDrawer.tsx
[v1qb]: ../../flexprice-front/src/components/molecules/QuickBooksConnectionDrawer/QuickBooksConnectionDrawer.tsx
[v1oauth]: ../../flexprice-front/src/pages/insights-tools/integrations/QuickBooksOAuthCallback.tsx
[v1sub]: ../../flexprice-front/src/pages/customer/customers/CustomerSubscriptionDetailsPage.tsx
[list]: ../apps/console/src/pages/invoices/InvoiceListPage.tsx
[grid]: ../packages/ui/src/pages/billing/invoices/InvoiceGrid.tsx
[rows]: ../apps/console/src/pages/invoices/useInvoiceRowActions.tsx
[cp]: ../apps/console/src/pages/invoices/InvoiceFormPage.tsx
[form]: ../packages/ui/src/pages/billing/invoices/InvoiceForm.tsx
[dp]: ../apps/console/src/pages/invoices/InvoiceDetailPage.tsx
[view]: ../packages/ui/src/pages/billing/invoices/InvoiceDetailView.tsx
[ep]: ../apps/console/src/pages/invoices/InvoiceEditPage.tsx
[iq]: ../packages/query/src/invoices.ts
[di]: ../packages/domain/src/invoice.ts
[ps]: ../packages/domain/src/invoicePaymentStatus.ts
[pd]: ../packages/domain/src/payment.ts
[adapter]: ../apps/console/src/pages/invoices/invoiceDocumentAdapter.ts
[parties]: ../apps/console/src/pages/invoices/invoiceParties.ts
[csv]: ../apps/console/src/pages/invoices/invoiceCsv.ts
[apii]: ../packages/api/src/invoices.ts
[set]: ../apps/console/src/pages/settings/InvoicesPanel.tsx
[config]: ../packages/domain/src/settings/invoiceConfig.ts
[spec]: ../packages/domain/src/integrationConnect.ts
[conn]: ../packages/query/src/integrations.ts
[conna]: ../packages/api/src/connections.ts
[central]: ../apps/console/src/pages/integrations/IntegrationListPage.tsx
[oauth]: ../apps/console/src/pages/integrations/OAuthCallbackPage.tsx
[entity]: ../packages/query/src/entityIntegrationLinks.ts
[marks]: ../packages/ui/src/pages/contracts/ContractIntegrations.tsx
[cm]: ../packages/query/src/customers.ts
[cdp]: ../apps/console/src/pages/customers/CustomerDetailPage.tsx
[cl]: ../apps/console/src/pages/customers/CustomerListPage.tsx
[sdp]: ../apps/console/src/pages/subscriptions/SubscriptionDetailPage.tsx
[sync]: ../packages/api/src/integrationSync.ts

## V2 implementation update — 6 November 2026

The subsequent implementation adds subscription-specific mapping reads and link/unlink targets to contract detail. Customer mapping IDs are no longer displayed as contract IDs. The SDK’s `IntegrationEntityType.Subscription` supports this scope; write persistence has not been exercised live in this implementation.

Shared integration link/unlink/push/pull controls now follow `integration:write`, matching the backend route permission. Connection creation and editing follow `connection:write`; read-only roles retain inspection/copy access. These frontend gates do not replace backend authorization.

Zoho connection creation and configuration include invoice payment gateways and the PayPal standard/adaptive setting. Connection mapping preserves provider-specific nested sync settings, and gateway edits merge only their intended nested fields. Unknown gateway selections/settings survive unrelated saves.

`PARTIALLY_REFUNDED` now remains distinct from a full refund through payment and invoice mapping, labels and invoice-document status text. Invoice-number examples format the date in the configured timezone, using the backend’s abbreviation-to-IANA mapping, and report an unavailable preview for an invalid zone rather than silently using UTC. They still use the configured start sequence as an example, not an actual next sequence counter.

New QuickBooks connections default to the active Flexprice environment’s sandbox/production mode. Existing connections are not rewritten. The mode remains selectable; making it permanently read-only and environment-bound, as V1 does, remains an explicit product decision.

Two API capabilities remain unresolved. The local backend `IntegrationSyncRequest` (`internal/api/dto/integration.go`) accepts entity type, entity ID, method and resync, with no provider/connection selector. Its handler (`internal/api/v1/integration.go`) returns a message, with no job/execution ID or provider completion result. V2 therefore cannot truthfully offer a one-provider push or report completion from this response. Sync acceptance is labelled queued; current mappings are not treated as proof that the latest sync completed. A backend contract must define target selection and a correlated completion/status result before those controls can be implemented reliably.

No external provider sync or connection setting was changed live during this implementation.
