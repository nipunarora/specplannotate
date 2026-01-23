@echo off
setlocal enabledelayedexpansion

REM Plannotator Windows CMD Bootstrap Script

REM Parse command line argument
set "VERSION=%~1"
if "!VERSION!"=="" set "VERSION=latest"

set "REPO=nipunarora/specplannotate"
set "INSTALL_DIR=%USERPROFILE%\.local\bin"
set "PLATFORM=win32-x64"

REM Check for 64-bit Windows
if /i "%PROCESSOR_ARCHITECTURE%"=="AMD64" goto :arch_valid
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" goto :arch_valid
if /i "%PROCESSOR_ARCHITEW6432%"=="AMD64" goto :arch_valid
if /i "%PROCESSOR_ARCHITEW6432%"=="ARM64" goto :arch_valid

echo Plannotator does not support 32-bit Windows. >&2
exit /b 1

:arch_valid

REM Check for curl availability
curl --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo curl is required but not available. Please use the PowerShell installer. >&2
    exit /b 1
)

REM Create install directory
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

REM Get version to install
if /i "!VERSION!"=="latest" (
    echo Fetching latest version...

    REM Download release info and extract tag_name
    curl -fsSL "https://api.github.com/repos/!REPO!/releases/latest" -o "%TEMP%\release.json"
    if !ERRORLEVEL! neq 0 (
        echo Failed to get latest version >&2
        exit /b 1
    )

    REM Extract tag_name from JSON
    for /f "tokens=2 delims=:," %%i in ('findstr /c:"\"tag_name\"" "%TEMP%\release.json"') do (
        set "TAG=%%i"
        set "TAG=!TAG: =!"
        set "TAG=!TAG:"=!"
    )
    del "%TEMP%\release.json"

    if "!TAG!"=="" (
        echo Failed to parse version >&2
        exit /b 1
    )
) else (
    set "TAG=!VERSION!"
    REM Add v prefix if not present
    echo !TAG! | findstr /b "v" >nul
    if !ERRORLEVEL! neq 0 set "TAG=v!TAG!"
)

echo Installing specannotate !TAG!...

set "BINARY_NAME=specannotate-!PLATFORM!.exe"
set "BINARY_URL=https://github.com/!REPO!/releases/download/!TAG!/!BINARY_NAME!"
set "CHECKSUM_URL=!BINARY_URL!.sha256"

REM Download binary
set "TEMP_FILE=%TEMP%\specannotate-!TAG!.exe"
curl -fsSL "!BINARY_URL!" -o "!TEMP_FILE!"
if !ERRORLEVEL! neq 0 (
    echo Failed to download binary >&2
    if exist "!TEMP_FILE!" del "!TEMP_FILE!"
    exit /b 1
)

REM Download checksum
curl -fsSL "!CHECKSUM_URL!" -o "%TEMP%\checksum.txt"
if !ERRORLEVEL! neq 0 (
    echo Failed to download checksum >&2
    del "!TEMP_FILE!"
    exit /b 1
)

REM Extract expected checksum (first field)
set /p EXPECTED_CHECKSUM=<"%TEMP%\checksum.txt"
for /f "tokens=1" %%i in ("!EXPECTED_CHECKSUM!") do set "EXPECTED_CHECKSUM=%%i"
del "%TEMP%\checksum.txt"

REM Verify checksum using certutil
set "ACTUAL_CHECKSUM="
for /f "skip=1 tokens=*" %%i in ('certutil -hashfile "!TEMP_FILE!" SHA256') do (
    if not defined ACTUAL_CHECKSUM (
        set "ACTUAL_CHECKSUM=%%i"
        set "ACTUAL_CHECKSUM=!ACTUAL_CHECKSUM: =!"
    )
)

if /i "!ACTUAL_CHECKSUM!" neq "!EXPECTED_CHECKSUM!" (
    echo Checksum verification failed >&2
    del "!TEMP_FILE!"
    exit /b 1
)

REM Install binary
set "INSTALL_PATH=!INSTALL_DIR!\specannotate.exe"
move /y "!TEMP_FILE!" "!INSTALL_PATH!" >nul

echo.
echo specannotate !TAG! installed to !INSTALL_PATH!

REM Check if install directory is in PATH
echo !PATH! | findstr /i /c:"!INSTALL_DIR!" >nul
if !ERRORLEVEL! neq 0 (
    echo.
    echo !INSTALL_DIR! is not in your PATH.
    echo.
    echo Add it permanently with:
    echo.
    echo   setx PATH "%%PATH%%;!INSTALL_DIR!"
    echo.
    echo Or add it for this session only:
    echo.
    echo   set PATH=%%PATH%%;!INSTALL_DIR!
)

REM Install slash commands for Claude Code
set "CLAUDE_COMMANDS_DIR=%USERPROFILE%\.claude\commands"
if not exist "!CLAUDE_COMMANDS_DIR!" mkdir "!CLAUDE_COMMANDS_DIR!"

REM Install /specannotate-review command
(
echo ---
echo description: Open interactive code review for current changes
echo allowed-tools: Bash^(specannotate:*^)
echo ---
echo.
echo ## Code Review Feedback
echo.
echo !`specannotate review`
echo.
echo ## Your task
echo.
echo Address the code review feedback above. The user has reviewed your changes in the Specannotate UI and provided specific annotations and comments.
) > "!CLAUDE_COMMANDS_DIR!\specannotate-review.md"

echo Installed /specannotate-review command to !CLAUDE_COMMANDS_DIR!\specannotate-review.md

REM Install /speckit-review command
(
echo ---
echo description: Review spec-kit specification documents for current feature branch
echo allowed-tools: Bash^(specannotate:*^)
echo ---
echo.
echo ## Spec Review Feedback
echo.
echo !`specannotate speckit`
echo.
echo ## Your task
echo.
echo Address the spec review feedback above. The user has reviewed your specification documents ^(spec.md, plan.md, tasks.md, etc.^) in the Specannotate UI and provided specific annotations and comments.
echo.
echo Focus on the areas they highlighted:
echo - Specification details they want changed
echo - Technical plan items they disagree with
echo - Task ordering or scope concerns
echo - Any comments or suggestions they provided
) > "!CLAUDE_COMMANDS_DIR!\speckit-review.md"

echo Installed /speckit-review command to !CLAUDE_COMMANDS_DIR!\speckit-review.md

echo.
echo Test the install:
echo   echo {"tool_input":{"plan":"# Test Plan\\n\\nHello world"}} ^| specannotate
echo.
echo Then install the Claude Code plugin:
echo   /plugin marketplace add nipunarora/specplannotate
echo   /plugin install specannotate@specannotate
echo.
echo The /specannotate-review command is ready to use!
echo.
exit /b 0
