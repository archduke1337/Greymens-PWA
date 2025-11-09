# Backend-Frontend Connectivity Guide

## Overview

This document provides comprehensive guidance for diagnosing and troubleshooting backend-frontend connectivity issues in MindMesh.

## Quick Diagnostics

### 1. Access Diagnostic Pages

**System Diagnostics Dashboard:**
```
http://localhost:3000/diagnostics
```
Shows:
- Environment configuration status
- Service connectivity status
- Appwrite endpoint availability
- EmailJS configuration

**Real-time Connectivity Test:**
```
http://localhost:3000/connectivity-check
```
Performs:
- Environment variable validation
- Endpoint reachability test
- Connection status confirmation

### 2. Check Environment Variables

Create or update `.env.local` with required values:

```bash
# Appwrite Configuration (REQUIRED)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
NEXT_PUBLIC_APPWRITE_BUCKET_ID=your_bucket_id

# EmailJS Configuration (OPTIONAL - for email notifications)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
```

Copy from `.env.example`:
```bash
cp .env.example .env.local
# Then update with actual values
```

## Architecture Overview

### Frontend Services

**1. Appwrite Client (`lib/appwrite.ts`)**
- Initializes Appwrite SDK with endpoint and project ID
- Exports: `account`, `storage`, `databases`
- Used by all API service modules

**2. Event Service (`lib/database.ts`)**
- Manages event CRUD operations
- Queries events from Appwrite
- Functions:
  - `getAllEvents()` - Fetch all events with optional filters
  - `getEventById(eventId)` - Fetch single event
  - `createEvent(eventData)` - Create new event
  - `updateEvent(eventId, eventData)` - Update event
  - `deleteEvent(eventId)` - Delete event

**3. Authentication Service (`lib/appwrite.ts`)**
- User login/registration
- Session management
- OAuth integration (Google)

**4. Error Handler (`lib/errorHandler.ts`)**
- Type-safe error extraction
- Converts all error types to readable messages
- Functions:
  - `getErrorMessage()` - Get user-friendly error message
  - `getErrorDetails()` - Get detailed error info
  - `isError()` - Type guard for Error instances

### Backend Services

**Appwrite Endpoints:**
- **Endpoint:** `https://fra.cloud.appwrite.io/v1`
- **Project:** Configure in Appwrite Console
- **Database:** Custom database with collections
- **Collections:**
  - `events` - Event information
  - `registrations` - User event registrations
  - `projects` - Project showcase data
  - `sponsors` - Sponsor information

## Common Issues & Solutions

### Issue 1: "Cannot find name 'sponsorTiers'" Error

**Cause:** Missing import of exported constant

**Solution:**
```typescript
// Before (WRONG)
import { Sponsor, sponsorService } from "@/lib/sponsors";

// After (CORRECT)
import { Sponsor, sponsorService, sponsorTiers } from "@/lib/sponsors";
```

**File:** `app/admin/sponsors/page.tsx`

---

### Issue 2: "Type 'string' is not assignable to 'platinum' | 'gold' | 'silver' | 'bronze' | 'partner'"

**Cause:** Loose typing on form input handlers

**Solution:**
```typescript
// Before (WRONG)
onChange={(e) => setFormData({ ...formData, tier: e.target.value })}

// After (CORRECT)
onChange={(e) => setFormData({ ...formData, tier: e.target.value as Sponsor["tier"] })}
```

Or use proper typed state:
```typescript
const [formData, setFormData] = useState<Sponsor>({
  // ... other fields
  tier: "partner", // Automatically typed as allowed values
});
```

---

### Issue 3: "Property 'title' does not exist on type 'Event'"

**Cause:** React's DOM `Event` type imported instead of custom `Event` type

**Solution:**
```typescript
// Before (WRONG)
import { eventService } from "@/lib/database";
const [events, setEvents] = useState<Event[]>([]); // Uses React.Event

// After (CORRECT)
import { eventService, type Event as EventType } from "@/lib/database";
const [events, setEvents] = useState<EventType[]>([]); // Uses custom Event
```

---

### Issue 4: Build Process Hangs or Fails

**Possible Causes:**
1. Missing environment variables (build tries to validate them)
2. Network connectivity issues
3. Long-running network requests in module initialization

**Solutions:**
```bash
# Kill any lingering Node processes
taskkill /F /IM node.exe

# Clear Next.js cache
rm -r .next

# Reinstall dependencies
npm ci

# Try build again
npm run build
```

---

### Issue 5: Cannot Connect to Appwrite Endpoint

**Diagnostic Steps:**

1. **Check endpoint is reachable:**
   ```bash
   curl -I https://fra.cloud.appwrite.io/v1
   ```

2. **Verify CORS settings** in Appwrite Console:
   - Settings → Domains
   - Add your frontend domain (localhost:3000 for development)

3. **Check firewall/VPN:**
   - Disable VPN temporarily
   - Check corporate firewall rules

4. **Verify project credentials:**
   - Project ID must match in Appwrite Console
   - Check project is active, not deleted

---

### Issue 6: Events Page Shows Empty or Errors

**Check in order:**

