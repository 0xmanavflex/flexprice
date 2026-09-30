/**
 * Product components that speak billing.
 *
 * Domain types belong here — a `MoneyCell` takes a `Money`, an
 * `InvoiceStatusBadge` takes a domain status. Transport types do not: a
 * component receiving a `WalletResponse` is the bug the layering prevents.
 *
 * Still presentation. These take props and render; they do not fetch.
 */

export { DashboardHome, DashboardHomeProvenance } from './DashboardHome'
export type {
  ApiPanel,
  DashboardHomeProps,
  EventPoint,
  EventsPanel,
  FilterOption,
  InvoicesPanel,
  PanelStatus,
  SubscriptionDay,
  SubscriptionsPanel,
  UsagePanel,
  UsageRow,
} from './DashboardHome'
export { RevenueDashboard, RevenueDashboardProvenance } from './RevenueDashboard'
export type { RevenueDashboardProps } from './RevenueDashboard'
export { CUSTOMER_TABS, CustomerDetail, CustomerDetailProvenance } from './CustomerDetail'
export type { CustomerDetailProps, CustomerTab } from './CustomerDetail'
export { InvoiceGrid, InvoiceGridProvenance } from './InvoiceGrid'
export type { InvoiceGridProps } from './InvoiceGrid'
export { PriceOverrideForm, PriceOverrideFormProvenance } from './PriceOverrideForm'
export type { PriceOverrideFormProps } from './PriceOverrideForm'
/*
 * The one list table, and the cells it is built from.
 *
 * Every list screen goes through these two. A page that reaches past them to
 * `@reui/data-grid` is a page that will stop looking like the other nineteen.
 */
