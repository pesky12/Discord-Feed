@echo off

REM Release script for Discord Notification Feed (Windows)
REM Usage: scripts\release.bat <version>
REM Example: scripts\release.bat 1.0.0
REM - Updates version in package.json
REM - Creates and pushes a git tag
REM - Triggers GitHub Actions release workflow

if "%~1"=="" (
  echo Error: No version specified
  echo Usage: scripts\release.bat ^<version^>
  echo Example: scripts\release.bat 1.0.0
  exit /b 1
)

set VERSION=%~1

REM Ensure version has v prefix
if not "%VERSION:~0,1%"=="v" (
  set VERSION=v%VERSION%
)

echo Updating version in package.json to %VERSION%...

echo Please manually update the version in package.json to %VERSION:~1% and press any key to continue...
pause > nul

echo Committing changes...
git add package.json
git commit -m "Bump version to %VERSION%"

echo Creating and pushing tag %VERSION%...
git tag %VERSION%
git push origin main
git push origin %VERSION%

echo Done! GitHub Actions will now build and release version %VERSION%
echo Check the progress at: https://github.com/xal3xhx/Discord-Feed/actions

pause
