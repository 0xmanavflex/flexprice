/**
 * Product components that speak billing, one folder per page.
 *
 * `plans/` holds the plan grid, form and editor. `charges/` holds the charge
 * builder those pages share. `shared/` holds the list table and cells every
 * page is built from. Domain types belong here — a `Money` cell takes a
 * `Money`, an `InvoiceStatusBadge` takes a domain status. Transport types do
 * not: a component receiving a `WalletResponse` is the bug the layering prevents.
 *
 * Still presentation. These take props and render; they do not fetch.
 */

export { DashboardHome, DashboardHomeProvenance } from './home/DashboardHome'
export type {
  CustomersPanel,
  DashboardHomeProps,
  EventPoint,
  EventsPanel,
  FilterOption,
  PanelStatus,
} from './home/DashboardHome'
export { RevenueDashboard, RevenueDashboardProvenance } from './revenue/RevenueDashboard'
export type { RevenueDashboardProps } from './revenue/RevenueDashboard'
export { CUSTOMER_TABS, CustomerDetail, CustomerDetailProvenance } from './customers/CustomerDetail'
export type { CustomerDetailProps, CustomerTab } from './customers/CustomerDetail'
export { InvoiceGrid, InvoiceGridProvenance } from './invoices/InvoiceGrid'
export type { InvoiceGridProps } from './invoices/InvoiceGrid'
export { InvoiceForm, InvoiceFormProvenance } from './invoices/InvoiceForm'
export type { InvoiceFormProps } from './invoices/InvoiceForm'
export { InvoiceBillingDetailBlock } from './invoices/InvoiceBillingDetailBlock'
export { InvoiceDetailView } from './invoices/InvoiceDetailView'
export { DEMO_INVOICE, displayStatus, invoiceTotals } from './invoices/invoiceDocument'
export type { InvoiceDocument } from './invoices/invoiceDocument'
export { PriceOverrideForm, PriceOverrideFormProvenance } from './charges/PriceOverrideForm'
export type { PriceOverrideFormProps } from './charges/PriceOverrideForm'
/*
 * The one list table, and the cells it is built from.
 *
 * Every list screen goes through these two. A page that reaches past them to
 * `@reui/data-grid` is a page that will stop looking like the other nineteen.
 */