1. **Verify Appwrite connectivity:**
   - Visit `/connectivity-check`
   - Ensure "Appwrite Reachable: ✓ Yes"

2. **Check events collection exists:**
   - Log into Appwrite Console
   - Navigate to Database → Collections
   - Verify `events` collection exists with correct ID

3. **Check database permissions:**
   - Collection → Permissions
   - Ensure "Guests" or your user role has read access

4. **Test query directly:**
   ```typescript
   // In browser console
   const { databases } = await import("@/lib/appwrite");
   const events = await databases.listDocuments("68ee09da002cce9f7e39", "events");
   console.log(events);
   ```

---

## Debugging Workflow

### Step 1: Verify Environment
```bash
# Check env file exists
ls -la .env.local

# Verify values are set (don't expose secrets in logs)
grep "NEXT_PUBLIC" .env.local
```

### Step 2: Check Build Errors
```bash
npm run build 2>&1 | tail -50
```

### Step 3: Test Development Server
```bash
npm run dev
# Open http://localhost:3000/diagnostics
```

### Step 4: Check Runtime Errors
Open browser DevTools (F12):
- **Console tab:** Look for JavaScript errors
- **Network tab:** Check API request status
- **Application tab:** Verify storage/cookies

### Step 5: Run Connectivity Test
Navigate to: `http://localhost:3000/connectivity-check`

### Step 6: Check Appwrite Logs
In Appwrite Console:
- Settings → Logs
- Search for requests from your project
- Look for any error patterns

---

## Type Safety Best Practices

### 1. Import Custom Types with Alias

```typescript
// Avoid confusion with React's Event
import { type Event as EventType } from "@/lib/database";

// Now you can safely use both:
// - React Event: from (e) => handler(e)
// - Custom Event: EventType from database
```

### 2. Use Strict State Typing

```typescript
// GOOD - Type is inferred from initial state
const [sponsor, setSponsor] = useState<Sponsor>({
  name: "",
  tier: "partner", // Type: "partner" | "platinum" | ...
});

// AVOID - Type becomes string
const [sponsor, setSponsor] = useState({
  name: "",
  tier: "partner", // Type: string (too loose)
});
```

### 3. Type Event Handlers

```typescript
// GOOD - Explicit types
const handleTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setFormData({
    ...formData,
    tier: e.target.value as Sponsor["tier"],
  });
};

// AVOID - Implicit any
const handleTierChange = (e) => {
  setFormData({ ...formData, tier: e.target.value }); // Type error
};
```

---

## Testing Connectivity

### Test 1: Environment Variables
```typescript
// Console test
Object.entries(process.env)
  .filter(([k]) => k.includes("NEXT_PUBLIC"))
  .forEach(([k, v]) => console.log(k, v ? "✓ Set" : "✗ Missing"));
```

### Test 2: Appwrite Client
```typescript
// Console test
import { databases } from "@/lib/appwrite";
console.log(databases); // Should show object, not error
```

### Test 3: Fetch Events
```typescript
// Console test
import { eventService } from "@/lib/database";
const events = await eventService.getAllEvents();
console.log(events);
```

### Test 4: Network Request
```typescript
// Console test
fetch("https://fra.cloud.appwrite.io/v1")
  .then(r => console.log("Status:", r.status))
  .catch(e => console.error("Error:", e));
```

---

## Performance Optimization

### 1. Cache Events
```typescript
const [events, setEvents] = useState<EventType[]>([]);
const [isCached, setIsCached] = useState(false);

useEffect(() => {
  if (!isCached) {
    loadEvents();
    setIsCached(true);
  }
}, [isCached]);
```

### 2. Debounce Search/Filter
```typescript
import { useCallback } from "react";

const handleSearch = useCallback((query: string) => {
  // Add debouncing logic here
  // Don't make request on every keystroke
}, []);
```

### 3. Lazy Load Images
```typescript
<Image
  src={event.image}
  alt={event.title}
  loading="lazy" // Add this
  width={400}
  height={300}
/>
```

---

## Resources

- **Appwrite Docs:** https://appwrite.io/docs
- **Next.js Docs:** https://nextjs.org/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs
- **HeroUI Components:** https://heroui.com

---

## Getting Help

If issues persist:

1. **Check diagnostics:**
   - `/diagnostics` page status
   - `/connectivity-check` test results

2. **Review logs:**
   - Browser Console (F12)
   - Appwrite Console logs
   - Next.js terminal output

3. **Verify credentials:**
   - Double-check `.env.local` values
   - Ensure project hasn't been deleted
   - Check project is not suspended

4. **Test isolation:**
   - Test Appwrite directly via API
   - Test frontend without Appwrite calls
   - Use PostMan for API testing

---

## Summary

| Issue | Check | Solution |
|-------|-------|----------|
| Can't find module | Imports | Add missing imports |
| Type errors | Typing | Use type aliases for ambiguous types |
| Build hangs | Environment | Set all required env vars |
| No data shown | Connection | Visit `/connectivity-check` |
| CORS errors | Appwrite Console | Add frontend domain to allowed origins |
| Events not loading | Database | Verify collection permissions |

---

Last updated: November 10, 2025
