#!/bin/bash
# Only build when target branch is main.
# Cancel all preview builds for bots, Sentinel, Jules, and other branches to save deployment quota.
echo "VERCEL_GIT_COMMIT_REF is: $VERCEL_GIT_COMMIT_REF"

if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "✓ Target branch is main - Proceeding with deployment."
  exit 1
else
  echo "🛑 Branch ($VERCEL_GIT_COMMIT_REF) is not main - Build cancelled to preserve Vercel memory and build limits."
  exit 0
fi