export { EntityList, EntityListProvenance } from './shared/EntityList'
export type {
  EntityEmpty,
  EntityFilter,
  EntityGuide,
  EntityListProps,
  EntityRowAction,
  EntitySort,
} from './shared/EntityList'
export {
  CellsProvenance,
  EmDash,
  EntityLink,
  FEATURE_TYPE_GLYPH,
  FeatureTypeGlyph,
  FeatureTypePill,
  Pill,
  Status,
  Tag,
  dateColumn,
  idColumn,
  moneyColumn,
  numberColumn,
  pillColumn,
  textColumn,
} from './shared/cells'
export type {
  ColumnOptions,
  EntityColumn,
  FeatureTypeGlyphProps,
  FeatureTypePillProps,
  PillProps,
  PillSpec,
  PillTone,
} from './shared/cells'
export { FeatureDetailView } from './features/FeatureDetailView'
export type { FeatureTab, FeatureDetailViewProps } from './features/FeatureDetailView'
export { FeatureGrid, FeatureGridProvenance } from './features/FeatureGrid'
export type { FeatureGridProps, ProductLinkage } from './features/FeatureGrid'
export { PlanGrid, PlanGridProvenance } from './plans/PlanGrid'
export type { PlanGridProps } from './plans/PlanGrid'
export { PlanForm, PlanFormProvenance } from './plans/PlanForm'
export type { PlanFormProps, PlanFormValue } from './plans/PlanForm'
export { TierTable, TierTableProvenance } from './charges/TierTable'
export type { TierRowError, TierTableProps } from './charges/TierTable'
export { PlanPreviewCard, PlanPreviewCardProvenance } from './plans/PlanPreviewCard'
export type { PlanPreviewCardProps } from './plans/PlanPreviewCard'
export { pricingSummary, chargeLabel, includedLine, creditLine } from './plans/PlanPreviewCard'
export { AddChargeDialog } from './plans/AddChargeDialog'
export type { AddChargeDialogProps } from './plans/AddChargeDialog'
export { PlanChargesView } from './plans/PlanChargesView'
export { PlanCustomerPreview } from './plans/PlanCustomerPreview'
export { PlanCreditGrantsView } from './plans/PlanCreditGrantsView'
export { PlanEntitlementsView } from './plans/PlanEntitlementsView'
export { EntityHeader } from './shared/EntityHeader'
export { ChargeForm, ChargeFormProvenance } from './charges/ChargeForm'
export type { ChargeFormProps, MeterOption, PriceUnitOption } from './charges/ChargeForm'
export { RowActionsMenu, RowActionsMenuProvenance } from './shared/RowActionsMenu'
export type { RowActionsMenuProps } from './shared/RowActionsMenu'
export { ChargeTable, ChargeTableProvenance } from './charges/ChargeTable'
export type { ChargeTableProps } from './charges/ChargeTable'
export {
  EntitlementCreateForm,
  EntitlementEditForm,
  EntitlementFormProvenance,
} from './entitlements/EntitlementForm'
export type { FeatureOption } from './entitlements/EntitlementForm'
export { EntitlementTable, EntitlementTableProvenance } from './entitlements/EntitlementTable'
export type { EntitlementTableProps } from './entitlements/EntitlementTable'
export {
  CreditGrantCreateForm,
  CreditGrantEditForm,
  CreditGrantFormProvenance,
} from './credit-grants/CreditGrantForm'
export type { CreditGrantFormProps } from './credit-grants/CreditGrantForm'
export { CreditGrantTable, CreditGrantTableProvenance } from './credit-grants/CreditGrantTable'
export type { CreditGrantTableProps } from './credit-grants/CreditGrantTable'
export { AddonGrid, AddonGridProvenance } from './addons/AddonGrid'
export type { AddonGridProps } from './addons/AddonGrid'
export { AddonForm, AddonFormProvenance } from './addons/AddonForm'
export type { AddonFormProps } from './addons/AddonForm'
export { CouponGrid, CouponGridProvenance } from './coupons/CouponGrid'
export type { CouponGridProps } from './coupons/CouponGrid'
export { CouponCreateForm, CouponCreateFormProvenance } from './coupons/CouponCreateForm'
export type { CouponCreateFormProps } from './coupons/CouponCreateForm'
export { CouponForm, CouponFormProvenance } from './coupons/CouponForm'
export type { CouponFormProps } from './coupons/CouponForm'
export { PriceUnitGrid, PriceUnitGridProvenance } from './price-units/PriceUnitGrid'
export type { PriceUnitGridProps } from './price-units/PriceUnitGrid'
export { PriceUnitForm, PriceUnitFormProvenance } from './price-units/PriceUnitForm'
export type { PriceUnitFormProps } from './price-units/PriceUnitForm'
export { GroupGrid, GroupGridProvenance } from './groups/GroupGrid'
export type { GroupGridProps } from './groups/GroupGrid'
export { CostSheetGrid, CostSheetGridProvenance } from './cost-sheets/CostSheetGrid'
export type { CostSheetGridProps } from './cost-sheets/CostSheetGrid'
export { CustomerGrid, CustomerGridProvenance } from './customers/CustomerGrid'
export type { CustomerGridProps } from './customers/CustomerGrid'
export { SubscriptionForm, SubscriptionFormProvenance } from './subscriptions/SubscriptionForm'
export type {
  SubscriptionFormProps,
  SubscriptionPlanContext,
} from './subscriptions/SubscriptionForm'
export { SubscriptionGrid, SubscriptionGridProvenance } from './subscriptions/SubscriptionGrid'
export type { SubscriptionGridProps } from './subscriptions/SubscriptionGrid'
export {
  SubscriptionStatusBadge,
  SubscriptionStatusBadgeProvenance,
} from './subscriptions/SubscriptionStatusBadge'
export { CreditNoteGrid, CreditNoteGridProvenance } from './credit-notes/CreditNoteGrid'
export type { CreditNoteGridProps } from './credit-notes/CreditNoteGrid'
export { CreditNoteForm, CreditNoteFormProvenance } from './credit-notes/CreditNoteForm'
export type { CreditNoteFormProps, CreditNoteInvoiceLine } from './credit-notes/CreditNoteForm'
export { CollectionsSummary, CollectionsSummaryProvenance } from './payments/CollectionsSummary'
export type { CollectionsSummaryCell, CollectionsSummaryProps } from './payments/CollectionsSummary'
export { PaymentGrid, PaymentGridProvenance } from './payments/PaymentGrid'
export type { PaymentGridProps } from './payments/PaymentGrid'
export { PaymentForm, PaymentFormProvenance } from './payments/PaymentForm'
export type { PaymentFormProps } from './payments/PaymentForm'
export { PaymentStatusBadge, PaymentStatusBadgeProvenance } from './payments/PaymentStatusBadge'
export { TaxRateGrid, TaxRateGridProvenance } from './taxes/TaxRateGrid'
export type { TaxRateGridProps } from './taxes/TaxRateGrid'
export { EventGrid, EventGridProvenance } from './events/EventGrid'
export type { EventGridProps } from './events/EventGrid'
export { EventDetailSheet, EventDetailSheetProvenance } from './events/EventDetailSheet'
export type { EventDetailSheetProps } from './events/EventDetailSheet'
export { FeatureForm, FeatureFormProvenance } from './features/FeatureForm'
export type { FeatureFormProps } from './features/FeatureForm'
export { FeatureCloneDialog, FeatureCloneDialogProvenance } from './features/FeatureCloneDialog'
export type { FeatureCloneDialogProps } from './features/FeatureCloneDialog'
export { Money, MoneyProvenance } from './shared/Money'
export type { MoneyProps } from './shared/Money'
export { Metric, MetricProvenance } from './shared/Metric'
export type { MetricProps, Sentiment } from './shared/Metric'
export { StatCards, StatCardsProvenance } from './shared/StatCards'
export type { Stat, StatCardsProps } from './shared/StatCards'
export {
  CatalogStatusBadge,
  FeatureTypeBadge,
  GlyphBadge,
  InvoiceStatusBadge,
  StatusBadgeProvenance,
} from './shared/StatusBadge'
export type { GlyphBadgeProps } from './shared/StatusBadge'
export type {
  CatalogStatus,
  CatalogStatusBadgeProps,
  FeatureTypeBadgeProps,
  InvoiceStatusBadgeProps,
} from './shared/StatusBadge'
export { UsageMeter, UsageMeterProvenance } from './shared/UsageMeter'
export type { UsageMeterProps } from './shared/UsageMeter'
export { SignInForm, SignInFormProvenance } from './auth/SignInForm'
export type { SignInFormProps } from './auth/SignInForm'
export { SignInScreen, SignInScreenProvenance } from './auth/SignInScreen'
export type { SignInScreenProps } from './auth/SignInScreen'
export { ForgotPasswordForm, ForgotPasswordFormProvenance } from './auth/ForgotPasswordForm'
export type { ForgotPasswordFormProps } from './auth/ForgotPasswordForm'
export { AcceptInvitationForm, AcceptInvitationFormProvenance } from './auth/AcceptInvitationForm'
export type { AcceptInvitationFormProps } from './auth/AcceptInvitationForm'
export { EnvironmentForm, EnvironmentFormProvenance } from './environments/EnvironmentForm'
export type { EnvironmentFormProps } from './environments/EnvironmentForm'
export { SettingsShell, SettingsShellProvenance } from './settings/SettingsShell'
export type { SettingsSection, SettingsShellProps, SettingsTab } from './settings/SettingsShell'

