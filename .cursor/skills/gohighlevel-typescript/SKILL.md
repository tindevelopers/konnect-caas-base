---
name: gohighlevel-typescript
description: >-
  Integrate with GoHighLevel CRM API for contacts, companies, deals, notes, tasks,
  conversations (SMS/email), campaigns, appointments, pipelines, custom fields, tags,
  users, and webhooks. Use when building CRM integrations, syncing data with GoHighLevel,
  sending messages, managing campaigns, or working with the GoHighLevel provider in
  this project. This skill provides TypeScript examples following the project's CRM
  provider pattern.
metadata:
  author: konnect-caas
  product: crm
  language: typescript
---

# GoHighLevel CRM Integration - TypeScript

## Overview

This project uses a provider pattern for CRM integrations. The GoHighLevel provider is located at `packages/integrations/crm/providers/gohighlevel-provider.ts` and implements the `CrmProvider` interface.

## Setup

The GoHighLevel provider requires:
- `apiKey`: Private Integration Token or Location Access Token
- `locationId`: The GoHighLevel location ID

```typescript
import { GoHighLevelProvider } from '@/packages/integrations/crm/providers/gohighlevel-provider';

const provider = new GoHighLevelProvider();
await provider.initialize({
  provider: 'gohighlevel',
  credentials: {
    apiKey: process.env.GHL_API_KEY,
    locationId: process.env.GHL_LOCATION_ID,
  },
});
```

## Base URL

All requests use: `https://rest.gohighlevel.com/v1`

## Authentication

Include the API key in the Authorization header:
```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
}
```

## Contacts

### List contacts

`GET /contacts` — Requires: `locationId` query parameter

```typescript
const contacts = await provider.listContacts();
// Returns: CrmContact[]

// With query parameters (direct API):
const response = await fetch(
  `https://rest.gohighlevel.com/v1/contacts?locationId=${locationId}&limit=100&startAfter=contact-id`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
```

### Get single contact

`GET /contacts/{id}` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/contacts/${contactId}?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const contact = await response.json();
```

### Create or update contact

`POST /contacts` — Requires: `locationId` in body

```typescript
const contact = await provider.upsertContact({
  id: 'existing-id-or-new',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
});

// With custom fields and tags (direct API):
const response = await fetch('https://rest.gohighlevel.com/v1/contacts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    tags: ['lead', 'qualified'],
    customField: [{ field: 'custom-field-id', value: 'custom-value' }],
  }),
});
```

### Update contact

`PUT /contacts/{id}` — Requires: `locationId` in body

```typescript
const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    firstName: 'Jane',
    email: 'jane@example.com',
  }),
});
```

### Delete contact

`DELETE /contacts/{id}` — Requires: `locationId` query parameter

```typescript
await provider.deleteContact('contact-id');

// Direct API:
await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}?locationId=${locationId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
```

### Search contacts

`GET /contacts/search` — Requires: `locationId` and search query

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/contacts/search?locationId=${locationId}&query=john@example.com`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const results = await response.json();
```

### Add tags to contact

`PUT /contacts/{id}/tags` — Requires: `locationId` and tags array

```typescript
const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}/tags`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    tags: ['tag1', 'tag2'],
  }),
});
```

## Companies

### List companies

`GET /companies` — Requires: `locationId` query parameter

```typescript
const companies = await provider.listCompanies();
// Returns: CrmCompany[]
// Note: writeCompanies is disabled - GHL limits company editing via API
```

## Deals (Opportunities)

### List deals

`GET /opportunities` — Requires: `locationId` query parameter

```typescript
const deals = await provider.listDeals();
// Returns: CrmDeal[]

