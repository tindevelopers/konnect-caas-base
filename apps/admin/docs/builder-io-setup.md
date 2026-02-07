# Builder.io Setup Guide

This guide explains how to set up and use Builder.io visual CMS in the admin application.

## Installation

Builder.io packages are already installed:
- `@builder.io/react` - React SDK for rendering Builder.io content
- `@builder.io/dev-tools` - Development tools for visual editing

## Configuration

### 1. Get Your Builder.io API Key

1. Sign up or log in to [Builder.io](https://builder.io)
2. Create a new space or select an existing one
3. Go to **Account Settings** → **API Keys**
4. Copy your **Public API Key**

### 2. Set Environment Variable

Add your Builder.io API key to your environment variables:

**Local Development (.env.local):**
```bash
NEXT_PUBLIC_BUILDER_API_KEY=your-builder-io-api-key-here
```

**Production (Vercel Dashboard):**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `NEXT_PUBLIC_BUILDER_API_KEY` with your production API key
3. Select "Production" environment

### 3. Restart Development Server

After adding the environment variable, restart your dev server:
```bash
pnpm dev:admin
```

## Usage

### Creating Builder.io Pages

1. Go to [Builder.io](https://builder.io) and sign in
2. Create a new page or component
3. Set the **URL** field to match the route where you want the content to appear
   - Example: `/builder/home` → Content will appear at `http://localhost:3010/builder/home`
   - Example: `/builder/about` → Content will appear at `http://localhost:3010/builder/about`

### Accessing Builder.io Pages

Builder.io pages are accessible at:
```
http://localhost:3010/builder/[your-page-path]
```

For example:
- `/builder` - Root Builder.io page
- `/builder/home` - Home page
- `/builder/about` - About page
- `/builder/landing` - Landing page

### Visual Editing

When you have Builder.io dev tools installed and your API key configured:

1. Visit any Builder.io page in your app (e.g., `http://localhost:3010/builder/home`)
2. Click the **Builder.io** icon that appears in the bottom-right corner
3. This opens the visual editor where you can drag-and-drop components and edit content
4. Changes are saved automatically and appear on your page

### Preview Mode

To preview unpublished content, add `?preview=true` to the URL:
```
http://localhost:3010/builder/home?preview=true
```

## Components

### BuilderContent Component

Use the `BuilderContent` component to render Builder.io content anywhere in your app:

```tsx
import BuilderContent from "@/components/builder/BuilderContent";

export default function MyPage() {
  return (
    <div>
      <h1>My Page</h1>
      <BuilderContent model="page" options={{ userAttributes: { urlPath: "/my-page" } }} />
    </div>
  );
}
```

### Props

- `model` (string, default: "page") - The Builder.io model name
- `content` (object, optional) - Pre-fetched Builder.io content
- `options` (object, optional) - Builder.io options:
  - `userAttributes` - User attributes for targeting (e.g., `{ urlPath: "/page" }`)
  - `preview` (boolean) - Enable preview mode

## API Routes

### Preview API

The preview API route allows you to fetch Builder.io content programmatically:

```
GET /api/builder/preview?urlPath=/your-page-path
```

Returns:
```json
{
  "content": { ... }
}
```

## File Structure

```
apps/admin/
├── components/
│   └── builder/
│       ├── BuilderContent.tsx      # Main Builder.io component
│       └── BuilderDevTools.tsx     # Dev tools loader (dev only)
├── app/
│   └── builder/
│       └── [[...page]]/
│           └── page.tsx           # Dynamic Builder.io page route
├── lib/
│   └── builder.ts                  # Builder.io configuration
└── app/
    └── api/
        └── builder/
            └── preview/
                └── route.ts        # Preview API endpoint
```

## Troubleshooting

### "Builder.io API key not configured"

- Make sure `NEXT_PUBLIC_BUILDER_API_KEY` is set in your `.env.local` file
- Restart your development server after adding the variable
- Check that the variable name is exactly `NEXT_PUBLIC_BUILDER_API_KEY` (case-sensitive)

### "No Builder.io content found"

- Make sure you've created and published content in Builder.io
- Verify the URL path in Builder.io matches your route
- Check that your API key has access to the Builder.io space

### Dev Tools Not Appearing

- Dev tools only load in development mode (`NODE_ENV=development`)
- Make sure `@builder.io/dev-tools` is installed
- Check browser console for any errors

## Next Steps

1. Get your Builder.io API key from https://builder.io/account/space
2. Add it to your `.env.local` file
3. Restart your dev server
4. Visit `http://localhost:3010/builder` to see your Builder.io pages
5. Start creating content in Builder.io!

## Resources

- [Builder.io Documentation](https://www.builder.io/c/docs)
- [Builder.io React SDK](https://www.builder.io/c/docs/developers/react)
- [Builder.io Getting Started](https://www.builder.io/c/docs/getting-started)
