# Role Hierarchy - Platform/System Admin Model

This document outlines the role structure following Google Workspace and HubSpot's organization model.

## 🔹 Platform Admin (System-Level Authority)

**What it is:** The root administrator who owns and controls the entire SaaS platform.
In the UI this role is shown as **System Admin** (badge/menu naming), but in code/DB the role name is **Platform Admin**.

### Powers and Responsibilities:

| Capability | Description |
|------------|-------------|
| Full platform control | Modify all system-level settings and configurations |
| Domain management | Add/remove domains, configure DNS, SSL certificates |
| All users & tenants | Create, modify, delete any user or organization |
| Security policies | Global MFA, SSO, conditional access, compliance rules |
| Billing & licensing | Subscription management, product entitlements, renewals |
| Cannot be restricted | Top-level authority, no one can limit their access |

**Real-World Equivalent:**
- Google Workspace: *Super Admin*
- HubSpot: *Super Admin*
- Building analogy: *Building Owner*

**Technical Implementation:**
- `users.tenant_id = NULL` (not tied to any specific tenant)
- `users.role_id` = "Platform Admin"
- Bypasses all RLS policies
- Has access to all data across all organizations

---

## 🔹 Organization Admin (Company-Level Authority)

**What it is:** Administrator who manages their company/organization within the platform, but doesn't control the platform itself.

### Powers and Responsibilities:

| Capability | Description |
|------------|-------------|
| Manage organization users | Add, edit, remove users within their organization |
| Team & role management | Create teams, assign roles, manage permissions |
| Access to org tools | Configure apps, workflows, integrations for their org |
| Staff operations | Onboarding, offboarding, access provisioning |
| **Cannot** modify tenant settings | No domain setup, global security policies, or billing |
| **Cannot** see other orgs | Isolated to their organization's data only |

**Real-World Equivalent:**
- Google Workspace: *Admin* (Organization-level)
- HubSpot: *Account Admin*
- Building analogy: *Office Manager*

**Technical Implementation:**
- `users.tenant_id = <their_org_id>` (tied to specific organization)
- `users.role_id` = "Organization Admin"
- Subject to RLS policies for their tenant
- Can only access data within their organization

---

## 📊 Comparison Table

| Aspect | Platform Admin | Organization Admin |
|--------|--------------|-------------------|
| **Scope** | Entire platform | Single organization |
| **User Management** | All users | Organization users only |
| **Domain Control** | ✅ Yes | ❌ No |
| **Billing Access** | ✅ Full | ❌ View only (their org) |
| **Security Policies** | ✅ Global | ❌ Org-level only |
| **Multi-Org Visibility** | ✅ All orgs | ❌ Their org only |
| **RLS Restrictions** | ❌ Bypassed | ✅ Applied |
| **Can be restricted** | ❌ No | ✅ Yes (by Platform Admin) |

---

## 🧭 Menu Visibility Matrix

| Menu Area | Platform Admin (System Admin UI) | Organization Admin | Billing Owner / Developer / Viewer |
|-----------|----------------------------------|--------------------|-------------------------------------|
| Dashboard / CRM / Support / AI | ✅ | ✅ | ✅ (permission-gated) |
| Admin > User Management | ✅ | ✅ | Depends on role permissions |
| Admin > Tenant Management | ✅ | ❌ | ❌ |
| System Admin section | ✅ | ❌ | ❌ |
| SaaS platform section | ✅ | ❌ | ❌ |

Notes:
- **System Admin** in the sidebar refers to the same actor as **Platform Admin** in DB/code.
- Users below Organization Admin must not see other organizations unless explicitly granted through role setup.

---

## 🔄 Other Roles (Within Organization)

### Billing Owner
- Manages billing and subscriptions for their organization
- View/update payment methods, invoices
- Cannot manage users or security

### Developer
- API access and integrations
- Deploy and manage applications
- Limited user management

### Viewer
- Read-only access to organization data
- Cannot modify settings or users
- Reporting and analytics only

---

## 🏗️ Real-World Examples

### Google Workspace Style:
```
Platform Admin (Super Admin)
└── Organization: Acme Corp
    ├── Organization Admin (Admin)
    ├── Billing Owner
    ├── Developer
    └── Viewer (User)
```

### HubSpot Style:
```
Platform Admin (Super Admin)
└── Account: Acme Marketing
    ├── Organization Admin (Account Admin)
    ├── Billing Owner (Billing Admin)
    ├── Developer (Developer)
    └── Viewer (Basic User)
```

---

## 🔐 Technical Implementation Notes

### Platform Admin Detection:
```typescript
const isPlatformAdmin = user.role_id === "Platform Admin" && user.tenant_id === null;
```

### Organization Admin Detection:
```typescript
const isOrgAdmin = user.role_id === "Organization Admin" && user.tenant_id !== null;
```

### Multi-Role Support:
A Platform Admin can also have an Organization Admin role for a specific tenant via `user_tenant_roles`:
```typescript
// Platform-level access
users.role_id = "Platform Admin"
users.tenant_id = NULL

// Also manage Acme Corp as Org Admin
user_tenant_roles:
  - user_id: <tenant_admin_id>
  - tenant_id: <acme_corp_id>
  - role_id: "Organization Admin"
```

This allows a Platform Admin to "wear two hats" - platform oversight + hands-on org management.

---

## 🔧 Troubleshooting: Organisation Admin sees platform menus / all users

In code the platform-level role is named **"Platform Admin"** (not "Tenant Admin"). The app treats you as Platform Admin only when **both** are true:

- `roles.name = 'Platform Admin'`
- `users.tenant_id IS NULL`

If you are an Organisation Admin but still see "System Admin", "SaaS", and users from other tenants:

1. **Check what the app thinks**  
   While logged in, open: `GET /api/admin/check-platform-admin`  
   You should see `"isPlatformAdmin": false`, `"role": "Organization Admin"`, and a non-null `tenantId`.

2. **Verify user rows in the DB**  
   From the repo root:
   ```bash
   npx tsx scripts/verify-rbac-users.ts
   ```
   This lists every user with role and tenant. Anyone with role "Platform Admin" and `tenant_id` NULL is treated as Platform Admin and will see everything.

3. **Fix an Organisation Admin that was given Platform Admin by mistake**  
   Set their role to "Organization Admin" and their tenant to the correct org:
   ```bash
   npx tsx scripts/list-tenants.ts                    # get <tenant-id> for the org
   npx tsx scripts/assign-org-role.ts <email> <tenant-id>
   ```
   Example for Pet Store Direct admin:
   ```bash
   npx tsx scripts/assign-org-role.ts petstoredirect@tin.info <pet-store-direct-tenant-uuid>
   ```

4. **Redeploy / hard refresh**  
   After changing the DB, redeploy or do a hard refresh so the role check runs again (the sidebar request is not cached).



