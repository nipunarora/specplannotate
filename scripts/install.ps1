# Plannotator Windows Installer
$ErrorActionPreference = "Stop"

$repo = "nipunarora/specplannotate"
$installDir = "$env:LOCALAPPDATA\specannotate"

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) {
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
} else {
    Write-Error "32-bit Windows is not supported"
    exit 1
}

$platform = "win32-$arch"
$binaryName = "specannotate-$platform.exe"

# Clean up old install locations that may take precedence in PATH
$oldLocations = @(
    "$env:USERPROFILE\.local\bin\specannotate.exe",
    "$env:USERPROFILE\.local\bin\specannotate"
)

foreach ($oldPath in $oldLocations) {
    if (Test-Path $oldPath) {
        Write-Host "Removing old installation at $oldPath..."
        Remove-Item -Force $oldPath -ErrorAction SilentlyContinue
    }
}

Write-Host "Fetching latest version..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
$latestTag = $release.tag_name

if (-not $latestTag) {
    Write-Error "Failed to fetch latest version"
    exit 1
}

Write-Host "Installing specannotate $latestTag..."

$binaryUrl = "https://github.com/$repo/releases/download/$latestTag/$binaryName"
$checksumUrl = "$binaryUrl.sha256"

# Create install directory
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$tmpFile = [System.IO.Path]::GetTempFileName()

# Use -UseBasicParsing to avoid security prompts and ensure consistent behavior
Invoke-WebRequest -Uri $binaryUrl -OutFile $tmpFile -UseBasicParsing

# Verify checksum
# Note: In Windows PowerShell 5.1, Invoke-WebRequest returns .Content as byte[] for non-HTML responses.
# We must handle both byte[] (PS 5.1) and string (PS 7+) for cross-version compatibility.
$checksumResponse = Invoke-WebRequest -Uri $checksumUrl -UseBasicParsing
if ($checksumResponse.Content -is [byte[]]) {
    $checksumContent = [System.Text.Encoding]::UTF8.GetString($checksumResponse.Content)
} else {
    $checksumContent = $checksumResponse.Content
}
$expectedChecksum = $checksumContent.Split(" ")[0].Trim().ToLower()
$actualChecksum = (Get-FileHash -Path $tmpFile -Algorithm SHA256).Hash.ToLower()

if ($actualChecksum -ne $expectedChecksum) {
    Remove-Item $tmpFile -Force
    Write-Error "Checksum verification failed!"
    exit 1
}

Move-Item -Force $tmpFile "$installDir\specannotate.exe"

Write-Host ""
Write-Host "specannotate $latestTag installed to $installDir\specannotate.exe"

# Add to PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    Write-Host ""
    Write-Host "$installDir is not in your PATH. Adding it..."
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    Write-Host "Added to PATH. Restart your terminal for changes to take effect."
}

# Clear OpenCode plugin cache
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\node_modules\@specannotate" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.bun\install\cache\@specannotate" -ErrorAction SilentlyContinue

# Install Claude Code slash commands
$claudeCommandsDir = "$env:USERPROFILE\.claude\commands"
New-Item -ItemType Directory -Force -Path $claudeCommandsDir | Out-Null

# Install /specannotate-review command
@"
---
description: Open interactive code review for current changes
allowed-tools: Bash(specannotate:*)
---

## Code Review Feedback

!`specannotate review`

## Your task

Address the code review feedback above. The user has reviewed your changes in the Specannotate UI and provided specific annotations and comments.
"@ | Set-Content -Path "$claudeCommandsDir\specannotate-review.md"

Write-Host "Installed /specannotate-review command to $claudeCommandsDir\specannotate-review.md"

# Install /speckit-review command
@"
---
description: Review spec-kit specification documents for current feature branch
allowed-tools: Bash(specannotate:*)
---

## Spec Review Feedback

!`specannotate speckit`

## Your task

Address the spec review feedback above. The user has reviewed your specification documents (spec.md, plan.md, tasks.md, etc.) in the Specannotate UI and provided specific annotations and comments.

Focus on the areas they highlighted:
- Specification details they want changed
- Technical plan items they disagree with
- Task ordering or scope concerns
- Any comments or suggestions they provided
"@ | Set-Content -Path "$claudeCommandsDir\speckit-review.md"

Write-Host "Installed /speckit-review command to $claudeCommandsDir\speckit-review.md"

# Install OpenCode slash command
$opencodeCommandsDir = "$env:USERPROFILE\.config\opencode\command"
New-Item -ItemType Directory -Force -Path $opencodeCommandsDir | Out-Null

@"
---
description: Open interactive code review for current changes
---

The Specannotate Code Review has been triggered. Opening the review UI...
Acknowledge "Opening code review..." and wait for the user's feedback.
"@ | Set-Content -Path "$opencodeCommandsDir\specannotate-review.md"

Write-Host "Installed /specannotate-review command to $opencodeCommandsDir\specannotate-review.md"

Write-Host ""
Write-Host "=========================================="
Write-Host "  OPENCODE USERS"
Write-Host "=========================================="
Write-Host ""
Write-Host "Add the plugin to your opencode.json:"
Write-Host ""
Write-Host '  "plugin": ["@specannotate/opencode@latest"]'
Write-Host ""
Write-Host "Then restart OpenCode. The /specannotate-review command is ready!"
Write-Host ""
Write-Host "=========================================="
Write-Host "  CLAUDE CODE USERS: YOU ARE ALL SET!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Install the Claude Code plugin:"
Write-Host "  /plugin marketplace add nipunarora/specplannotate"
Write-Host "  /plugin install specannotate@specannotate"
Write-Host ""
Write-Host "The /specannotate-review command is ready to use after you restart Claude Code!"
