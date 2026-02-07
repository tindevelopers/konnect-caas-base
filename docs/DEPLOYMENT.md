# TinAdmin Production Deployment Guide

This guide covers deploying TinAdmin to production using Vercel and Supabase.

---

## Prerequisites

- [ ] Vercel account
- [ ] Supabase account (production project)
- [ ] Stripe account (live mode enabled)
- [ ] Domain configured in DNS
- [ ] GitHub repository connected to Vercel

---

## Step 1: Supabase Production Setup

### 1.1 Create Production Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Choose a name and strong database password
4. Select your preferred region
5. Wait for project to initialize

### 1.2 Run Migrations

```bash
# Link to your production project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations to production
supabase db push
```

### 1.3 Get Production Keys

From **Settings → API** in Supabase Dashboard:
- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Stripe Production Setup

### 2.1 Enable Live Mode

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Toggle from **Test** to **Live** mode
3. Complete account verification if required

### 2.2 Get Live Keys

From **Developers → API Keys**:
- Copy `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Copy `Secret key` → `STRIPE_SECRET_KEY`

### 2.3 Create Webhook Endpoint

1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 2.4 Create Products

1. Go to **Products** in Stripe Dashboard
2. Create your subscription plans
3. Note the Price IDs for your application

---

## Step 3: Vercel Configuration

### 3.1 Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Select **TurboRepo** framework preset

### 3.2 Create Two Vercel Projects (Recommended)

This repo contains **two Next.js apps** and you should deploy them as **separate Vercel projects**:

- **Admin**: `apps/admin` (internal admin UI for tenants + platform admins)
- **Portal**: `apps/portal` (public/consumer portal, SEO-focused)

This matches the recommended “separate deployment/domain” boundary for platform/admin vs public portal.

### 3.3 Configure Project Settings (Admin)

**Build Settings:**
- Framework: Next.js
- Root Directory: `apps/admin`
- Build Command: `pnpm build`
- Install Command: `pnpm install`

### 3.4 Configure Project Settings (Portal)

**Build Settings:**
- Framework: Next.js
- Root Directory: `apps/portal`
- Build Command: `pnpm build`
- Install Command: `pnpm install`

### 3.5 Set Environment Variables

Add these in **Settings → Environment Variables**:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Production only |
| `STRIPE_SECRET_KEY` | sk_live_... | Production only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_live_... | All |
| `STRIPE_WEBHOOK_SECRET` | whsec_... | Production only |
| `NEXT_PUBLIC_SITE_URL` | https://your-domain.com | All |
| `NEXT_PUBLIC_APP_NAME` | Your App Name | All |

---

## Step 4: Domain Configuration

### 4.1 Add Custom Domain

1. Go to **Settings → Domains** in Vercel
2. Add your domain
3. Configure DNS as instructed

### 4.2 Domain / Subdomain Mapping (Recommended)

Use separate hostnames so tenants can never “hit” platform/admin surfaces accidentally:

- **Portal** (public/consumer): `https://your-domain.com` → Vercel project rooted at `apps/portal`
- **Admin** (tenant + platform management): `https://admin.your-domain.com` → Vercel project rooted at `apps/admin`

Optional (for stricter separation of platform-only features):

- **Platform-only**: `https://platform.your-domain.com` → separate deployment, or route to `apps/admin` but enforce Platform Admin only

### 4.2 DNS Records

Add these records at your DNS provider:

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

For `admin.your-domain.com`, add the Vercel-provided CNAME (shown in Vercel Domains UI), e.g.:

```
CNAME   admin   cname.vercel-dns.com
```

### 4.3 Enable SSL

Vercel automatically provisions SSL certificates.

---

## Step 5: Deploy

### 5.1 Trigger Deployment

```bash
# Push to main branch
git push origin main
```

Or click **Deploy** in Vercel dashboard.

### 5.2 Verify Deployment

1. Check build logs in Vercel
2. Visit your domain
3. Test authentication flow
4. Test a subscription checkout

---

## Post-Deployment Checklist

### Security
- [ ] Verify all environment variables are set
- [ ] Verify HTTPS is enabled
- [ ] Test authentication flows
- [ ] Verify RLS policies are active

### Billing
- [ ] Create a test subscription with real card
- [ ] Verify webhook events are received
- [ ] Check Stripe Dashboard for events
- [ ] Refund test transaction

### Monitoring
- [ ] Set up Vercel Analytics (optional)
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure Stripe email notifications
- [ ] Set up uptime monitoring

---

## Rollback Procedure

If issues occur:

1. **Quick Rollback**: 
   - Go to Vercel Dashboard → Deployments
   - Find last working deployment
   - Click **⋮** → **Promote to Production**

2. **Database Rollback**:
   - Contact Supabase support for point-in-time recovery
   - Or restore from backup

---

## Environment-Specific Notes

### Staging Environment

For a staging environment:
1. Create a separate Vercel project
2. Use Stripe test mode
3. Use a separate Supabase project
4. Configure preview deployments

### Local Development

```bash
# Copy environment template
cp .env.example .env.local

# Start local Supabase
supabase start

# Start development server
pnpm dev
```

---

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
pnpm clean
pnpm install
pnpm build
```

### Database Connection Issues

1. Check Supabase project status
2. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
3. Check if IP is allowlisted (if using restrictions)

### Stripe Webhook Issues

1. Verify webhook secret matches
2. Check Stripe webhook logs
3. Verify endpoint URL is correct
4. Check for CORS issues

---

## Support

- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- Supabase Docs: [supabase.com/docs](https://supabase.com/docs)
- Stripe Docs: [stripe.com/docs](https://stripe.com/docs)

---

*Last Updated: December 2024*

