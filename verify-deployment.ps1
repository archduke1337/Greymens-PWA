# Quick verification script for Vercel deployment readiness
# Run: .\verify-deployment.ps1

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔍 MindMesh - Vercel Deployment Readiness Check" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check 1: .env is properly ignored
Write-Host "✓ Check 1: Environment Variables" -ForegroundColor Yellow
$gitignoreContent = Get-Content .gitignore
if ($gitignoreContent -match "^\.env$") {
    Write-Host "  ✅ .env is excluded from Git" -ForegroundColor Green
} else {
    Write-Host "  ❌ .env not properly excluded" -ForegroundColor Red
}

if (Test-Path ".env.example") {
    Write-Host "  ✅ .env.example template exists" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  .env.example missing" -ForegroundColor Yellow
}

Write-Host ""

# Check 2: Vercel configuration
Write-Host "✓ Check 2: Vercel Configuration" -ForegroundColor Yellow
if (Test-Path "vercel.json") {
    Write-Host "  ✅ vercel.json exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ vercel.json missing" -ForegroundColor Red
}

Write-Host ""

# Check 3: Build configuration
Write-Host "✓ Check 3: Build Configuration" -ForegroundColor Yellow
$packageJsonContent = Get-Content package.json
if ($packageJsonContent -match '"build"') {
    Write-Host "  ✅ Build script configured in package.json" -ForegroundColor Green
} else {
    Write-Host "  ❌ Build script missing" -ForegroundColor Red
}

if ($packageJsonContent -match '"type-check"') {
    Write-Host "  ✅ Type-check script available" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Type-check script missing" -ForegroundColor Yellow
}

Write-Host ""

# Check 4: Documentation
Write-Host "✓ Check 4: Documentation" -ForegroundColor Yellow
$docs = @("DEPLOYMENT_GUIDE.md", "SETUP.md", "DEPLOYMENT_ISSUES_FIXED.md")
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "  ✅ $doc exists" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $doc missing" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Install dependencies:" -ForegroundColor White
Write-Host "   npm install --legacy-peer-deps" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test build locally:" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Push to GitHub:" -ForegroundColor White
Write-Host "   git push origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Go to Vercel and import repository" -ForegroundColor White
Write-Host ""
Write-Host "5. Add environment variables in Vercel dashboard:" -ForegroundColor White
Write-Host "   - NEXT_PUBLIC_APPWRITE_PROJECT_ID" -ForegroundColor Gray
Write-Host "   - NEXT_PUBLIC_APPWRITE_PROJECT_NAME" -ForegroundColor Gray
Write-Host "   - NEXT_PUBLIC_APPWRITE_ENDPOINT" -ForegroundColor Gray
Write-Host "   - NEXT_PUBLIC_APPWRITE_DATABASE_ID" -ForegroundColor Gray
Write-Host "   - NEXT_PUBLIC_APPWRITE_BUCKET_ID" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Deploy!" -ForegroundColor Green
Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
