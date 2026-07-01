# PowerShell Script for Automated Setup
# Run this script as Administrator

Write-Host "=== Yemot System Setup Script ===" -ForegroundColor Green

# Check if running as Administrator
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Please run this script as Administrator!" -ForegroundColor Red
    exit 1
}

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (-not (Test-Command "node")) {
    Write-Host "Node.js not found. Installing via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install Node.js. Please install manually from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Check npm
if (-not (Test-Command "npm")) {
    Write-Host "npm not found. Please reinstall Node.js." -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
if (-not (Test-Command "psql")) {
    Write-Host "PostgreSQL not found. Installing via winget..." -ForegroundColor Yellow
    winget install PostgreSQL.PostgreSQL
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install PostgreSQL. Please install manually from https://www.postgresql.org/" -ForegroundColor Red
        exit 1
    }
}

# Check Git
Write-Host "Checking Git..." -ForegroundColor Yellow
if (-not (Test-Command "git")) {
    Write-Host "Git not found. Installing via winget..." -ForegroundColor Yellow
    winget install Git.Git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install Git. Please install manually from https://git-scm.com/" -ForegroundColor Red
        exit 1
    }
}

# Install dependencies
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env file with your actual credentials!" -ForegroundColor Yellow
}

Write-Host "Setup completed! Please:" -ForegroundColor Green
Write-Host "1. Edit .env with your Yemot and Google credentials" -ForegroundColor White
Write-Host "2. Create PostgreSQL database: yemot_system" -ForegroundColor White
Write-Host "3. Run: npm run migrate" -ForegroundColor White
Write-Host "4. Run: npm run seed" -ForegroundColor White
Write-Host "5. Run: npm run test:yemot" -ForegroundColor White