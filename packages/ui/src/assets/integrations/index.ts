import stripe from './stripe.svg'
import razorpay from './razorpay.svg'
import chargebee from './chargebee.svg'
import hubspot from './hubspot.svg'
import zoho from './zoho.svg'
import quickbooks from './quickbooks.svg'
import nomod from './nomod.svg'
import moyasar from './moyasar.svg'
import paddle from './paddle.svg'
import whop from './whop.svg'
import tabs from './tabs.svg'
import awsMarketplace from './aws_marketplace.svg'
import gcpMarketplace from './gcp_marketplace.svg'
import azureMarketplace from './azure_marketplace.svg'
import salesforce from './salesforce.svg'
import paypal from './paypal.svg'
import s3 from './s3.svg'
import stripeDark from './dark/stripe.svg'
import razorpayDark from './dark/razorpay.svg'
import chargebeeDark from './dark/chargebee.svg'
import hubspotDark from './dark/hubspot.svg'
import zohoDark from './dark/zoho.svg'
import quickbooksDark from './dark/quickbooks.svg'
import nomodDark from './dark/nomod.svg'
import moyasarDark from './dark/moyasar.svg'
import paddleDark from './dark/paddle.svg'
import whopDark from './dark/whop.svg'
import tabsDark from './dark/tabs.svg'
import awsMarketplaceDark from './dark/aws_marketplace.svg'
import gcpMarketplaceDark from './dark/gcp_marketplace.svg'
import azureMarketplaceDark from './dark/azure_marketplace.svg'
import s3Dark from './dark/s3.svg'

/**
 * Brand marks for the integration catalogue, keyed by integration id: the
 * official full-colour mark, cropped to a square viewBox so it fills the logo
 * tile. Every one is a local file so the page works offline and a third party
 * cannot change a logo.
 */
export const INTEGRATION_LOGOS: Record<string, string> = {
  stripe,
  razorpay,
  chargebee,
  hubspot,
  zoho,
  quickbooks,
  nomod,
  moyasar,
  paddle,
  whop,
  tabs,
  aws_marketplace: awsMarketplace,
  gcp_marketplace: gcpMarketplace,
  azure_marketplace: azureMarketplace,
  salesforce,
  paypal,
  /** Amazon S3, the data-export destination (not in the integrations catalogue). */
  s3,
}

/**
 * White versions of the same marks for the dark-mode tile. An id missing here
 * falls back to its `INTEGRATION_LOGOS` mark.
 */
export const INTEGRATION_LOGOS_DARK: Record<string, string> = {
  stripe: stripeDark,
  razorpay: razorpayDark,
  chargebee: chargebeeDark,
  hubspot: hubspotDark,
  zoho: zohoDark,
  quickbooks: quickbooksDark,
  nomod: nomodDark,
  moyasar: moyasarDark,
  paddle: paddleDark,
  whop: whopDark,
  tabs: tabsDark,
  aws_marketplace: awsMarketplaceDark,
  gcp_marketplace: gcpMarketplaceDark,
  azure_marketplace: azureMarketplaceDark,
  s3: s3Dark,
}