// With filters (direct API):
const response = await fetch(
  `https://rest.gohighlevel.com/v1/opportunities?locationId=${locationId}&pipelineId=pipeline-id&stageId=stage-id`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
```

### Get single deal

`GET /opportunities/{id}` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/opportunities/${dealId}?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const deal = await response.json();
```

### Create or update deal

`POST /opportunities` — Requires: `locationId` in body

```typescript
const deal = await provider.upsertDeal({
  id: 'deal-id',
  title: 'New Deal',
  stage: 'qualified',
  value: 5000,
  currency: 'USD',
});

// With full details (direct API):
const response = await fetch('https://rest.gohighlevel.com/v1/opportunities', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    title: 'New Deal',
    pipelineId: 'pipeline-id',
    pipelineStageId: 'stage-id',
    monetaryValue: 5000,
    currency: 'USD',
    contactId: 'contact-id',
    assignedTo: 'user-id',
  }),
});
```

### Update deal

`PUT /opportunities/{id}` — Requires: `locationId` in body

```typescript
const response = await fetch(`https://rest.gohighlevel.com/v1/opportunities/${dealId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    title: 'Updated Deal',
    monetaryValue: 7500,
    pipelineStageId: 'new-stage-id',
  }),
});
```

### Delete deal

`DELETE /opportunities/{id}` — Requires: `locationId` query parameter

```typescript
await fetch(`https://rest.gohighlevel.com/v1/opportunities/${dealId}?locationId=${locationId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
```

## Notes

### List notes

`GET /notes` — Requires: `locationId` query parameter

```typescript
const notes = await provider.listNotes();
// Returns: CrmNote[]
```

### Create note

`POST /notes` — Requires: `locationId` in body

```typescript
const note = await provider.createNote({
  id: 'note-id',
  text: 'Follow up call scheduled',
  entityId: 'contact-id',
  entityType: 'contacts',
});

// With user assignment (direct API):
const response = await fetch('https://rest.gohighlevel.com/v1/notes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    contactId: 'contact-id',
    userId: 'user-id',
    body: 'Follow up call scheduled',
  }),
});
```

### Get single note

`GET /notes/{id}` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/notes/${noteId}?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const note = await response.json();
```

### Update note

`PUT /notes/{id}` — Requires: `locationId` in body

```typescript
const response = await fetch(`https://rest.gohighlevel.com/v1/notes/${noteId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    body: 'Updated note text',
  }),
});
```

### Delete note

`DELETE /notes/{id}` — Requires: `locationId` query parameter

```typescript
await fetch(`https://rest.gohighlevel.com/v1/notes/${noteId}?locationId=${locationId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
```

## Tasks

### List tasks

`GET /tasks` — Requires: `locationId` query parameter

```typescript
const tasks = await provider.listTasks();
// Returns: CrmTask[]
```

### Create or update task

`POST /tasks` — Requires: `locationId` in body

```typescript
const task = await provider.upsertTask({
  id: 'task-id',
  title: 'Follow up with client',
  dueDate: '2026-02-15',
  status: 'pending',
  entityId: 'contact-id',
  entityType: 'contacts',
});
```

### Complete task

`POST /tasks/{id}/complete` — Requires: `locationId` query parameter

```typescript
await provider.completeTask('task-id');

// Direct API:
await fetch(`https://rest.gohighlevel.com/v1/tasks/${taskId}/complete?locationId=${locationId}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
```

### Get single task

`GET /tasks/{id}` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/tasks/${taskId}?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const task = await response.json();
```

### Update task

`PUT /tasks/{id}` — Requires: `locationId` in body

```typescript
const response = await fetch(`https://rest.gohighlevel.com/v1/tasks/${taskId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    title: 'Updated task',
    dueDate: '2026-02-20',
    status: 'pending',
  }),
});
```

### Delete task

`DELETE /tasks/{id}` — Requires: `locationId` query parameter

```typescript
await fetch(`https://rest.gohighlevel.com/v1/tasks/${taskId}?locationId=${locationId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${apiKey}` },
});
```

## Conversations

### Send SMS

`POST /conversations/messages` — Requires: `locationId`, `contactId`, `message`

```typescript
const response = await fetch('https://rest.gohighlevel.com/v1/conversations/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    contactId: 'contact-id',
    message: 'Hello from API',
    type: 'SMS',
  }),
});
```

### Send email

`POST /conversations/messages` — Requires: `locationId`, `contactId`, `subject`, `html`

```typescript
const response = await fetch('https://rest.gohighlevel.com/v1/conversations/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    contactId: 'contact-id',
    type: 'EMAIL',
    subject: 'Welcome!',
    html: '<p>Welcome to our service!</p>',
  }),
});
```

### List conversations

`GET /conversations` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/conversations?locationId=${locationId}&contactId=contact-id`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const conversations = await response.json();
```

## Campaigns

### List campaigns

`GET /campaigns` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/campaigns?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const campaigns = await response.json();
```

### Add contact to campaign

`POST /campaigns/{id}/contacts` — Requires: `locationId`, `contactId`

```typescript
const response = await fetch(`https://rest.gohighlevel.com/v1/campaigns/${campaignId}/contacts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    contactId: 'contact-id',
  }),
});
```

## Appointments

### List appointments

`GET /appointments` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/appointments?locationId=${locationId}&startDate=2026-02-01&endDate=2026-02-28`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const appointments = await response.json();
```

### Create appointment

`POST /appointments` — Requires: `locationId`, `calendarId`, `contactId`, `startTime`

```typescript
const response = await fetch('https://rest.gohighlevel.com/v1/appointments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    calendarId: 'calendar-id',
    contactId: 'contact-id',
    startTime: '2026-02-15T10:00:00Z',
    endTime: '2026-02-15T11:00:00Z',
    title: 'Consultation',
  }),
});
```

## Pipelines & Stages

### List pipelines

`GET /pipelines` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/pipelines?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const pipelines = await response.json();
```

### List pipeline stages

