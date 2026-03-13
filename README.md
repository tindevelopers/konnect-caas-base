# 🚀 Enterprise SaaS Platform Template

> **Production-ready SaaS starter with multi-tenancy, CRM, Stripe billing, and role-based access control**

A complete, enterprise-grade SaaS platform template built with Next.js 15, Supabase, and Tailwind CSS. Fork this repository to build your own SaaS product in days, not months.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)](https://tailwindcss.com/)

Staging branch pushes trigger Vercel preview deployments.

---

## 🍴 Fork This Template

**Ready to build your SaaS product?**

1. Click the "Use this template" button on GitHub
2. Clone your new repository
3. Run the initialization script:
   ```bash
   node scripts/initialize-fork.js
   ```
4. Start building!

See [**FORK_GUIDE.md**](FORK_GUIDE.md) for detailed customization instructions.

---

## ✨ What's Included

### 🏗️ Architecture
- **Turborepo Monorepo** - Scalable multi-app architecture
- **Dual-Mode Apps** - Admin dashboard + Consumer portal
- **Shared Packages** - Reusable core modules
- **Type-Safe** - Full TypeScript support

### 🔐 Authentication & Authorization
- **Supabase Auth** - Email/password, OAuth, magic links
- **Role-Based Access Control (RBAC)** - Granular permissions
- **Multi-Tenant** - Complete tenant isolation
- **Platform Admin** - System-level administration

### 💳 Billing & Payments
- **Stripe Integration** - Subscriptions, invoices, payments
- **Usage Tracking** - Metered billing support
- **Customer Portal** - Self-service billing management
- **Webhook Handling** - Automated event processing

### 📊 Features
- **CRM Module** - Contacts, deals, activities
- **Analytics Dashboard** - Real-time metrics and charts
- **User Management** - Invite, roles, permissions
- **Workspace Management** - Multi-workspace support
- **Email System** - Transactional emails (Resend, SendGrid, SES)
- **File Management** - Upload and storage
- **Calendar** - Events and scheduling
- **Task Management** - Kanban boards
- **White Label** - Custom branding per tenant
- **AI Chat Agents (3 levels)** - Telnyx (voice), Enhanced (RAG chatbot), Abacus (ChatLLM). See [**Chat AI Agents**](docs/CHAT_AI_AGENTS.md) for how to train and configure each — critical for product quality.

### 🎨 UI/UX
- **Modern Design** - Beautiful, responsive interface
- **Dark Mode** - Full dark theme support
- **Mobile-First** - Optimized for all devices
- **Tailwind CSS 4** - Latest styling framework
- **Component Library** - 100+ pre-built components

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop (for local Supabase)
- Supabase CLI

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/your-saas-platform.git
cd your-saas-platform

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 4. Start Supabase (local development)
supabase start

# 5. Start development servers
pnpm dev
```

### Access Your Apps

- **Admin Dashboard:** http://localhost:3001
- **Consumer Portal:** http://localhost:3002
- **Supabase Studio:** http://localhost:54323

---

## 📦 Monorepo Structure

```
.
├── apps/
│   ├── admin/          # Admin dashboard (port 3001)
│   └── portal/         # Consumer portal (port 3002)
├── packages/
│   └── @tinadmin/
│       ├── core/       # Core SaaS modules (auth, billing, database)
│       ├── config/     # Shared configuration
│       ├── ui-admin/   # Admin UI components
│       └── ui-consumer/# Consumer UI components
├── scripts/            # Utility scripts
├── supabase/          # Database migrations
└── docs/              # Documentation
```

---

## 🛠️ Development

### Run All Apps

```bash
pnpm dev                 # All apps
pnpm dev:admin          # Admin only
pnpm dev:portal         # Portal only
```

### Build

```bash
pnpm build:all          # Build everything
pnpm build:admin        # Build admin app
pnpm build:portal       # Build portal app
pnpm build:packages     # Build packages only
```

### Database

```bash
pnpm supabase:start     # Start local Supabase
pnpm supabase:stop      # Stop Supabase
pnpm supabase:status    # Check status
pnpm supabase:reset     # Reset database
```

### Create Platform Admin

```bash
# Option 1: Use the script
npx tsx scripts/create-system-admin.ts

# Option 2: Use the UI
# Navigate to: http://localhost:3001/admin/create-platform-admin
```

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Deploy both apps
./scripts/deploy-vercel.sh

# Or deploy individually
vercel --cwd apps/admin
vercel --cwd apps/portal
```

### Environment Variables

Set these in your deployment platform:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Optional:**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER` (resend, sendgrid, ses)
- Email provider API keys

See [`.env.example`](.env.example) for complete list.

---

## 📚 Documentation

- [**Fork Guide**](FORK_GUIDE.md) - How to customize your fork
- [**Developer Guide**](docs/DEVELOPER_GUIDE.md) - Advanced development
- [**Architecture**](docs/ARCHITECTURE.md) - System design
- [**Multi-Tenancy**](docs/MULTITENANT_ARCHITECTURE.md) - Tenant isolation
- [**Chat AI Agents**](docs/CHAT_AI_AGENTS.md) - **Three levels of chat AI (Telnyx, Enhanced, Abacus) and how to train them** — critical for product quality
- [**Stripe Setup**](docs/STRIPE_SETUP.md) - Payment integration
- [**Deployment**](docs/DEPLOYMENT.md) - Production deployment
- [**User Guide**](docs/USER_GUIDE.md) - End-user documentation

---

## 🎯 Core Modules

### Authentication (`@tinadmin/core/auth`)
- User authentication and session management
- Password reset and email verification
- OAuth provider integration
- Audit logging

### Billing (`@tinadmin/core/billing`)
- Stripe subscription management
- Invoice generation and tracking
- Payment method handling
- Usage-based billing

### Database (`@tinadmin/core/database`)
- Supabase client configuration
- Row-level security (RLS)
- Type-safe queries
- Admin operations

### Multi-Tenancy (`@tinadmin/core/multi-tenancy`)
- Tenant isolation and context
- Subdomain routing
- Workspace management
- Organization hierarchy

### Permissions (`@tinadmin/core/permissions`)
- Role-based access control
- Permission gates and middleware
- Tenant-level permissions
- Platform admin privileges

---

## 🔧 Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript 5.9 |
| **Styling** | Tailwind CSS 4.0 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **Payments** | Stripe |
| **Email** | Resend / SendGrid / AWS SES |
| **Monorepo** | Turborepo + pnpm |
| **Deployment** | Vercel / Railway / Docker |

---

## 📊 Features Breakdown

### Admin Dashboard
- Multi-tenant management
- User and role management
- CRM (contacts, deals, activities)
- Analytics and reporting
- Billing and subscriptions
- Settings and configuration
- Audit logs

### Consumer Portal
- User registration and onboarding
- Profile management
- Billing and invoices
- Support tickets
- Documentation

### Platform Features
- White-label branding per tenant
- Custom domains
- Email templates
- Webhook integrations
- API access
- Export/import data

---

## 🧪 Testing

```bash
pnpm test              # Run all tests
pnpm type-check        # TypeScript validation
pnpm lint              # ESLint
```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Stripe](https://stripe.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Turborepo](https://turbo.build/)

---

## 📞 Support

- **Documentation:** See `docs/` directory
- **Issues:** [GitHub Issues](https://github.com/your-org/your-saas-platform/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/your-saas-platform/discussions)

---

## 🗺️ Roadmap

- [ ] GraphQL API support
- [ ] Mobile app (React Native)
- [ ] Advanced analytics
- [ ] AI/ML integrations
- [ ] Marketplace/plugin system
- [ ] Multi-language support (i18n)

---

**⭐ If this template helped you, please star the repository!**
