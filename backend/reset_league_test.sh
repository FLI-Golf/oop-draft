#!/bin/bash
# Reset the user1-314j league to pending_players with only owner
# Then create join requests from user2-user6

set -e

PB_URL="${PB_URL:-http://localhost:8090}"
LEAGUE_NAME="user1-314j"

echo "=== Resetting League: $LEAGUE_NAME ==="

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

# Get owner user_id
owner_id=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records/$league_id" | grep -o '"owner_id":"[^"]*"' | cut -d'"' -f4)
echo "Owner: $owner_id"

# Delete all fantasy_tournaments for this league
echo "Deleting fantasy_tournaments..."
curl -s "$PB_URL/api/collections/fantasy_tournaments/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    curl -s -X DELETE "$PB_URL/api/collections/fantasy_tournaments/records/$id" > /dev/null
    echo "  Deleted: $id"
  done

# Delete all participants except owner
echo "Deleting non-owner participants..."
curl -s "$PB_URL/api/collections/fantasy_participants/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    # Check if this is the owner
    participant=$(curl -s "$PB_URL/api/collections/fantasy_participants/records/$id")
    is_owner=$(echo "$participant" | grep -o '"is_owner":[^,}]*' | cut -d: -f2)
    if [ "$is_owner" != "true" ]; then
      curl -s -X DELETE "$PB_URL/api/collections/fantasy_participants/records/$id" > /dev/null
      echo "  Deleted participant: $id"
    else
      # Reset owner's draft_position
      curl -s -X PATCH "$PB_URL/api/collections/fantasy_participants/records/$id" \
        -H "Content-Type: application/json" \
        -d '{"draft_position":null}' > /dev/null
      echo "  Reset owner draft_position"
    fi
  done

# Delete all join requests for this league
echo "Deleting join requests..."
curl -s "$PB_URL/api/collections/join_requests/records?filter=(league_id='$league_id')" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
    curl -s -X DELETE "$PB_URL/api/collections/join_requests/records/$id" > /dev/null
    echo "  Deleted: $id"
  done

# Reset league to pending_players with 1 participant
echo "Resetting league status..."
curl -s -X PATCH "$PB_URL/api/collections/fantasy_leagues/records/$league_id" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending_players",
    "current_participants": 1,
    "draft_order": null,
    "draft_pool": null,
    "draft_results": null
  }' > /dev/null

echo ""
echo "League reset complete!"
echo ""

# Now create join requests
echo "Creating join requests from user2-user6..."
for i in 2 3 4 5 6; do
  user_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user${i}')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$user_id" ]; then
    echo "  user${i}: not found, skipping"
    continue
  fi

  curl -s -X POST "$PB_URL/api/collections/join_requests/records" \
    -H "Content-Type: application/json" \
    -d "{
      \"league_id\":\"$league_id\",
      \"user_id\":\"$user_id\",
      \"display_name\":\"user${i}\",
      \"message\":\"Ready to draft!\",
      \"status\":\"pending\"
    }" > /dev/null

  echo "  user${i}: join request created"
done

echo ""
echo "=== Ready for Testing ==="
echo "League: $LEAGUE_NAME (1/6 participants)"
echo "5 pending join requests from user2-user6"
echo ""
echo "Login as: user1@fligolf.com / MADcap(123)"
echo "Approve all 5 requests to trigger draft setup"