export { EntityList, EntityListProvenance } from './EntityList'
export type {
  EntityEmpty,
  EntityFilter,
  EntityGuide,
  EntityListProps,
  EntityRowAction,
  EntitySort,
  EntityStatusOption,
  EntityStatusSelect,
} from './EntityList'
export {
  CellsProvenance,
  EmDash,
  FEATURE_TYPE_GLYPH,
  FeatureTypePill,
  Pill,
  dateColumn,
  idColumn,
  moneyColumn,
  numberColumn,
  pillColumn,
  textColumn,
} from './cells'
export type {
  ColumnOptions,
  EntityColumn,
  FeatureTypePillProps,
  PillProps,
  PillSpec,
  PillTone,
} from './cells'
export { FeatureGrid, FeatureGridProvenance } from './FeatureGrid'
export type { FeatureGridProps, FeatureStatusCounts } from './FeatureGrid'
export { PlanGrid, PlanGridProvenance } from './PlanGrid'
export type { PlanGridProps, PlanStatusCounts } from './PlanGrid'
export { PlanForm, PlanFormProvenance } from './PlanForm'
export type { PlanFormProps } from './PlanForm'
export { PlanEditorDialog, PlanEditorDialogProvenance } from './PlanEditorDialog'
export type { PlanEditorDialogProps } from './PlanEditorDialog'
export { TierTable, TierTableProvenance } from './TierTable'
export type { TierRowError, TierTableProps } from './TierTable'
export { PlanPreviewCard, PlanPreviewCardProvenance } from './PlanPreviewCard'
export type { PlanPreviewCardProps } from './PlanPreviewCard'
export { ChargeForm, ChargeFormProvenance } from './ChargeForm'
export type { ChargeFormProps, MeterOption } from './ChargeForm'
export { ChargeEditor, ChargeEditorProvenance } from './ChargeEditor'
export type { ChargeEditorProps } from './ChargeEditor'
export { ChargeTable, ChargeTableProvenance } from './ChargeTable'
export type { ChargeTableProps } from './ChargeTable'
export { EntitlementDrawer, EntitlementDrawerProvenance } from './EntitlementDrawer'
export type { EntitlementDrawerProps, FeatureOption } from './EntitlementDrawer'
export { EntitlementTable, EntitlementTableProvenance } from './EntitlementTable'
export type { EntitlementTableProps } from './EntitlementTable'
export { CreditGrantDialog, CreditGrantDialogProvenance } from './CreditGrantDialog'
export type { CreditGrantDialogProps } from './CreditGrantDialog'
export { CreditGrantTable, CreditGrantTableProvenance } from './CreditGrantTable'
export type { CreditGrantTableProps } from './CreditGrantTable'
export { AddonGrid, AddonGridProvenance } from './AddonGrid'
export type { AddonGridProps, AddonStatusCounts } from './AddonGrid'
export { AddonForm, AddonFormProvenance } from './AddonForm'
export type { AddonFormProps } from './AddonForm'
export { AddonEditorDialog, AddonEditorDialogProvenance } from './AddonEditorDialog'
export type { AddonEditorDialogProps } from './AddonEditorDialog'
export { CouponGrid, CouponGridProvenance } from './CouponGrid'
export type { CouponGridProps, CouponStatusCounts } from './CouponGrid'
export { CouponForm, CouponFormProvenance } from './CouponForm'
export type { CouponFormProps } from './CouponForm'
export { CouponEditorDialog, CouponEditorDialogProvenance } from './CouponEditorDialog'
export type { CouponEditorDialogProps } from './CouponEditorDialog'
export { PriceUnitGrid, PriceUnitGridProvenance } from './PriceUnitGrid'
export type { PriceUnitGridProps } from './PriceUnitGrid'
export { PriceUnitForm, PriceUnitFormProvenance } from './PriceUnitForm'
export type { PriceUnitFormProps } from './PriceUnitForm'
export { PriceUnitEditorDialog, PriceUnitEditorDialogProvenance } from './PriceUnitEditorDialog'
export type { PriceUnitEditorDialogProps } from './PriceUnitEditorDialog'
export { GroupGrid, GroupGridProvenance } from './GroupGrid'
export type { GroupGridProps } from './GroupGrid'
export { CostSheetGrid, CostSheetGridProvenance } from './CostSheetGrid'
export type { CostSheetGridProps } from './CostSheetGrid'
export { CustomerGrid, CustomerGridProvenance } from './CustomerGrid'
export type { CustomerGridProps } from './CustomerGrid'
export { SubscriptionGrid, SubscriptionGridProvenance } from './SubscriptionGrid'
export type { SubscriptionGridProps } from './SubscriptionGrid'
export {
  SubscriptionStatusBadge,
  SubscriptionStatusBadgeProvenance,
} from './SubscriptionStatusBadge'
export { CreditNoteGrid, CreditNoteGridProvenance } from './CreditNoteGrid'
export type { CreditNoteGridProps } from './CreditNoteGrid'
export { PaymentGrid, PaymentGridProvenance } from './PaymentGrid'
export type { PaymentGridProps } from './PaymentGrid'
export { PaymentStatusBadge, PaymentStatusBadgeProvenance } from './PaymentStatusBadge'
export { TaxRateGrid, TaxRateGridProvenance } from './TaxRateGrid'
export type { TaxRateGridProps } from './TaxRateGrid'
export { EventGrid, EventGridProvenance } from './EventGrid'
export type { EventGridProps } from './EventGrid'
export { EventDetailSheet, EventDetailSheetProvenance } from './EventDetailSheet'
export type { EventDetailSheetProps } from './EventDetailSheet'
export { FeatureForm, FeatureFormProvenance } from './FeatureForm'
export type { FeatureFormProps } from './FeatureForm'
export { Money, MoneyProvenance } from './Money'
export type { MoneyProps } from './Money'
export { Metric, MetricProvenance } from './Metric'
export type { MetricProps, Sentiment } from './Metric'
export { StatCards, StatCardsProvenance } from './StatCards'
export type { Stat, StatCardsProps } from './StatCards'
export {
  CatalogStatusBadge,
  FeatureTypeBadge,
  GlyphBadge,
  InvoiceStatusBadge,
  StatusBadgeProvenance,
} from './StatusBadge'
export type { GlyphBadgeProps } from './StatusBadge'
export type {
  CatalogStatus,
  CatalogStatusBadgeProps,
  FeatureTypeBadgeProps,
  InvoiceStatusBadgeProps,
} from './StatusBadge'
export { UsageMeter, UsageMeterProvenance } from './UsageMeter'
export type { UsageMeterProps } from './UsageMeter'
export { SignInForm, SignInFormProvenance } from './SignInForm'
export type { SignInFormProps } from './SignInForm'
export { SignInScreen, SignInScreenProvenance } from './SignInScreen'
export type { SignInScreenProps } from './SignInScreen'
export { ForgotPasswordForm, ForgotPasswordFormProvenance } from './ForgotPasswordForm'
export type { ForgotPasswordFormProps } from './ForgotPasswordForm'
export { AcceptInvitationForm, AcceptInvitationFormProvenance } from './AcceptInvitationForm'
export type { AcceptInvitationFormProps } from './AcceptInvitationForm'
export { EnvironmentForm, EnvironmentFormProvenance } from './EnvironmentForm'
export type { EnvironmentFormProps } from './EnvironmentForm'
export {
  EnvironmentCreateDialog,
  EnvironmentCreateDialogProvenance,
} from './EnvironmentCreateDialog'
export type { EnvironmentCreateDialogProps } from './EnvironmentCreateDialog'
export { SettingsShell, SettingsShellProvenance } from './SettingsShell'
export type { SettingsSection, SettingsShellProps, SettingsTab } from './SettingsShell'

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
} from './charts'
export type {
  BlurredEmptyAction,
  BlurredEmptyProps,
  ChartTone,
  MetricChartProps,
  MetricPoint,
  MetricTab,
} from './charts'
export { PillColumns, PillColumnsProvenance } from './PillColumns'
export type { PillColumn, PillColumnsProps, PillSeries } from './PillColumns'
export { HalfDonut, HalfDonutProvenance } from './HalfDonut'
export type { DonutSlice, HalfDonutProps } from './HalfDonut'
export { SegmentMeter, SegmentMeterProvenance } from './SegmentMeter'
export type { SegmentMeterProps, SegmentMeterRow } from './SegmentMeter'
export { SplitMeter, SplitMeterProvenance } from './SplitMeter'
export type { SplitMeterPart, SplitMeterProps } from './SplitMeter'
export { ArcGauge, ArcGaugeProvenance } from './ArcGauge'
export type { ArcGaugeProps } from './ArcGauge'
export { QuotaCard, QuotaCardProvenance } from './QuotaCard'
export type { QuotaCardAction, QuotaCardProps } from './QuotaCard'

/* The billing grids' migration onto EntityList. Appended — the grids and their
   props were already exported above; this is the one new type the move added. */
export type { RevenueByCustomerGap } from './RevenueDashboard'