/*
 * The shared chart library.
 *
 * Seven presentational, fully controlled charts behind one import, so the
 * Overview and Revenue dashboards draw the same marks from the same validated
 * palette rather than each growing its own. None of them takes a colour: they
 * take a `ChartTone`, and `charts.tsx` owns the one mapping to `--chart-1..5`
 * and the status tokens.
 */
export {
  MetricChart,
  BlurredEmpty,
  TrendBadge,
  ChartsProvenance,
  seriesTone,
  toneColor,
} from './shared/charts'
export type {
  BlurredEmptyAction,
  BlurredEmptyProps,
  ChartTone,
  MetricChartProps,
  MetricPoint,
  MetricTab,
} from './shared/charts'
export { PillColumns, PillColumnsProvenance } from './shared/PillColumns'
export type { PillColumn, PillColumnsProps, PillSeries } from './shared/PillColumns'
export { HalfDonut, HalfDonutProvenance } from './shared/HalfDonut'
export type { DonutSlice, HalfDonutProps } from './shared/HalfDonut'
export { SegmentMeter, SegmentMeterProvenance } from './shared/SegmentMeter'
export type { SegmentMeterProps, SegmentMeterRow } from './shared/SegmentMeter'
export { SplitMeter, SplitMeterProvenance } from './shared/SplitMeter'
export type { SplitMeterPart, SplitMeterProps } from './shared/SplitMeter'
export { ArcGauge, ArcGaugeProvenance } from './shared/ArcGauge'
export type { ArcGaugeProps } from './shared/ArcGauge'
export { QuotaCard, QuotaCardProvenance } from './shared/QuotaCard'
export type { QuotaCardAction, QuotaCardProps } from './shared/QuotaCard'

