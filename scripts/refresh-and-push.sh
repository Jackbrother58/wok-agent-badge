#!/usr/bin/env bash
# Refresh docs/leaderboard.json from on-chain data and push only on real change.
# Used by the leaderboard-refresh cron (every 30 min).
set -e
cd ~/workspace/hackathon-agent-id
node scripts/refresh-leaderboard.js
if ! git diff --quiet docs/leaderboard.json; then
  git add docs/leaderboard.json
  git -c user.name=Jackbrother58 -c user.email=jack.rizaldi21@gmail.com commit -m "leaderboard: auto-refresh $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push origin main
else
  echo "no leaderboard change, nothing to push"
fi
