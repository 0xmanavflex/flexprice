import stripe from './stripe.svg'
import razorpay from './razorpay.svg'
import chargebee from './chargebee.png'
import hubspot from './hubspot.svg'
import zoho from './zoho.svg'
import quickbooks from './quickbooks.svg'
import nomod from './nomod.svg'
import moyasar from './moyasar.svg'
import paddle from './paddle.png'
import whop from './whop.png'
import tabs from './tabs.png'
import awsMarketplace from './aws_marketplace.png'
import gcpMarketplace from './gcp_marketplace.png'
import azureMarketplace from './azure_marketplace.png'
import salesforce from './salesforce.svg'
import paypal from './paypal.svg'

/**
 * Brand marks for the integration catalogue, keyed by integration id. Taken
 * from the V1 console (`flexprice-front`), which hot-linked four of them from
 * Wikimedia and Zoho and inlined two as data URIs; here every one is a local
 * file so the page works offline and a third party cannot change a logo.
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
}
