# Vercel Environment Variables Setup Guide

## Problem
The application requires environment variables to run on Vercel, but they were not being detected even after adding them to Vercel's Project Settings.

## Solution

### Step 1: Set Environment Variables in Vercel Console

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each of these variables:

| Variable Name | Value | Type |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | `https://fra.cloud.appwrite.io/v1` | Public |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Your Appwrite Project ID | Public |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Your Appwrite Database ID | Public |
| `NEXT_PUBLIC_APPWRITE_BUCKET_ID` | Your Appwrite Bucket ID | Public |
| `NEXT_PUBLIC_APPWRITE_PROJECT_NAME` | Your Project Name | Public |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` | Your EmailJS Service ID | Public (optional) |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` | Your EmailJS Template ID | Public (optional) |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` | Your EmailJS Public Key | Public (optional) |

### Step 2: Important - Environment Variable Scope

**IMPORTANT**: Make sure to set the environment scope for each variable:
- ✅ **Production** - Check this
- ✅ **Preview** - Check this  
- ✅ **Development** - Check this (for local development)

If you only set "Production", the variables won't be available in Preview deployments!

### Step 3: Redeploy

After adding environment variables, you MUST redeploy:

1. Go to **Deployments** tab
2. Find your most recent deployment
3. Click the **...** menu → **Redeploy**
4. Confirm the redeploy

**Note**: Simply adding environment variables doesn't automatically update existing deployments. You need to explicitly redeploy.

### Step 4: Verify in Vercel Build Output

Once redeployed, check the build logs:

1. Go to **Deployments** → click on the latest deployment
2. Scroll to the build logs
3. Look for output like:
   ```
   Using environment variables:
   - NEXT_PUBLIC_APPWRITE_ENDPOINT
   - NEXT_PUBLIC_APPWRITE_PROJECT_ID
   ...
   ```

## Why `vercel.json` was Wrong

The previous `vercel.json` had:
```json
{
  "env": {
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID": "@next_public_appwrite_project_id"
  }
}
```

This is **incorrect** because:
- The `@` syntax is not valid for referencing Vercel Secrets
- The casing was inconsistent (variable names should be uppercase)
- It tried to reference secrets that don't exist

**Fixed approach**: Remove the `env` section entirely and set all variables directly in Vercel's Project Settings.

## Environment Variable Categories

### Required for Appwrite Integration
- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
- `NEXT_PUBLIC_APPWRITE_BUCKET_ID`

### Optional for Email Features
- `NEXT_PUBLIC_EMAILJS_SERVICE_ID`
- `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`
- `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`

### Public vs Secret
- All `NEXT_PUBLIC_*` variables are **public** - they're visible in browser code
- Never put sensitive information (API keys, secrets) in `NEXT_PUBLIC_*` variables
- For sensitive data, create regular (non-public) environment variables

## Local Development

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
NEXT_PUBLIC_APPWRITE_BUCKET_ID=your_bucket_id
```

Then restart your dev server:
```bash
npm run dev
```

## Debugging

### Variables not showing up in build?

1. ✅ Verify variables are set in Vercel Project Settings
2. ✅ Check that ALL scopes are enabled (Production, Preview, Development)
3. ✅ **Redeploy** - this is the most common issue!
4. ✅ Clear browser cache (Vercel may cache old builds)

### Verifying Variables Are Set

Run this in your app to verify variables are available:

```typescript
// In a Server Component or API route
export async function GET() {
  return Response.json({
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
  });
}
```

Visit `/api/test-env` to check if variables are loaded.

## Vercel CLI

If using Vercel CLI locally:

```bash
# Pull environment variables from Vercel
vercel env pull

# This creates .env.local with all production variables
npm run dev
```

## Common Mistakes

❌ **Only setting variables for "Production"** - they won't work in Preview deployments
❌ **Forgetting to redeploy** - environment variables aren't retroactive
❌ **Using wrong casing** - variable names are case-sensitive (use UPPERCASE)
❌ **Putting secrets in `NEXT_PUBLIC_*`** - these are visible in browser
❌ **Expecting `vercel.json` env to work** - set in Project Settings instead

## Reference

- [Vercel Environment Variables Docs](https://vercel.com/docs/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Appwrite Console Docs](https://appwrite.io/docs/console)
