$ErrorActionPreference = "Stop"
$ROOT = "c:\Users\ECO F\Desktop\fort-uba"
$env:PATH = "$env:PATH;C:\Users\ECO F\AppData\Roaming\npm;C:\Program Files\GitHub CLI\"

Write-Host ""
Write-Host "===  FORT UBA  Full Deployment  ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "You need tokens from 3 websites:" -ForegroundColor Yellow
Write-Host "  GitHub  : https://github.com/settings/tokens/new  (scopes: repo)" -ForegroundColor White
Write-Host "  Vercel  : https://vercel.com/account/tokens" -ForegroundColor White
Write-Host "  Railway : https://railway.app/account/tokens" -ForegroundColor White
Write-Host ""

$GH_TOKEN      = Read-Host "Paste GITHUB token"
$VERCEL_TOKEN  = Read-Host "Paste VERCEL token"
$RAIL_TOKEN    = Read-Host "Paste RAILWAY token"
$GH_USER       = Read-Host "Your GitHub username"

Write-Host ""
Write-Host "Starting..." -ForegroundColor Cyan

# ── 1. Create GitHub repo ──────────────────────────────────────
Write-Host "[1/5] Creating GitHub repo..." -ForegroundColor Yellow

$body = "{`"name`":`"fort-uba`",`"description`":`"FORT UBA ride-hailing`",`"private`":false,`"auto_init`":false}"
$resp = & curl.exe -s -X POST `
    -H "Authorization: token $GH_TOKEN" `
    -H "Content-Type: application/json" `
    -d $body `
    "https://api.github.com/user/repos"

$json = $resp | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($json.clone_url) {
    $REPO_URL = $json.clone_url
    Write-Host "    Created: $($json.html_url)" -ForegroundColor Green
} else {
    $REPO_URL = "https://github.com/$GH_USER/fort-uba.git"
    Write-Host "    Using existing repo" -ForegroundColor Green
}

# ── 2. Push to GitHub ─────────────────────────────────────────
Write-Host "[2/5] Pushing code to GitHub..." -ForegroundColor Yellow
Set-Location $ROOT

$authUrl = $REPO_URL -replace "https://", "https://$GH_USER`:$GH_TOKEN@"
git remote remove origin 2>$null
git remote add origin $authUrl 2>&1 | Out-Null
git branch -M main 2>&1 | Out-Null
git push -u origin main --force 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "    Pushed OK" -ForegroundColor Green
} else {
    Write-Host "    Push failed - check token" -ForegroundColor Red
}
git remote set-url origin $REPO_URL 2>&1 | Out-Null

# ── 3. Deploy backend to Railway ──────────────────────────────
Write-Host "[3/5] Deploying backend to Railway..." -ForegroundColor Yellow
$env:RAILWAY_TOKEN = $RAIL_TOKEN
Set-Location "$ROOT\backend"

Write-Host "    Logging in to Railway..." -ForegroundColor Gray
railway login --browserless 2>&1 | Out-Null

Write-Host "    Creating Railway project..." -ForegroundColor Gray
$projOut = railway init --name "fort-uba-backend" 2>&1
Write-Host "    $projOut" -ForegroundColor Gray

Write-Host "    Deploying (this takes ~2 min)..." -ForegroundColor Gray
railway up --detach 2>&1 | Out-Null

Write-Host "    Adding PostgreSQL database..." -ForegroundColor Gray
railway add --plugin postgresql 2>&1 | Out-Null

Write-Host "    Setting env variables..." -ForegroundColor Gray
railway variables set NODE_ENV=production 2>&1 | Out-Null
railway variables set "JWT_SECRET=fortuba-prod-$(Get-Random -Maximum 999999)" 2>&1 | Out-Null
railway variables set USE_REAL_SMS=false 2>&1 | Out-Null

Write-Host "    Backend deploying on Railway" -ForegroundColor Green
Write-Host "    Check: https://railway.app/dashboard" -ForegroundColor Gray

# ── Get Railway URL ───────────────────────────────────────────
Write-Host ""
Write-Host "Go to https://railway.app/dashboard" -ForegroundColor Yellow
Write-Host "  -> Open your project -> Settings -> Networking -> Generate Domain" -ForegroundColor White
Write-Host ""
$RAIL_URL = Read-Host "Paste your Railway backend URL"
$RAIL_URL = $RAIL_URL.TrimEnd("/")

# ── 4. Deploy 3 frontends to Vercel ──────────────────────────
Write-Host "[4/5] Deploying frontends to Vercel..." -ForegroundColor Yellow

$apps = @(
    @{ name = "fortuba-rider";  dir = "rider-app"      },
    @{ name = "fortuba-driver"; dir = "driver-app"     },
    @{ name = "fortuba-admin";  dir = "admin-dashboard"}
)

$urls = @{}
foreach ($app in $apps) {
    Write-Host "    Deploying $($app.name)..." -ForegroundColor Gray
    Set-Location "$ROOT\$($app.dir)"

    $out = vercel deploy --prod `
        --token $VERCEL_TOKEN `
        --yes `
        --name $app.name `
        -e "VITE_API_URL=$RAIL_URL" 2>&1

    $url = ($out -match "https://.*\.vercel\.app" | Select-Object -Last 1)
    if (-not $url) {
        $url = ($out | Select-String "https://[^\s]+" | Select-Object -Last 1).Matches.Value
    }
    $urls[$app.name] = $url
    Write-Host "    OK: $url" -ForegroundColor Green
}

# ── 5. Update CORS on Railway ─────────────────────────────────
Write-Host "[5/5] Updating CORS on Railway..." -ForegroundColor Yellow
Set-Location "$ROOT\backend"

$cors = ($urls.Values | Where-Object { $_ }) -join ","
if ($cors) {
    railway variables set "CORS_ORIGINS=$cors" 2>&1 | Out-Null
    Write-Host "    CORS updated: $cors" -ForegroundColor Green
}

# ── Seed demo data ─────────────────────────────────────────────
Write-Host "    Seeding demo data..." -ForegroundColor Gray
railway run "node src/db/seed.js" 2>&1 | Out-Null
Write-Host "    Demo data loaded" -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────
Set-Location $ROOT
Write-Host ""
Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Backend  : $RAIL_URL" -ForegroundColor Cyan
foreach ($k in $urls.Keys) {
    Write-Host "$k : $($urls[$k])" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Demo logins:" -ForegroundColor Yellow
Write-Host "  Rider  : +256700000001  OTP: 1234" -ForegroundColor White
Write-Host "  Driver : +256700000101  OTP: 1234" -ForegroundColor White
Write-Host "  Admin  : admin@fortuba.ug / admin123" -ForegroundColor White
Write-Host ""
Write-Host "On iPhone: Safari -> Rider URL -> Share -> Add to Home Screen" -ForegroundColor Yellow
