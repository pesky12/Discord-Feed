#!/bin/bash

# Release script for Discord Notification Feed
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.0.0
# - Updates version in package.json
# - Creates and pushes a git tag
# - Triggers GitHub Actions release workflow

if [ -z "$1" ]; then
  echo "Error: No version specified"
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.0"
  exit 1
fi

VERSION=$1

# Ensure version has v prefix
if [[ $VERSION != v* ]]; then
  VERSION="v$VERSION"
fi

echo "Updating version in package.json to $VERSION..."
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" package.json

echo "Committing changes..."
git add package.json
git commit -m "Bump version to $VERSION"

echo "Creating and pushing tag $VERSION..."
git tag $VERSION
git push origin main
git push origin $VERSION

echo "Done! GitHub Actions will now build and release version $VERSION"
echo "Check the progress at: https://github.com/xal3xhx/Discord-Feed/actions"