/* The billing grids' migration onto EntityList. Appended — the grids and their
   props were already exported above; this is the one new type the move added. */
export type { RevenueByCustomerGap, RevenueByCustomerRow } from './revenue/RevenueDashboard'
export { WorkflowGrid, WorkflowGridProvenance } from './workflows/WorkflowGrid'
export type { WorkflowGridProps } from './workflows/WorkflowGrid'
export { UsageSyncGrid, UsageSyncGridProvenance } from './usage-syncs/UsageSyncGrid'
export type { UsageSyncGridProps } from './usage-syncs/UsageSyncGrid'
export {
  UsageSyncDetailSheet,
  UsageSyncDetailSheetProvenance,
} from './usage-syncs/UsageSyncDetailSheet'
export type { UsageSyncDetailSheetProps } from './usage-syncs/UsageSyncDetailSheet'

export { CostSheetForm, CostSheetFormProvenance } from './cost-sheets/CostSheetForm'
export type { CostSheetFormProps } from './cost-sheets/CostSheetForm'
export { GroupForm, GroupFormProvenance } from './groups/GroupForm'
export type { GroupFormProps } from './groups/GroupForm'
export { TaxRateCreateForm, TaxRateEditForm, TaxRateFormProvenance } from './taxes/TaxRateForm'
export type { TaxRateCreateFormProps, TaxRateEditFormProps } from './taxes/TaxRateForm'
export { CustomerForm, CustomerFormProvenance } from './customers/CustomerForm'
export type { CustomerFormProps } from './customers/CustomerForm'
export { DataExportGrid, DataExportGridProvenance } from './exports/DataExportGrid'
export type { DataExportGridProps } from './exports/DataExportGrid'
export { IntegrationsBlock } from './integrations/IntegrationsBlock'
export { PricingCatalogBlock } from './pricing-widget/PricingCatalogBlock'
export { toast, Toaster } from 'sonner'

export { CustomerWalletView } from './customers/CustomerWalletView'
export type { CustomerWalletViewProps } from './customers/CustomerWalletView'
export { CustomerTaxSection } from './customers/CustomerTaxSection'
export type { CustomerTaxSectionProps, TaxRateOption } from './customers/CustomerTaxSection'
export { CustomerAnalyticsView, DEMO_FEATURE_ANALYTICS } from './customers/CustomerAnalyticsView'
export type {
  CustomerAnalyticsViewProps,
  FeatureAnalytics,
  AnalyticsQuery,
} from './customers/CustomerAnalyticsView'

export { CatalogDetailFrame } from './catalog-detail/CatalogDetailFrame'
export type { CatalogDetailFrameProps, CatalogMenuItem } from './catalog-detail/CatalogDetailFrame'
export { CouponRedemptionsView, DEMO_COUPON_REDEMPTIONS } from './coupons/CouponRedemptionsView'
export { CouponRedemptionMeter } from './coupons/CouponRedemptionMeter'
export type { CouponRedemptionMeterProps } from './coupons/CouponRedemptionMeter'
export { AddonSubscriptionsView, DEMO_ADDON_SUBSCRIPTIONS } from './addons/AddonSubscriptionsView'
export { CostMarginCard, DEMO_COST_MARGIN } from './cost-sheets/CostMarginCard'
export { GroupMembersView, DEMO_GROUP_MEMBERS } from './groups/GroupMembersView'
