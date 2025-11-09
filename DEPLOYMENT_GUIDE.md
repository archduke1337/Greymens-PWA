# Vercel Deployment Checklist

## Pre-Deployment Steps ✅

### 1. Environment Variables Setup
Before deploying to Vercel, ensure all environment variables are configured:

```
NEXT_PUBLIC_APPWRITE_PROJECT_ID
NEXT_PUBLIC_APPWRITE_PROJECT_NAME
NEXT_PUBLIC_APPWRITE_ENDPOINT
NEXT_PUBLIC_APPWRITE_DATABASE_ID
NEXT_PUBLIC_APPWRITE_BUCKET_ID
```

**How to add them:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add each variable with its corresponding value
3. Select which environments they apply to (Production, Preview, Development)

### 2. Build Configuration
- ✅ `next.config.js` - Optimized for Vercel deployment
- ✅ `vercel.json` - Deployment configuration added
- ✅ `package.json` - Build command configured correctly

### 3. Git Configuration
- ✅ `.env` - Now properly excluded from Git tracking
- ✅ `.env.local` - Created for local development
- ✅ `.env.example` - Template for other developers

### 4. Files to Review
- [ ] Verify all API routes work correctly
- [ ] Check for hardcoded URLs (should use environment variables)
- [ ] Test email service configuration (EmailJS)
- [ ] Verify Appwrite bucket access permissions

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard
1. Push your code to GitHub (recommended)
2. Go to https://vercel.com
3. Click "New Project"
4. Select your GitHub repository
5. Vercel auto-detects Next.js settings
6. Add Environment Variables from settings
7. Deploy!

### Option 2: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

## Post-Deployment

1. **Test the Deployment**
   - Visit your live URL
   - Test all major features
   - Check browser console for errors
   - Verify email notifications work

2. **Monitor Performance**
   - Check Vercel Analytics
   - Monitor build times
   - Track serverless function duration

3. **Enable Production Domain**
   - Add custom domain in Vercel Settings
   - Configure DNS records
   - Set up SSL certificate (automatic with Vercel)

## Common Issues & Solutions

### Issue: Missing Environment Variables
**Solution:** Check Vercel Project Settings > Environment Variables

### Issue: Build Failure
**Solution:** 
- Run `npm run build` locally first
- Check build logs in Vercel dashboard
- Fix any TypeScript/ESLint errors

### Issue: Image Not Loading
**Solution:** Ensure domain is in `next.config.js` images.domains array

### Issue: Appwrite API Errors
**Solution:**
- Verify APPWRITE_ENDPOINT is correct
- Check CORS settings in Appwrite Console
- Ensure project ID and database ID match

## Notes

- The `.env` file is now excluded from Git (contains sensitive data)
- Use `.env.example` as reference for required variables
- `.env.local` is used for local development
- Production variables are managed in Vercel Dashboard
