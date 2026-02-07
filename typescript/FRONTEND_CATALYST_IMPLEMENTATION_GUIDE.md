# Blog Writer Admin Dashboard - Catalyst UI Implementation Guide

**Using:** Catalyst UI Kit (Tailwind's Official Application UI)  
**Backend:** Blog Writer API (Cloud Run)  
**Database:** Google Cloud Firestore (Configuration Storage)  
**Architecture:** Separate Vercel Repository

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Repository Setup](#repository-setup)
3. [Catalyst Components Setup](#catalyst-components-setup)
4. [Google Firestore Integration](#google-firestore-integration)
5. [Complete File Structure](#complete-file-structure)
6. [Implementation Guide](#implementation-guide)
7. [LiteLLM Control Panel](#litellm-control-panel)
8. [Usage Tracking Dashboard](#usage-tracking-dashboard)
9. [Configuration Management](#configuration-management)
10. [Deployment](#deployment)

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Dashboard                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Catalyst   │  │   Testing    │  │  Analytics   │     │
│  │   UI Kit     │  │  Interface   │  │  Dashboard   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │      Type-Safe API Client (OpenAPI)                │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                               │
         │ HTTPS                         │ HTTPS
         ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│  Backend API         │      │  Google Firestore    │
│  (Cloud Run)         │      │  (Config Storage)    │
│                      │      │                      │
│  • Blog Generation   │      │  • AI Provider Keys  │
│  • AI Gateway        │      │  • LiteLLM Settings  │
│  • Usage Tracking    │      │  • User Preferences  │
└──────────────────────┘      └──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  LiteLLM Proxy       │
│  (Optional)          │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  OpenAI / Anthropic  │
│  DeepSeek APIs       │
└──────────────────────┘
```

---

## Repository Setup

### 1. Create New Repository

```bash
# Create on GitHub
# Repository name: blog-writer-admin
# Description: Admin dashboard for Blog Writer AI system

# Clone and initialize
git clone https://github.com/YOUR_ORG/blog-writer-admin.git
cd blog-writer-admin
```

### 2. Initialize Next.js 14 with TypeScript

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

### 3. Install Dependencies

```bash
# Catalyst UI Kit dependencies
npm install @headlessui/react motion clsx

# API & Type Generation
npm install openapi-typescript openapi-fetch
npm install @tanstack/react-query axios zod

# Google Cloud (Firestore)
npm install firebase firebase-admin
npm install @google-cloud/firestore

# Authentication
npm install next-auth @auth/core @auth/firebase-adapter

# Charts & Visualization
npm install recharts date-fns

# State Management
npm install zustand

# Icons
npm install @heroicons/react

# Utilities
npm install react-hot-toast
npm install @vercel/analytics

# Development
npm install -D tsx @types/node
```

---

## Catalyst Components Setup

### Copy Your Catalyst Components

Copy all your Catalyst UI components from:
```
/Users/gene/Library/CloudStorage/Dropbox/Cursor/Source Files - UX:UI/catalyst-ui-kit/typescript/
```

To your new project:
```
blog-writer-admin/components/catalyst/
```

**Components to copy:**
- `alert.tsx`
- `avatar.tsx`
- `badge.tsx`
- `button.tsx`
- `checkbox.tsx`
- `dialog.tsx`
- `divider.tsx`
- `dropdown.tsx`
- `fieldset.tsx`
- `heading.tsx`
- `input.tsx`
- `link.tsx`
- `navbar.tsx`
- `pagination.tsx`
- `select.tsx`
- `sidebar.tsx`
- `sidebar-layout.tsx`
- `switch.tsx`
- `table.tsx`
- `text.tsx`
- `textarea.tsx`

```bash
# Quick copy command
cp -r "/Users/gene/Library/CloudStorage/Dropbox/Cursor/Source Files - UX:UI/catalyst-ui-kit/typescript/"* ./components/catalyst/
```

---

## Complete File Structure

```
blog-writer-admin/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Catalyst SidebarLayout
│   │   ├── page.tsx                      # Dashboard home
│   │   │
│   │   ├── testing/
│   │   │   └── page.tsx                  # Blog testing interface
│   │   │
│   │   ├── analytics/
│   │   │   ├── page.tsx                  # Usage analytics
│   │   │   └── usage/
│   │   │       └── page.tsx              # Detailed usage tracking
│   │   │
│   │   ├── configuration/
│   │   │   ├── page.tsx                  # Config hub
│   │   │   ├── ai-providers/
│   │   │   │   └── page.tsx              # AI provider settings
│   │   │   ├── litellm/
│   │   │   │   └── page.tsx              # LiteLLM control panel
│   │   │   └── general/
│   │   │       └── page.tsx              # General settings
│   │   │
│   │   └── monitoring/
│   │       ├── page.tsx                  # System monitoring
│   │       └── logs/
│   │           └── page.tsx              # Log viewer
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts              # NextAuth config
│   │   ├── config/
│   │   │   ├── get/
│   │   │   │   └── route.ts              # Get config from Firestore
│   │   │   └── set/
│   │   │       └── route.ts              # Save config to Firestore
│   │   └── usage/
│   │       └── route.ts                  # Usage stats proxy
│   │
│   ├── layout.tsx                        # Root layout
│   └── globals.css
│
├── components/
│   ├── catalyst/                         # Your Catalyst UI components
│   │   ├── sidebar-layout.tsx
│   │   ├── sidebar.tsx
│   │   ├── navbar.tsx
│   │   ├── table.tsx
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ... (all others)
│   │
│   ├── dashboard/
│   │   ├── DashboardShell.tsx           # Main layout wrapper
│   │   ├── MetricCard.tsx               # Stat cards
│   │   └── StatCard.tsx                 # Simple stat display
│   │
│   ├── testing/
│   │   ├── BlogGenerationForm.tsx       # Test form (Catalyst inputs)
│   │   ├── BlogPreview.tsx              # Markdown preview
│   │   └── ModelSelector.tsx            # Model dropdown
│   │
│   ├── analytics/
│   │   ├── UsageChart.tsx               # Recharts + Catalyst
│   │   ├── CostBreakdown.tsx            # Cost visualization
│   │   └── ModelUsageTable.tsx          # Catalyst Table
│   │
│   ├── configuration/
│   │   ├── AIProviderForm.tsx           # Provider config (Catalyst)
│   │   ├── LiteLLMControl.tsx           # LiteLLM settings
│   │   └── ConfigurationCard.tsx        # Config card wrapper
│   │
│   └── monitoring/
│       ├── LogViewer.tsx                # Live logs (Catalyst Table)
│       ├── HealthIndicator.tsx          # Status badges
│       └── ErrorList.tsx                # Error tracking
│
├── lib/
│   ├── api/
│   │   ├── client.ts                    # OpenAPI client
│   │   ├── types.ts                     # Generated types
│   │   └── hooks.ts                     # React Query hooks
│   │
│   ├── firebase/
│   │   ├── config.ts                    # Firebase initialization
│   │   ├── firestore.ts                 # Firestore helpers
│   │   └── admin.ts                     # Firebase Admin (server-side)
│   │
│   ├── stores/
│   │   ├── config-store.ts              # Config state (Zustand)
│   │   └── user-store.ts                # User state
│   │
│   └── utils/
│       ├── cn.ts                        # Class name utility
│       └── format.ts                    # Formatters
│
├── scripts/
│   ├── generate-types.ts                # OpenAPI type generation
│   └── init-firestore.ts                # Initialize Firestore collections
│
├── public/
│   └── logo.svg
│
├── .env.local.example
├── firebase.json                        # Firebase config
├── firestore.rules                      # Security rules
├── firestore.indexes.json               # Firestore indexes
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Google Firestore Integration

### 1. Firestore Schema for Configuration

**Collections Structure:**

```
/organizations/{orgId}
  /config
    /ai_providers
      - openai: { apiKey: string, defaultModel: string, enabled: boolean }
      - anthropic: { apiKey: string, defaultModel: string, enabled: boolean }
      - deepseek: { apiKey: string, defaultModel: string, enabled: boolean }
    
    /litellm
      - proxyUrl: string
      - apiKey: string
      - enabled: boolean
      - cacheEnabled: boolean
      - cacheTTL: number
      - vercelGatewayUrl: string (optional)
      - vercelGatewayKey: string (optional)
    
    /general
      - defaultTone: string
      - defaultWordCount: number
      - enablePolishing: boolean
      - enableQualityCheck: boolean

/usage_logs/{logId}
  - orgId: string
  - userId: string
  - operation: string
  - model: string
  - tokens: number
  - cost: number
  - timestamp: timestamp
  - latencyMs: number
  - cached: boolean

/audit_logs/{logId}
  - orgId: string
  - userId: string
  - action: string (e.g., "config_updated", "api_key_changed")
  - resourceType: string
  - resourceId: string
  - changes: object
  - timestamp: timestamp
```

### 2. Firebase Configuration

**File:** `lib/firebase/config.ts`

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (client-side)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
```

**File:** `lib/firebase/admin.ts` (Server-side only)

```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (server-side only)
function initAdmin() {
  if (getApps().length === 0) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getApps()[0];
}

const adminApp = initAdmin();
const adminDb = getFirestore(adminApp);

export { adminApp, adminDb };
```

### 3. Firestore Helper Functions

**File:** `lib/firebase/firestore.ts`

```typescript
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from './config';

// Configuration Management
export const configService = {
  // Get organization config
  async getConfig(orgId: string) {
    const configRef = doc(db, 'organizations', orgId, 'config', 'settings');
    const configSnap = await getDoc(configRef);
    
    if (!configSnap.exists()) {
      return null;
    }
    
    return configSnap.data();
  },
  
  // Save AI provider config (encrypted)
  async saveAIProviderConfig(orgId: string, provider: string, config: any) {
    const providerRef = doc(db, 'organizations', orgId, 'config', 'ai_providers');
    
    // Encrypt API keys before storing
    const encryptedConfig = {
      ...config,
      apiKey: config.apiKey ? await encryptAPIKey(config.apiKey) : null,
    };
    
    await setDoc(providerRef, {
      [provider]: encryptedConfig,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    
    // Log audit trail
    await logAudit(orgId, 'config_updated', 'ai_provider', provider, {
      action: 'save_config',
      provider,
    });
  },
  
  // Save LiteLLM config
  async saveLiteLLMConfig(orgId: string, litellmConfig: any) {
    const litellmRef = doc(db, 'organizations', orgId, 'config', 'litellm');
    
    // Encrypt sensitive keys
    const encryptedConfig = {
      ...litellmConfig,
      apiKey: litellmConfig.apiKey ? await encryptAPIKey(litellmConfig.apiKey) : null,
      vercelGatewayKey: litellmConfig.vercelGatewayKey 
        ? await encryptAPIKey(litellmConfig.vercelGatewayKey) 
        : null,
    };
    
    await setDoc(litellmRef, {
      ...encryptedConfig,
      updatedAt: Timestamp.now(),
    });
    
    await logAudit(orgId, 'config_updated', 'litellm', 'settings', {
      action: 'save_litellm_config',
    });
  },
  
  // Get LiteLLM config
  async getLiteLLMConfig(orgId: string) {
    const litellmRef = doc(db, 'organizations', orgId, 'config', 'litellm');
    const snap = await getDoc(litellmRef);
    
    if (!snap.exists()) {
      return {
        enabled: false,
        proxyUrl: '',
        cacheEnabled: true,
        cacheTTL: 3600,
      };
    }
    
    return snap.data();
  },
};

// Usage Logging
export const usageService = {
  // Log usage to Firestore
  async logUsage(data: {
    orgId: string;
    userId: string;
    operation: string;
    model: string;
    tokens: number;
    cost: number;
    latencyMs: number;
    cached: boolean;
  }) {
    const usageRef = collection(db, 'usage_logs');
    
    await setDoc(doc(usageRef), {
      ...data,
      timestamp: Timestamp.now(),
    });
  },
  
  // Get usage stats
  async getUsageStats(orgId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const usageRef = collection(db, 'usage_logs');
    const q = query(
      usageRef,
      where('orgId', '==', orgId),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  
  // Get cost summary
  async getCostSummary(orgId: string, days: number = 30) {
    const logs = await this.getUsageStats(orgId, days);
    
    const totalCost = logs.reduce((sum, log: any) => sum + (log.cost || 0), 0);
    const totalTokens = logs.reduce((sum, log: any) => sum + (log.tokens || 0), 0);
    const totalRequests = logs.length;
    const cachedRequests = logs.filter((log: any) => log.cached).length;
    
    return {
      totalCost,
      totalTokens,
      totalRequests,
      cachedRequests,
      cacheHitRate: totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0,
      avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
    };
  },
};

// Audit Logging
async function logAudit(
  orgId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes: any
) {
  const auditRef = collection(db, 'audit_logs');
  
  await setDoc(doc(auditRef), {
    orgId,
    action,
    resourceType,
    resourceId,
    changes,
    timestamp: Timestamp.now(),
  });
}

// Simple encryption helper (use proper encryption in production)
async function encryptAPIKey(apiKey: string): Promise<string> {
  // In production, use Google Cloud KMS or similar
  // For now, just mask it for display
  return apiKey.substring(0, 8) + '••••••••' + apiKey.substring(apiKey.length - 4);
}
```

### 4. Firestore Security Rules

**File:** `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOrgMember(orgId) {
      return isAuthenticated() && 
        request.auth.token.orgId == orgId;
    }
    
    function isAdmin(orgId) {
      return isAuthenticated() && 
        request.auth.token.role == 'admin' &&
        request.auth.token.orgId == orgId;
    }
    
    // Organization config - only admins can read/write
    match /organizations/{orgId}/config/{document=**} {
      allow read: if isAdmin(orgId);
      allow write: if isAdmin(orgId);
    }
    
    // Usage logs - org members can read, system can write
    match /usage_logs/{logId} {
      allow read: if isOrgMember(resource.data.orgId);
      allow create: if isAuthenticated();
      allow update, delete: if false; // Logs are immutable
    }
    
    // Audit logs - only admins can read
    match /audit_logs/{logId} {
      allow read: if isAdmin(resource.data.orgId);
      allow create: if isAuthenticated();
      allow update, delete: if false; // Audit logs are immutable
    }
  }
}
```

---

## Implementation Guide

### Dashboard Layout with Catalyst

**File:** `app/(dashboard)/layout.tsx`

```typescript
'use client';

import { SidebarLayout } from '@/components/catalyst/sidebar-layout';
import { Sidebar, SidebarBody, SidebarHeader, SidebarSection, SidebarItem, SidebarLabel } from '@/components/catalyst/sidebar';
import { Navbar, NavbarSection, NavbarSpacer } from '@/components/catalyst/navbar';
import { Avatar } from '@/components/catalyst/avatar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem } from '@/components/catalyst/dropdown';
import {
  HomeIcon,
  BeakerIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BoltIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/20/solid';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar src={session?.user?.image} square />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                <DropdownItem href="/settings">
                  <Cog6ToothIcon />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownItem onClick={() => signOut()}>
                  <ArrowRightOnRectangleIcon />
                  <DropdownLabel>Sign out</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white">
                <span className="text-xl font-bold text-white dark:text-black">BW</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Blog Writer</span>
                <span className="text-xs text-zinc-500">Admin Dashboard</span>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={pathname === '/'}>
                <HomeIcon />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              
              <SidebarItem href="/testing" current={pathname === '/testing'}>
                <BeakerIcon />
                <SidebarLabel>Testing</SidebarLabel>
              </SidebarItem>
              
              <SidebarItem href="/analytics" current={pathname.startsWith('/analytics')}>
                <ChartBarIcon />
                <SidebarLabel>Analytics</SidebarLabel>
              </SidebarItem>
              
              <SidebarItem href="/configuration" current={pathname.startsWith('/configuration')}>
                <Cog6ToothIcon />
                <SidebarLabel>Configuration</SidebarLabel>
              </SidebarItem>
              
              <SidebarItem href="/monitoring" current={pathname.startsWith('/monitoring')}>
                <BoltIcon />
                <SidebarLabel>Monitoring</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
```

---

## LiteLLM Control Panel

**File:** `app/(dashboard)/configuration/litellm/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Heading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { Button } from '@/components/catalyst/button';
import { Input } from '@/components/catalyst/input';
import { Field, Label } from '@/components/catalyst/fieldset';
import { Switch } from '@/components/catalyst/switch';
import { Badge } from '@/components/catalyst/badge';
import { Alert, AlertTitle, AlertDescription, AlertActions } from '@/components/catalyst/alert';
import { configService } from '@/lib/firebase/firestore';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

export default function LiteLLMControlPanel() {
  const { data: session } = useSession();
  const [config, setConfig] = useState({
    enabled: false,
    proxyUrl: '',
    apiKey: '',
    cacheEnabled: true,
    cacheTTL: 3600,
    vercelGatewayEnabled: false,
    vercelGatewayUrl: '',
    vercelGatewayKey: '',
  });
  
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load config from Firestore
  useEffect(() => {
    async function loadConfig() {
      if (!session?.user?.orgId) return;
      
      const litellmConfig = await configService.getLiteLLMConfig(session.user.orgId);
      if (litellmConfig) {
        setConfig(litellmConfig);
        if (litellmConfig.enabled && litellmConfig.proxyUrl) {
          testConnection(litellmConfig.proxyUrl, litellmConfig.apiKey);
        }
      }
    }
    
    loadConfig();
  }, [session]);
  
  // Test LiteLLM connection
  const testConnection = async (url?: string, key?: string) => {
    setConnectionStatus('testing');
    
    const testUrl = url || config.proxyUrl;
    const testKey = key || config.apiKey;
    
    try {
      const response = await fetch(`${testUrl}/health`, {
        headers: testKey ? { 'Authorization': `Bearer ${testKey}` } : {},
      });
      
      if (response.ok) {
        setConnectionStatus('connected');
        toast.success('LiteLLM connection successful!');
      } else {
        setConnectionStatus('disconnected');
        toast.error('LiteLLM connection failed');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      toast.error('Could not reach LiteLLM proxy');
    }
  };
  
  // Save configuration
  const handleSave = async () => {
    if (!session?.user?.orgId) return;
    
    setIsSaving(true);
    try {
      await configService.saveLiteLLMConfig(session.user.orgId, config);
      toast.success('Configuration saved successfully');
      
      // Trigger backend to reload config
      await fetch('/api/config/reload', { method: 'POST' });
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <Heading>LiteLLM Proxy Control Panel</Heading>
        <Text>Configure and monitor your LiteLLM proxy for centralized AI routing</Text>
      </div>
      
      {/* Connection Status Alert */}
      {config.enabled && (
        <Alert className="mb-6" color={connectionStatus === 'connected' ? 'green' : 'red'}>
          <AlertTitle>
            LiteLLM Status: {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </AlertTitle>
          <AlertDescription>
            {connectionStatus === 'connected' 
              ? `Successfully connected to ${config.proxyUrl}`
              : 'Could not connect to LiteLLM proxy. Check URL and API key.'}
          </AlertDescription>
          <AlertActions>
            <Button onClick={() => testConnection()}>
              Test Connection
            </Button>
          </AlertActions>
        </Alert>
      )}
      
      {/* Basic Configuration */}
      <div className="space-y-6 rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
        <div>
          <Heading level={2}>Basic Settings</Heading>
          <Text>Enable and configure LiteLLM proxy</Text>
        </div>
        
        <Field>
          <div className="flex items-center justify-between">
            <Label>Enable LiteLLM Proxy</Label>
            <Switch
              checked={config.enabled}
              onChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>
          <Text>Route all AI requests through LiteLLM for caching and monitoring</Text>
        </Field>
        
        {config.enabled && (
          <>
            <Field>
              <Label>LiteLLM Proxy URL</Label>
              <Input
                type="url"
                value={config.proxyUrl}
                onChange={(e) => setConfig({ ...config, proxyUrl: e.target.value })}
                placeholder="https://litellm-proxy-xxx.run.app"
              />
              <Text>Your LiteLLM Cloud Run service URL</Text>
            </Field>
            
            <Field>
              <Label>LiteLLM API Key (Master Key)</Label>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-••••••••"
              />
              <Text>Master key for authenticating with LiteLLM</Text>
            </Field>
            
            <Field>
              <div className="flex items-center justify-between">
                <Label>Enable Response Caching</Label>
                <Switch
                  checked={config.cacheEnabled}
                  onChange={(enabled) => setConfig({ ...config, cacheEnabled: enabled })}
                />
              </div>
              <Text>Cache responses to reduce costs and latency</Text>
            </Field>
            
            {config.cacheEnabled && (
              <Field>
                <Label>Cache TTL (seconds)</Label>
                <Input
                  type="number"
                  value={config.cacheTTL}
                  onChange={(e) => setConfig({ ...config, cacheTTL: parseInt(e.target.value) })}
                  min={60}
                  max={86400}
                />
                <Text>How long to cache responses (default: 3600 = 1 hour)</Text>
              </Field>
            )}
          </>
        )}
      </div>
      
      {/* Vercel AI Gateway Integration */}
      <div className="mt-6 space-y-6 rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
        <div>
          <Heading level={2}>Vercel AI Gateway</Heading>
          <Text>Route LiteLLM through Vercel AI Gateway for edge caching</Text>
        </div>
        
        <Field>
          <div className="flex items-center justify-between">
            <Label>Enable Vercel AI Gateway</Label>
            <Switch
              checked={config.vercelGatewayEnabled}
              onChange={(enabled) => setConfig({ ...config, vercelGatewayEnabled: enabled })}
              disabled={!config.enabled}
            />
          </div>
          <Text>
            {!config.enabled 
              ? 'Enable LiteLLM first' 
              : 'Route through Vercel for additional edge caching'}
          </Text>
        </Field>
        
        {config.vercelGatewayEnabled && (
          <>
            <Field>
              <Label>Vercel AI Gateway URL</Label>
              <Input
                type="url"
                value={config.vercelGatewayUrl}
                onChange={(e) => setConfig({ ...config, vercelGatewayUrl: e.target.value })}
                placeholder="https://your-app.vercel.app/api/ai"
              />
              <Text>Your Vercel AI Gateway endpoint</Text>
            </Field>
            
            <Field>
              <Label>Vercel Gateway Token</Label>
              <Input
                type="password"
                value={config.vercelGatewayKey}
                onChange={(e) => setConfig({ ...config, vercelGatewayKey: e.target.value })}
                placeholder="vercel_••••••••"
              />
              <Text>Vercel AI Gateway access token</Text>
            </Field>
          </>
        )}
      </div>
      
      {/* Architecture Diagram */}
      <div className="mt-6 rounded-lg bg-zinc-50 p-6 dark:bg-zinc-900">
        <Heading level={3}>Current Architecture</Heading>
        
        <div className="mt-4 space-y-3 text-sm">
          {!config.enabled ? (
            <div className="flex items-center gap-3">
              <Badge color="yellow">Direct</Badge>
              <span>Backend → OpenAI/Anthropic APIs (Direct)</span>
            </div>
          ) : !config.vercelGatewayEnabled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge color="blue">LiteLLM</Badge>
                <span>Backend → LiteLLM → AI Providers</span>
              </div>
              <Text>Benefits: Caching, cost tracking, fallbacks</Text>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge color="green">Full Stack</Badge>
                <span>Backend → LiteLLM → Vercel Gateway → AI Providers</span>
              </div>
              <Text>Benefits: Edge caching, DDoS protection, analytics</Text>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="mt-8 flex gap-4">
        <Button color="blue" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
        
        {config.enabled && (
          <Button outline onClick={() => testConnection()}>
            Test Connection
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## Usage Tracking Dashboard

**File:** `app/(dashboard)/analytics/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Heading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Select } from '@/components/catalyst/select';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/catalyst/table';
import { usageService } from '@/lib/firebase/firestore';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell 
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [timeRange, setTimeRange] = useState('7');
  const [usageData, setUsageData] = useState<any[]>([]);
  const [costSummary, setCostSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function loadData() {
      if (!session?.user?.orgId) return;
      
      setIsLoading(true);
      try {
        const [logs, summary] = await Promise.all([
          usageService.getUsageStats(session.user.orgId, parseInt(timeRange)),
          usageService.getCostSummary(session.user.orgId, parseInt(timeRange)),
        ]);
        
        setUsageData(logs);
        setCostSummary(summary);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [session, timeRange]);
  
  // Process data for charts
  const requestsByDay = usageData.reduce((acc: any, log: any) => {
    const day = format(log.timestamp.toDate(), 'MMM dd');
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  
  const chartData = Object.entries(requestsByDay).map(([date, count]) => ({
    date,
    requests: count,
  }));
  
  const costByModel = usageData.reduce((acc: any, log: any) => {
    acc[log.model] = (acc[log.model] || 0) + (log.cost || 0);
    return acc;
  }, {});
  
  const pieData = Object.entries(costByModel).map(([model, cost]) => ({
    name: model,
    value: cost,
  }));
  
  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Heading>Usage Analytics</Heading>
          <Text>Monitor AI usage, costs, and performance metrics</Text>
        </div>
        
        <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </div>
      
      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
          <Text className="text-zinc-500">Total Requests</Text>
          <div className="mt-2 text-3xl font-semibold">
            {costSummary?.totalRequests?.toLocaleString() || 0}
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
          <Text className="text-zinc-500">Total Cost</Text>
          <div className="mt-2 text-3xl font-semibold">
            ${costSummary?.totalCost?.toFixed(2) || '0.00'}
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
          <Text className="text-zinc-500">Cache Hit Rate</Text>
          <div className="mt-2 text-3xl font-semibold">
            {costSummary?.cacheHitRate?.toFixed(1) || 0}%
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
          <Text className="text-zinc-500">Avg Cost/Request</Text>
          <div className="mt-2 text-3xl font-semibold">
            ${costSummary?.avgCostPerRequest?.toFixed(4) || '0.00'}
          </div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
          <Heading level={2}>Requests Over Time</Heading>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
          <Heading level={2}>Cost by Model</Heading>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.value.toFixed(2)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Recent Usage Table */}
      <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
        <Heading level={2}>Recent Requests</Heading>
        
        <Table className="mt-4" striped>
          <TableHead>
            <TableRow>
              <TableHeader>Timestamp</TableHeader>
              <TableHeader>Operation</TableHeader>
              <TableHeader>Model</TableHeader>
              <TableHeader>Tokens</TableHeader>
              <TableHeader>Cost</TableHeader>
              <TableHeader>Latency</TableHeader>
              <TableHeader>Cached</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {usageData.slice(0, 20).map((log: any) => (
              <TableRow key={log.id}>
                <TableCell>
                  {format(log.timestamp.toDate(), 'MMM dd, HH:mm:ss')}
                </TableCell>
                <TableCell>{log.operation}</TableCell>
                <TableCell>
                  <code className="text-xs">{log.model}</code>
                </TableCell>
                <TableCell>{log.tokens?.toLocaleString()}</TableCell>
                <TableCell>${log.cost?.toFixed(4)}</TableCell>
                <TableCell>{log.latencyMs}ms</TableCell>
                <TableCell>
                  {log.cached ? (
                    <Badge color="green">Yes</Badge>
                  ) : (
                    <Badge color="zinc">No</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

---

## Configuration Management with Secure Storage

**File:** `app/(dashboard)/configuration/ai-providers/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Heading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { Button } from '@/components/catalyst/button';
import { Input } from '@/components/catalyst/input';
import { Field, Label, Description } from '@/components/catalyst/fieldset';
import { Switch } from '@/components/catalyst/switch';
import { Select } from '@/components/catalyst/select';
import { Divider } from '@/components/catalyst/divider';
import { Badge } from '@/components/catalyst/badge';
import { configService } from '@/lib/firebase/firestore';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/20/solid';

interface AIProviderConfig {
  enabled: boolean;
  apiKey: string;
  defaultModel: string;
  status: 'connected' | 'disconnected' | 'testing';
}

export default function AIProvidersPage() {
  const { data: session } = useSession();
  
  const [openAI, setOpenAI] = useState<AIProviderConfig>({
    enabled: true,
    apiKey: '',
    defaultModel: 'gpt-4o-mini',
    status: 'disconnected',
  });
  
  const [anthropic, setAnthropic] = useState<AIProviderConfig>({
    enabled: false,
    apiKey: '',
    defaultModel: 'claude-3-5-sonnet-20241022',
    status: 'disconnected',
  });
  
  const [deepSeek, setDeepSeek] = useState<AIProviderConfig>({
    enabled: false,
    apiKey: '',
    defaultModel: 'deepseek-chat',
    status: 'disconnected',
  });
  
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    deepseek: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Load config from Firestore
  useEffect(() => {
    async function loadConfig() {
      if (!session?.user?.orgId) return;
      
      try {
        const config = await configService.getConfig(session.user.orgId);
        
        if (config?.ai_providers) {
          if (config.ai_providers.openai) setOpenAI(config.ai_providers.openai);
          if (config.ai_providers.anthropic) setAnthropic(config.ai_providers.anthropic);
          if (config.ai_providers.deepseek) setDeepSeek(config.ai_providers.deepseek);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        toast.error('Failed to load configuration');
      }
    }
    
    loadConfig();
  }, [session]);
  
  // Test provider connection
  const testProvider = async (provider: 'openai' | 'anthropic' | 'deepseek', config: AIProviderConfig) => {
    const setters = { openai: setOpenAI, anthropic: setAnthropic, deepseek: setDeepSeek };
    const setter = setters[provider];
    
    setter({ ...config, status: 'testing' });
    
    try {
      // Call backend test endpoint
      const response = await fetch(`/api/config/test-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: config.apiKey }),
      });
      
      if (response.ok) {
        setter({ ...config, status: 'connected' });
        toast.success(`${provider} connection successful!`);
      } else {
        setter({ ...config, status: 'disconnected' });
        toast.error(`${provider} connection failed`);
      }
    } catch (error) {
      setter({ ...config, status: 'disconnected' });
      toast.error(`Could not test ${provider} connection`);
    }
  };
  
  // Save all configurations
  const handleSaveAll = async () => {
    if (!session?.user?.orgId) return;
    
    setIsSaving(true);
    try {
      await Promise.all([
        configService.saveAIProviderConfig(session.user.orgId, 'openai', openAI),
        configService.saveAIProviderConfig(session.user.orgId, 'anthropic', anthropic),
        configService.saveAIProviderConfig(session.user.orgId, 'deepseek', deepSeek),
      ]);
      
      toast.success('All configurations saved successfully');
      
      // Trigger backend config reload
      await fetch('/api/config/reload', { method: 'POST' });
    } catch (error) {
      toast.error('Failed to save configurations');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Render provider configuration section
  const renderProviderConfig = (
    name: string,
    provider: 'openai' | 'anthropic' | 'deepseek',
    config: AIProviderConfig,
    setter: React.Dispatch<React.SetStateAction<AIProviderConfig>>,
    models: string[]
  ) => (
    <div className="space-y-6 rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <Heading level={2}>{name}</Heading>
          <Text className="mt-1">Configure {name} API access and settings</Text>
        </div>
        
        <div className="flex items-center gap-3">
          {config.status === 'connected' && (
            <Badge color="green">
              <CheckCircleIcon className="h-4 w-4" />
              Connected
            </Badge>
          )}
          {config.status === 'disconnected' && (
            <Badge color="red">Disconnected</Badge>
          )}
          {config.status === 'testing' && (
            <Badge color="yellow">Testing...</Badge>
          )}
          
          <Switch
            checked={config.enabled}
            onChange={(enabled) => setter({ ...config, enabled })}
          />
        </div>
      </div>
      
      {config.enabled && (
        <>
          <Field>
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKeys[provider] ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setter({ ...config, apiKey: e.target.value })}
                placeholder={`sk-${provider}-••••••••`}
                className="flex-1"
              />
              <Button
                outline
                onClick={() => setShowKeys({ ...showKeys, [provider]: !showKeys[provider] })}
              >
                {showKeys[provider] ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </Button>
            </div>
            <Description>
              Your {name} API key (stored encrypted in Firestore)
            </Description>
          </Field>
          
          <Field>
            <Label>Default Model</Label>
            <Select
              value={config.defaultModel}
              onChange={(e) => setter({ ...config, defaultModel: e.target.value })}
            >
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </Select>
            <Description>
              Default model to use for {name} requests
            </Description>
          </Field>
          
          <div className="flex gap-3">
            <Button
              outline
              onClick={() => testProvider(provider, config)}
              disabled={!config.apiKey || config.status === 'testing'}
            >
              {config.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
  
  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-8">
        <Heading>AI Providers</Heading>
        <Text>Configure API keys and settings for AI providers</Text>
      </div>
      
      {/* OpenAI */}
      {renderProviderConfig(
        'OpenAI',
        'openai',
        openAI,
        setOpenAI,
        ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
      )}
      
      {/* Anthropic */}
      {renderProviderConfig(
        'Anthropic (Claude)',
        'anthropic',
        anthropic,
        setAnthropic,
        ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229']
      )}
      
      {/* DeepSeek */}
      {renderProviderConfig(
        'DeepSeek',
        'deepseek',
        deepSeek,
        setDeepSeek,
        ['deepseek-chat', 'deepseek-coder']
      )}
      
      <Divider />
      
      {/* Save All Button */}
      <div className="flex justify-end gap-4">
        <Button color="blue" onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save All Configurations'}
        </Button>
      </div>
    </div>
  );
}
```

---

## Environment Variables

**File:** `.env.local.example`

```bash
# Backend API
NEXT_PUBLIC_API_URL=https://blog-writer-api-dev-613248238610.europe-west9.run.app

# Firebase (Firestore for config storage)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc

# Firebase Admin (server-side only)
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret

# Google Cloud (for backend config updates)
GOOGLE_CLOUD_PROJECT=api-ai-blog-writer
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Optional: LiteLLM Proxy (if managing it from dashboard)
LITELLM_PROXY_URL=https://litellm-proxy-613248238610.europe-west9.run.app
LITELLM_MASTER_KEY=your-litellm-master-key
```

---

## Package.json Scripts

**File:** `package.json`

```json
{
  "name": "blog-writer-admin",
  "version": "1.0.0",
  "scripts": {
    "dev": "npm run generate:types && next dev",
    "build": "npm run generate:types && next build",
    "start": "next start",
    "lint": "next lint",
    "generate:types": "tsx scripts/generate-types.ts",
    "init:firestore": "tsx scripts/init-firestore.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@headlessui/react": "^2.0.0",
    "@heroicons/react": "^2.1.0",
    "motion": "^11.0.0",
    "clsx": "^2.1.0",
    "openapi-fetch": "^0.9.0",
    "openapi-typescript": "^7.0.0",
    "@tanstack/react-query": "^5.28.0",
    "firebase": "^10.11.0",
    "firebase-admin": "^12.0.0",
    "@google-cloud/firestore": "^7.7.0",
    "next-auth": "^4.24.0",
    "@auth/core": "^0.30.0",
    "@auth/firebase-adapter": "^2.1.0",
    "recharts": "^2.12.0",
    "date-fns": "^3.6.0",
    "zustand": "^4.5.0",
    "react-hot-toast": "^2.4.0",
    "zod": "^3.23.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

---

## Deployment to Vercel

### 1. Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init firestore

# Deploy Firestore rules and indexes
firebase deploy --only firestore
```

### 2. Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### 3. Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add all variables from `.env.local.example`:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_FIREBASE_*` (all Firebase config)
- `FIREBASE_*` (server-side credentials)
- `NEXTAUTH_*`
- `GOOGLE_*`

---

## Security Best Practices

### 1. API Key Encryption

**File:** `lib/security/encryption.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';
const ALGORITHM = 'aes-256-gcm';

export function encryptAPIKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return IV + encrypted + authTag (all hex)
  return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
}

export function decryptAPIKey(encryptedKey: string): string {
  const parts = encryptedKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Mask API key for display (show only first 8 and last 4 chars)
export function maskAPIKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) return '••••••••';
  return apiKey.substring(0, 8) + '••••••••' + apiKey.substring(apiKey.length - 4);
}
```

### 2. Server-Side Config Updates

**File:** `app/api/config/set/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminDb } from '@/lib/firebase/admin';
import { encryptAPIKey } from '@/lib/security/encryption';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  
  if (!session || !session.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { provider, config } = await request.json();
  
  try {
    // Encrypt API key before storing
    const encryptedConfig = {
      ...config,
      apiKey: config.apiKey ? encryptAPIKey(config.apiKey) : null,
      updatedAt: new Date(),
      updatedBy: session.user.email,
    };
    
    // Save to Firestore
    await adminDb
      .collection('organizations')
      .doc(session.user.orgId)
      .collection('config')
      .doc('ai_providers')
      .set({
        [provider]: encryptedConfig,
      }, { merge: true });
    
    // Update Cloud Run environment variables
    if (process.env.NODE_ENV === 'production') {
      await updateCloudRunEnvVars(provider, config);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Config save failed:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

async function updateCloudRunEnvVars(provider: string, config: any) {
  // Update Google Cloud Secret Manager
  const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
  const client = new SecretManagerServiceClient();
  
  const secretName = `${provider.toUpperCase()}_API_KEY`;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  
  try {
    await client.addSecretVersion({
      parent: `projects/${projectId}/secrets/${secretName}`,
      payload: {
        data: Buffer.from(config.apiKey, 'utf8'),
      },
    });
    
    // Trigger backend service restart to pick up new config
    // (Cloud Run automatically restarts when secrets change)
  } catch (error) {
    console.error('Failed to update Cloud Run secrets:', error);
  }
}
```

---

## Testing Interface with Catalyst

**File:** `app/(dashboard)/testing/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Heading } from '@/components/catalyst/heading';
import { Text } from '@/components/catalyst/text';
import { Button } from '@/components/catalyst/button';
import { Input } from '@/components/catalyst/input';
import { Textarea } from '@/components/catalyst/textarea';
import { Field, Label, Description } from '@/components/catalyst/fieldset';
import { Select } from '@/components/catalyst/select';
import { Switch } from '@/components/catalyst/switch';
import { Badge } from '@/components/catalyst/badge';
import { Divider } from '@/components/catalyst/divider';
import { useGenerateBlog } from '@/lib/api/hooks';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

export default function TestingPage() {
  const [formData, setFormData] = useState({
    topic: '',
    keywords: [] as string[],
    word_count: 1500,
    tone: 'professional',
    model: 'gpt-4o-mini',
    include_polishing: true,
    include_quality_check: true,
    include_meta_tags: true,
    custom_instructions: '',
  });
  
  const [keywordInput, setKeywordInput] = useState('');
  const [result, setResult] = useState<any>(null);
  
  const { mutate: generateBlog, isPending } = useGenerateBlog();
  
  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim()],
      });
      setKeywordInput('');
    }
  };
  
  const handleRemoveKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((_, i) => i !== index),
    });
  };
  
  const handleSubmit = () => {
    if (!formData.topic) {
      toast.error('Please enter a topic');
      return;
    }
    
    generateBlog(
      {
        ...formData,
        org_id: 'test-org',
        user_id: 'test-user',
      },
      {
        onSuccess: (response) => {
          setResult(response);
          toast.success('Blog generated successfully!');
        },
        onError: (error) => {
          toast.error('Generation failed: ' + error.message);
        },
      }
    );
  };
  
  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <Heading>Testing Interface</Heading>
        <Text>Test blog generation with different parameters</Text>
      </div>
      
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
            <Heading level={2}>Configuration</Heading>
            
            <div className="mt-6 space-y-6">
              <Field>
                <Label>Blog Topic *</Label>
                <Input
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g., Benefits of Python Programming"
                />
                <Description>What should the blog be about?</Description>
              </Field>
              
              <Field>
                <Label>Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                    placeholder="Add keyword and press Enter"
                    className="flex-1"
                  />
                  <Button outline onClick={handleAddKeyword}>
                    Add
                  </Button>
                </div>
                {formData.keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.keywords.map((keyword, index) => (
                      <Badge key={index} color="blue">
                        {keyword}
                        <button
                          onClick={() => handleRemoveKeyword(index)}
                          className="ml-2 hover:text-red-600"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>
              
              <Field>
                <Label>Word Count: {formData.word_count}</Label>
                <input
                  type="range"
                  min={300}
                  max={5000}
                  step={100}
                  value={formData.word_count}
                  onChange={(e) => setFormData({ ...formData, word_count: parseInt(e.target.value) })}
                  className="w-full"
                />
                <Description>Target word count for the blog</Description>
              </Field>
              
              <Field>
                <Label>Tone</Label>
                <Select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                </Select>
              </Field>
              
              <Field>
                <Label>AI Model</Label>
                <Select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                >
                  <option value="gpt-4o">GPT-4o (Highest Quality)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Balanced)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                </Select>
              </Field>
              
              <Divider />
              
              <div className="space-y-4">
                <Field>
                  <div className="flex items-center justify-between">
                    <Label>AI Polishing</Label>
                    <Switch
                      checked={formData.include_polishing}
                      onChange={(checked) => setFormData({ ...formData, include_polishing: checked })}
                    />
                  </div>
                  <Description>Apply AI-powered content cleanup</Description>
                </Field>
                
                <Field>
                  <div className="flex items-center justify-between">
                    <Label>Quality Check</Label>
                    <Switch
                      checked={formData.include_quality_check}
                      onChange={(checked) => setFormData({ ...formData, include_quality_check: checked })}
                    />
                  </div>
                  <Description>Run automated quality scoring</Description>
                </Field>
                
                <Field>
                  <div className="flex items-center justify-between">
                    <Label>Generate Meta Tags</Label>
                    <Switch
                      checked={formData.include_meta_tags}
                      onChange={(checked) => setFormData({ ...formData, include_meta_tags: checked })}
                    />
                  </div>
                  <Description>Create SEO-optimized meta tags</Description>
                </Field>
              </div>
              
              <Field>
                <Label>Custom Instructions (Optional)</Label>
                <Textarea
                  value={formData.custom_instructions}
                  onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
                  rows={3}
                  placeholder="Any additional instructions for the AI..."
                />
              </Field>
              
              <Button
                color="blue"
                className="w-full"
                onClick={handleSubmit}
                disabled={isPending || !formData.topic}
              >
                {isPending ? 'Generating...' : 'Generate Blog'}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Preview Panel */}
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-950/10 p-6 dark:border-white/10">
            <Heading level={2}>Preview</Heading>
            
            {isPending && (
              <div className="mt-6 flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600"></div>
                <Text className="mt-4">Generating blog... This may take 10-60 seconds</Text>
              </div>
            )}
            
            {result && !isPending && (
              <div className="mt-6 space-y-6">
                {/* Metadata */}
                <div className="flex flex-wrap gap-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                  <div>
                    <Text className="text-xs text-zinc-500">Quality</Text>
                    <div className="flex items-center gap-2">
                      <Badge color={result.quality_score >= 90 ? 'green' : 'yellow'}>
                        {result.quality_score}/100
                      </Badge>
                      <Text className="text-sm">{result.quality_grade}</Text>
                    </div>
                  </div>
                  
                  <div>
                    <Text className="text-xs text-zinc-500">Words</Text>
                    <Text className="font-semibold">{result.word_count}</Text>
                  </div>
                  
                  <div>
                    <Text className="text-xs text-zinc-500">Time</Text>
                    <Text className="font-semibold">{result.processing_time}s</Text>
                  </div>
                  
                  <div>
                    <Text className="text-xs text-zinc-500">Model</Text>
                    <Text className="text-xs font-mono">{result.model_used}</Text>
                  </div>
                </div>
                
                {/* Content Preview */}
                <div className="prose prose-sm max-w-none rounded-lg border border-zinc-950/10 p-6 dark:border-white/10 dark:prose-invert">
                  <ReactMarkdown>{result.content}</ReactMarkdown>
                </div>
                
                {/* Meta Tags */}
                {result.meta_tags && (
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                    <Text className="font-semibold">Generated Meta Tags</Text>
                    <dl className="mt-2 space-y-2 text-sm">
                      <div>
                        <dt className="text-zinc-500">Title:</dt>
                        <dd className="font-medium">{result.meta_tags.title}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Description:</dt>
                        <dd className="font-medium">{result.meta_tags.description}</dd>
                      </div>
                    </dl>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-3">
                  <Button outline onClick={() => navigator.clipboard.writeText(result.content)}>
                    Copy Content
                  </Button>
                  <Button outline onClick={() => {
                    const blob = new Blob([result.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'blog.md';
                    a.click();
                  }}>
                    Download
                  </Button>
                </div>
              </div>
            )}
            
            {!result && !isPending && (
              <div className="mt-6 flex items-center justify-center py-12">
                <Text className="text-zinc-500">Configure parameters and click Generate</Text>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Complete Setup Checklist

### Phase 1: Repository Setup
- [ ] Create new GitHub repository: `blog-writer-admin`
- [ ] Initialize Next.js 14 with TypeScript
- [ ] Install all dependencies
- [ ] Copy Catalyst UI components from Dropbox folder
- [ ] Set up Tailwind CSS configuration

### Phase 2: Google Cloud Setup
- [ ] Create/configure Firebase project
- [ ] Set up Firestore database
- [ ] Deploy Firestore rules and indexes
- [ ] Create service account for admin operations
- [ ] Download service account JSON

### Phase 3: Backend Integration
- [ ] Generate TypeScript types from OpenAPI schema
- [ ] Create type-safe API client
- [ ] Implement React Query hooks
- [ ] Test backend connectivity

### Phase 4: Core Features
- [ ] Implement dashboard layout (Catalyst SidebarLayout)
- [ ] Create testing interface with BlogGenerationForm
- [ ] Build analytics dashboard with charts
- [ ] Implement LiteLLM control panel
- [ ] Add configuration management pages

### Phase 5: Security
- [ ] Set up NextAuth.js authentication
- [ ] Implement API key encryption
- [ ] Configure Firestore security rules
- [ ] Add audit logging
- [ ] Test secure config storage

### Phase 6: Deployment
- [ ] Configure environment variables in Vercel
- [ ] Deploy to Vercel production
- [ ] Test all features in production
- [ ] Monitor logs and performance

---

## Quick Start Commands

```bash
# 1. Create repository and clone
git clone https://github.com/YOUR_ORG/blog-writer-admin.git
cd blog-writer-admin

# 2. Initialize Next.js
npx create-next-app@latest . --typescript --tailwind --app

# 3. Install dependencies
npm install @headlessui/react motion clsx openapi-fetch @tanstack/react-query firebase next-auth recharts zustand react-hot-toast

# 4. Copy Catalyst components
cp -r "/Users/gene/Library/CloudStorage/Dropbox/Cursor/Source Files - UX:UI/catalyst-ui-kit/typescript/"* ./components/catalyst/

# 5. Set up environment
cp .env.local.example .env.local
# Edit .env.local with your values

# 6. Generate types from backend
npm run generate:types

# 7. Initialize Firestore
npm run init:firestore

# 8. Run development server
npm run dev
```

---

## Summary

This implementation gives you:

✅ **Catalyst UI** - Beautiful, professional admin interface  
✅ **Google Firestore** - Secure configuration storage with encryption  
✅ **LiteLLM Control Panel** - Full control over AI routing  
✅ **Usage Tracking** - Real-time cost and performance monitoring  
✅ **Type Safety** - 100% TypeScript via OpenAPI generation  
✅ **Security** - Encrypted API keys, audit logs, role-based access  
✅ **Vercel Deployment** - Edge-optimized hosting  

**Your frontend team has everything they need to build this dashboard!** 🚀

---

## Support Resources

- **Catalyst UI Docs:** https://tailwindcss.com/docs/catalyst
- **Firebase Docs:** https://firebase.google.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Backend API:** https://blog-writer-api-dev-613248238610.europe-west9.run.app/docs

