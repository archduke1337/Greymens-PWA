#!/bin/bash
# Quick verification script for Vercel deployment readiness

echo "════════════════════════════════════════════════════════"
echo "🔍 MindMesh - Vercel Deployment Readiness Check"
echo "════════════════════════════════════════════════════════"
echo ""

# Check 1: .env is properly ignored
echo "✓ Check 1: Environment Variables"
if grep -q "^\.env$" .gitignore; then
    echo "  ✅ .env is excluded from Git"
else
    echo "  ❌ .env not properly excluded"
fi

if [ -f ".env.example" ]; then
    echo "  ✅ .env.example template exists"
else
    echo "  ⚠️  .env.example missing"
fi

echo ""

# Check 2: Vercel configuration
echo "✓ Check 2: Vercel Configuration"
if [ -f "vercel.json" ]; then
    echo "  ✅ vercel.json exists"
else
    echo "  ❌ vercel.json missing"
fi

echo ""

# Check 3: Build configuration
echo "✓ Check 3: Build Configuration"
if grep -q '"build"' package.json; then
    echo "  ✅ Build script configured in package.json"
else
    echo "  ❌ Build script missing"
fi

if grep -q '"type-check"' package.json; then
    echo "  ✅ Type-check script available"
else
    echo "  ⚠️  Type-check script missing"
fi

echo ""

# Check 4: Documentation
echo "✓ Check 4: Documentation"
if [ -f "DEPLOYMENT_GUIDE.md" ]; then
    echo "  ✅ DEPLOYMENT_GUIDE.md exists"
else
    echo "  ❌ DEPLOYMENT_GUIDE.md missing"
fi

if [ -f "SETUP.md" ]; then
    echo "  ✅ SETUP.md exists"
else
    echo "  ❌ SETUP.md missing"
fi

if [ -f "DEPLOYMENT_ISSUES_FIXED.md" ]; then
    echo "  ✅ DEPLOYMENT_ISSUES_FIXED.md exists"
else
    echo "  ❌ DEPLOYMENT_ISSUES_FIXED.md missing"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "📋 Next Steps:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. Install dependencies:"
echo "   npm install --legacy-peer-deps"
echo ""
echo "2. Test build locally:"
echo "   npm run build"
echo ""
echo "3. Push to GitHub:"
echo "   git push origin main"
echo ""
echo "4. Go to Vercel and import repository"
echo ""
echo "5. Add environment variables in Vercel dashboard:"
echo "   - NEXT_PUBLIC_APPWRITE_PROJECT_ID"
echo "   - NEXT_PUBLIC_APPWRITE_PROJECT_NAME"
echo "   - NEXT_PUBLIC_APPWRITE_ENDPOINT"
echo "   - NEXT_PUBLIC_APPWRITE_DATABASE_ID"
echo "   - NEXT_PUBLIC_APPWRITE_BUCKET_ID"
echo ""
echo "6. Deploy!"
echo ""
echo "════════════════════════════════════════════════════════"
