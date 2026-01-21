#!/bin/bash
# Approve the pending join request from user5
# This triggers the 6/6 hook: status -> ready, draft positions, fantasy_tournaments

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "=== Approving Pending Join Request ==="
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
  echo "Error: Test league not found. Run seed_test_scenario.sh first."
  exit 1
fi

# Check league status
status=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records/$league_id" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$status" = "ready" ]; then
  echo "League is already ready (6/6). Run reset_test_scenario.sh to reset."
  exit 0
fi

echo "League: $league_id (status: $status)"

# Find pending join request
request=$(curl -s "$PB_URL/api/collections/join_requests/records?filter=(league_id='$league_id'%26%26status='pending')")
request_id=$(echo "$request" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
user_id=$(echo "$request" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
display_name=$(echo "$request" | grep -o '"display_name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$request_id" ]; then
  echo "No pending join requests found."
  exit 1
fi

echo "Found pending request: $request_id from $display_name"
echo ""

# 1. Update join request to approved
echo "1. Approving join request..."
curl -s -X PATCH "$PB_URL/api/collections/join_requests/records/$request_id" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"approved\",\"responded_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /dev/null

# 2. Create participant (this triggers the 6/6 hook!)
echo "2. Creating participant (triggers 6/6 hook)..."
curl -s -X POST "$PB_URL/api/collections/fantasy_participants/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"league_id\":\"$league_id\",
    \"user_id\":\"$user_id\",
    \"display_name\":\"$display_name\",
    \"is_owner\":false,
    \"paid\":true,
    \"joined_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null

echo ""
echo "Waiting for hook to complete..."
sleep 2

# Check results
echo ""
echo "=== Results ==="
echo ""

# League status
new_status=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records/$league_id" | grep -o '"status":"[^"]*"\|"current_participants":[0-9]*')
echo "League: $new_status"

# Participants with draft positions
echo ""
echo "Participants:"
curl -s "$PB_URL/api/collections/fantasy_participants/records?filter=(league_id='$league_id')&sort=draft_position" | \
  grep -o '"display_name":"[^"]*"\|"draft_position":[0-9]*' | paste - - | \
  while read line; do
    name=$(echo "$line" | grep -o '"display_name":"[^"]*"' | cut -d'"' -f4)
    pos=$(echo "$line" | grep -o '"draft_position":[0-9]*' | cut -d: -f2)
    echo "  Position $pos: $name"
  done

# Fantasy tournaments
echo ""
echo "Fantasy Tournaments:"
curl -s "$PB_URL/api/collections/fantasy_tournaments/records?filter=(league_id='$league_id')&sort=tournament_number" | \
  grep -o '"tournament_name":"[^"]*"\|"tournament_number":[0-9]*' | paste - - | \
  while read line; do
    name=$(echo "$line" | grep -o '"tournament_name":"[^"]*"' | cut -d'"' -f4)
    num=$(echo "$line" | grep -o '"tournament_number":[0-9]*' | cut -d: -f2)
    echo "  #$num: $name"
  done

echo ""
echo "=========================================="
echo "League is now READY for draft!"
echo "=========================================="
