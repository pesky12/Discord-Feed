@echo off
:: Simple script to create a new release on Windows

:: Check if a version was provided
if "%~1"=="" (
  echo Error: No version specified
  echo Usage: scripts\release.bat ^<version^>
  echo Example: scripts\release.bat 1.0.0
  exit /b 1
)

set VERSION=%~1

:: Make sure the version starts with "v"
if not "%VERSION:~0,1%"=="v" (
  set VERSION=v%VERSION%
)

:: Display the action we're taking
echo Updating version in package.json to %VERSION%...

:: This would ideally use a tool like jq to modify the package.json
:: But for simplicity, you can manually update the version in package.json
echo Please manually update the version in package.json to %VERSION:~1% and press any key to continue...
pause > nul

:: Commit the changes
echo Committing changes...
git add package.json
git commit -m "Bump version to %VERSION%"

:: Create and push the tag
echo Creating and pushing tag %VERSION%...
git tag %VERSION%
git push origin main
git push origin %VERSION%

echo Done! GitHub Actions will now build and release version %VERSION%
echo Check the progress at: https://github.com/yourusername/discord-notification-feed/actions

pause