`GET /pipelines/{id}/stages` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/pipelines/${pipelineId}/stages?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const stages = await response.json();
```

## Custom Fields

### List custom fields

`GET /customFields` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/customFields?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const customFields = await response.json();
```

## Tags

### List tags

`GET /tags` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/tags?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const tags = await response.json();
```

### Create tag

`POST /tags` — Requires: `locationId`, `name`

```typescript
const response = await fetch('https://rest.gohighlevel.com/v1/tags', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    name: 'New Tag',
  }),
});
```

## Users & Team

### List users

`GET /users` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/users?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const users = await response.json();
```

## Webhooks

### List webhooks

`GET /webhooks` — Requires: `locationId` query parameter

```typescript
const response = await fetch(
  `https://rest.gohighlevel.com/v1/webhooks?locationId=${locationId}`,
  {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  }
);
const webhooks = await response.json();
```

### Create webhook

`POST /webhooks` — Requires: `locationId`, `url`, `events`

```typescript
const response = await fetch('https://rest.gohighlevel.com/v1/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId,
    url: 'https://your-app.com/webhooks/ghl',
    events: ['contact.created', 'contact.updated', 'opportunity.created'],
  }),
});
```

## Query Parameters

Common query parameters for list endpoints:

- `locationId` (required) - Location ID
- `limit` - Number of results (default: 100, max: 1000)
- `startAfter` - Pagination cursor (contact/opportunity ID)
- `contactId` - Filter by contact ID
- `pipelineId` - Filter by pipeline ID
- `stageId` - Filter by stage ID
- `assignedTo` - Filter by assigned user ID
- `startDate` / `endDate` - Date range filters (ISO 8601 format)

Example with pagination:

```typescript
let startAfter: string | undefined;
let allContacts: any[] = [];

do {
  const url = new URL('https://rest.gohighlevel.com/v1/contacts');
  url.searchParams.set('locationId', locationId);
  url.searchParams.set('limit', '100');
  if (startAfter) url.searchParams.set('startAfter', startAfter);

  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await response.json();

  allContacts.push(...data.contacts);
  startAfter = data.meta?.nextCursor;
} while (startAfter);
```

## Provider Capabilities

The GoHighLevel provider supports:
- ✅ Read/Write Contacts
- ✅ Read Companies (write disabled - GHL API limitation)
- ✅ Read/Write Deals
- ✅ Read/Write Notes
- ✅ Read/Write Tasks

## Direct API Requests

For operations not covered by the provider, make direct requests:

```typescript
const response = await fetch('https://rest.gohighlevel.com/v1/endpoint', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId: locationId,
    // ... other params
  }),
});

const data = await response.json();
```

## Error Handling

The provider throws errors with format:
```
GHL request failed: {status} {responseBody}
```

Always wrap provider calls in try/catch:

```typescript
try {
  const contacts = await provider.listContacts();
} catch (error) {
  console.error('GHL API error:', error.message);
}
```

## Type Mappings

The provider maps GoHighLevel records to project types:

- `GoHighLevelRecord` → `CrmContact` / `CrmCompany` / `CrmDeal` / `CrmNote` / `CrmTask`
- External IDs stored in `metadata.externalId`
- Owner/assignee IDs stored in `metadata.authorId` or `assigneeId`

## Common Patterns

### Using the Provider Factory

```typescript
import { createCrmProvider } from '@/packages/integrations/crm/crm-provider-factory';

const provider = await createCrmProvider({
  provider: 'gohighlevel',
  credentials: {
    apiKey: '...',
    locationId: '...',
  },
});
```

### Health Check

```typescript
const isHealthy = await provider.healthCheck();
// Returns: boolean
```

---

## Rate Limits

GoHighLevel API has rate limits:
- Standard: ~100 requests per minute per location
- Burst: Up to 200 requests per minute
- Implement retry logic with exponential backoff for rate limit errors (HTTP 429)

```typescript
async function requestWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return requestWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return requestWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}
```

## Common Response Patterns

### Success Response

```typescript
{
  contact: { id: '...', firstName: '...', ... },
  meta: { nextCursor: '...' }
}
```

### Error Response

```typescript
{
  message: 'Error description',
  errors: [{ field: 'email', message: 'Invalid email format' }]
}
```

### Pagination

List endpoints return pagination metadata:

```typescript
{
  contacts: [...],
  meta: {
    nextCursor: 'contact-id-for-next-page',
    startAfter: 'contact-id-for-current-page'
  }
}
```

## Additional Resources

- [GoHighLevel API Documentation](https://marketplace.gohighlevel.com/docs)
- [GoHighLevel API Reference](https://marketplace.gohighlevel.com/docs/ghl/)
- Provider implementation: `packages/integrations/crm/providers/gohighlevel-provider.ts`
- CRM types: `packages/integrations/crm/crm-types.ts`