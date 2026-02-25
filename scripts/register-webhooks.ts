/**
 * Shopify Webhook Registration Script
 *
 * Usage:
 *   npx tsx scripts/register-webhooks.ts <your-domain>
 *
 * Example:
 *   npx tsx scripts/register-webhooks.ts https://your-app.vercel.app
 *
 * This will register the following webhooks:
 *   - orders/create → https://your-domain/api/webhooks/shopify/orders
 *   - orders/updated → https://your-domain/api/webhooks/shopify/orders
 *   - orders/cancelled → https://your-domain/api/webhooks/shopify/orders
 *
 * Prerequisites:
 *   1. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in your .env file
 *   2. Set SHOPIFY_WEBHOOK_SECRET in your .env file (generate with: openssl rand -hex 32)
 *   3. Deploy your app so the webhook endpoint is accessible
 */

import 'dotenv/config'
import { listWebhooks, registerWebhooks, deleteWebhook } from '../src/lib/shopify'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'list') {
    // List existing webhooks
    console.log('Fetching existing webhooks...\n')
    const webhooks = await listWebhooks()

    if (webhooks.length === 0) {
      console.log('No webhooks registered.')
    } else {
      console.log('Registered webhooks:')
      webhooks.forEach((w) => {
        console.log(`  - ${w.topic}`)
        console.log(`    ID: ${w.id}`)
        console.log(`    URL: ${w.address}`)
        console.log(`    API Version: ${w.api_version}`)
        console.log()
      })
    }
    return
  }

  if (command === 'delete') {
    const webhookId = parseInt(args[1])
    if (!webhookId) {
      console.error('Usage: npx tsx scripts/register-webhooks.ts delete <webhook-id>')
      process.exit(1)
    }
    await deleteWebhook(webhookId)
    console.log(`Deleted webhook ${webhookId}`)
    return
  }

  if (command === 'delete-all') {
    console.log('Deleting all webhooks...\n')
    const webhooks = await listWebhooks()
    for (const w of webhooks) {
      await deleteWebhook(w.id)
      console.log(`Deleted: ${w.topic} (${w.id})`)
    }
    console.log('\nAll webhooks deleted.')
    return
  }

  // Register webhooks
  const baseUrl = command

  if (!baseUrl || !baseUrl.startsWith('http')) {
    console.log(`
Shopify Webhook Registration Script

Usage:
  npx tsx scripts/register-webhooks.ts <command>

Commands:
  <base-url>     Register webhooks (e.g., https://your-app.vercel.app)
  list           List all registered webhooks
  delete <id>    Delete a specific webhook by ID
  delete-all     Delete all webhooks

Examples:
  npx tsx scripts/register-webhooks.ts https://your-app.vercel.app
  npx tsx scripts/register-webhooks.ts list
  npx tsx scripts/register-webhooks.ts delete 123456789
  npx tsx scripts/register-webhooks.ts delete-all

Before registering webhooks:
  1. Set these environment variables in .env:
     - SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
     - SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxx
     - SHOPIFY_WEBHOOK_SECRET=<run: openssl rand -hex 32>

  2. Deploy your app so the webhook endpoint is publicly accessible

  3. Run this script with your deployed URL
`)
    process.exit(1)
  }

  console.log(`Registering webhooks for: ${baseUrl}\n`)

  const result = await registerWebhooks(baseUrl)

  if (result.created.length > 0) {
    console.log('✓ Created webhooks:')
    result.created.forEach((topic) => console.log(`  - ${topic}`))
  }

  if (result.existing.length > 0) {
    console.log('\n○ Already registered:')
    result.existing.forEach((topic) => console.log(`  - ${topic}`))
  }

  if (result.errors.length > 0) {
    console.log('\n✗ Errors:')
    result.errors.forEach((err) => console.log(`  - ${err}`))
  }

  console.log(`
Webhook endpoint: ${baseUrl}/api/webhooks/shopify/orders

Next steps:
  1. Make sure SHOPIFY_WEBHOOK_SECRET is set in your production environment
  2. Test by creating a test order in Shopify
  3. Check your server logs for webhook events
`)
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
