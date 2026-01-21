#!/bin/bash
# Create join requests from user2-user6 for the user1-314j league
# (5 requests to fill remaining 5 slots)

set -e

PB_URL="${PB_URL:-http://localhost:8090}"
LEAGUE_NAME="user1-314j"

echo "=== Creating Join Requests for $LEAGUE_NAME ==="

# Wait for PocketBase
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Find the league
league_id=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records?filter=(name='$LEAGUE_NAME')" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$league_id" ]; then
  echo "Error: League '$LEAGUE_NAME' not found"
  exit 1
fi

echo "Found league: $league_id"
echo ""

# Create join requests for user2-user6 (5 users to fill 5 remaining slots)
for i in 2 3 4 5 6; do
  # Get user ID
  user_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user${i}')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$user_id" ]; then
    echo "  user${i}: not found, skipping"
    continue
  fi

  # Check if request already exists
  existing=$(curl -s "$PB_URL/api/collections/join_requests/records?filter=(league_id='$league_id'%26%26user_id='$user_id')" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
  
  if [ "$existing" -gt 0 ]; then
    echo "  user${i}: request already exists, skipping"
    continue
  fi

  # Create join request
  curl -s -X POST "$PB_URL/api/collections/join_requests/records" \
    -H "Content-Type: application/json" \
    -d "{
      \"league_id\":\"$league_id\",
      \"user_id\":\"$user_id\",
      \"display_name\":\"user${i}\",
      \"message\":\"I'd like to join the league!\",
      \"status\":\"pending\"
    }" > /dev/null

  echo "  user${i}: join request created"
done

echo ""
echo "Done! Login as user1@fligolf.com to see pending requests."
echo "Password: MADcap(123)"
