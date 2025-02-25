#!/bin/bash

# Simple script to create a new release

# Check if a version was provided
if [ -z "$1" ]; then
  echo "Error: No version specified"
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.0.0"
  exit 1
fi

VERSION=$1

# Make sure the version starts with "v"
if [[ $VERSION != v* ]]; then
  VERSION="v$VERSION"
fi

# Update version in package.json
# This uses a simple regex replacement
echo "Updating version in package.json to $VERSION..."
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION#v}\"/" package.json

# Commit the changes
echo "Committing changes..."
git add package.json
git commit -m "Bump version to $VERSION"

# Create and push the tag
echo "Creating and pushing tag $VERSION..."
git tag $VERSION
git push origin main
git push origin $VERSION

echo "Done! GitHub Actions will now build and release version $VERSION"
echo "Check the progress at: https://github.com/xal3xhx/Discord-Feed/actions"
