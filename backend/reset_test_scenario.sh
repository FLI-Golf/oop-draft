#!/bin/bash
# Reset test scenario back to starting point (5/6, pending approval)
#
# This deletes the test league and all related data, then re-runs seed_test_scenario.sh

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "=== Resetting Test Scenario ==="
echo ""

# Wait for PocketBase
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Find the test league
league_id=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records?filter=(name='Test%20League%202027')" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$league_id" ]; then
  echo "No test scenario found. Running seed_test_scenario.sh..."
  bash "$(dirname "$0")/seed_test_scenario.sh"
  exit 0
fi

echo "Found test league: $league_id"
echo "Cleaning up..."

# Delete fantasy_tournaments for this league
echo "  Deleting fantasy_tournaments..."
curl -s "$PB_URL/api/collections/fantasy_tournaments/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    curl -s -X DELETE "$PB_URL/api/collections/fantasy_tournaments/records/$id" > /dev/null
  done

# Delete draft_picks for this league
echo "  Deleting draft_picks..."
curl -s "$PB_URL/api/collections/draft_picks/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    curl -s -X DELETE "$PB_URL/api/collections/draft_picks/records/$id" > /dev/null
  done

# Delete fantasy_participants for this league
echo "  Deleting fantasy_participants..."
curl -s "$PB_URL/api/collections/fantasy_participants/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    curl -s -X DELETE "$PB_URL/api/collections/fantasy_participants/records/$id" > /dev/null
  done

# Delete join_requests for this league
echo "  Deleting join_requests..."
curl -s "$PB_URL/api/collections/join_requests/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    curl -s -X DELETE "$PB_URL/api/collections/join_requests/records/$id" > /dev/null
  done

# Delete the league itself
echo "  Deleting league..."
curl -s -X DELETE "$PB_URL/api/collections/fantasy_leagues/records/$league_id" > /dev/null

echo ""
echo "Cleanup complete. Re-creating test scenario..."
echo ""

# Re-run the seed script
bash "$(dirname "$0")/seed_test_scenario.sh"
