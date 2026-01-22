#!/bin/bash
# Test Scenario: League owner about to approve 5th participant
#
# State after running:
# - 1 Fantasy League "Test League 2027" (pending_players, 5/6)
# - Owner: user1@fligolf.com (participant 1/6)
# - 4 approved participants: user2-5 (participants 2-5/6)
# - 1 pending join request from user6 (waiting for approval)
#
# When owner approves user6's request:
# - League becomes 6/6
# - Hook triggers: status -> ready, draft positions assigned, fantasy_tournaments created
#
# Login as: user1@fligolf.com / MADcap(123)

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "=== Setting up Test Scenario ==="
echo "League owner about to approve 5th participant"
echo ""

# Wait for PocketBase
echo "Waiting for PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Check if test scenario already exists
existing=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records?filter=(name='Test League 2027')" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$existing" -gt 0 ]; then
  echo "Test scenario already exists. Run reset_test_scenario.sh first to reset."
  exit 0
fi

# Get season ID
season_id=$(curl -s "$PB_URL/api/collections/seasons/records?filter=(year=2027)" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$season_id" ]; then
  echo "Error: 2027 season not found. Run seed_tournaments.sh first."
  exit 1
fi
echo "Season: $season_id"

# Get owner ID (user1 - regular user, not admin)
owner_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user1')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Owner (user1): $owner_id"

# Create the fantasy league
echo ""
echo "Creating fantasy league..."
league=$(curl -s -X POST "$PB_URL/api/collections/fantasy_leagues/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Test League 2027\",
    \"season_id\":\"$season_id\",
    \"owner_id\":\"$owner_id\",
    \"status\":\"pending_players\",
    \"max_participants\":6,
    \"current_participants\":1,
    \"draft_rounds\":4,
    \"seconds_per_pick\":90,
    \"entry_fee\":100,
    \"prize_pool\":600,
    \"auto_pick_enabled\":true,
    \"payment_method\":\"other\",
    \"payment_status\":\"paid\",
    \"invited_emails\":[\"user2@fligolf.com\",\"user3@fligolf.com\",\"user4@fligolf.com\",\"user5@fligolf.com\",\"user6@fligolf.com\"]
  }")
league_id=$(echo "$league" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created league: Test League 2027 -> $league_id"

# Add owner as participant 1
echo ""
echo "Adding participants..."
curl -s -X POST "$PB_URL/api/collections/fantasy_participants/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"league_id\":\"$league_id\",
    \"user_id\":\"$owner_id\",
    \"display_name\":\"user1\",
    \"is_owner\":true,
    \"paid\":true,
    \"joined_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null
echo "  1/6: user1 (owner)"

# Add participants 2-5 (user2-5) - these are already approved
for i in 2 3 4 5; do
  user_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user${i}')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  curl -s -X POST "$PB_URL/api/collections/fantasy_participants/records" \
    -H "Content-Type: application/json" \
    -d "{
      \"league_id\":\"$league_id\",
      \"user_id\":\"$user_id\",
      \"display_name\":\"user${i}\",
      \"is_owner\":false,
      \"paid\":true,
      \"joined_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }" > /dev/null
  echo "  $((i))/6: user${i} (approved)"
done

# Update league participant count to 5
curl -s -X PATCH "$PB_URL/api/collections/fantasy_leagues/records/$league_id" \
  -H "Content-Type: application/json" \
  -d '{"current_participants":5}' > /dev/null

# Create pending join request from user6
echo ""
echo "Creating pending join request..."
user6_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user6')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)

join_request=$(curl -s -X POST "$PB_URL/api/collections/join_requests/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"league_id\":\"$league_id\",
    \"user_id\":\"$user6_id\",
    \"display_name\":\"user6\",
    \"message\":\"I would like to join the league!\",
    \"status\":\"pending\"
  }")
request_id=$(echo "$join_request" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Pending request from user6 -> $request_id"

# Save IDs for reset script
echo ""
echo "Saving scenario state..."
cat > /tmp/test_scenario_state.env << EOF
LEAGUE_ID=$league_id
JOIN_REQUEST_ID=$request_id
USER6_ID=$user6_id
EOF

echo ""
echo "=========================================="
echo "TEST SCENARIO READY"
echo "=========================================="
echo ""
echo "League: Test League 2027"
echo "Status: pending_players (5/6 participants)"
echo ""
echo "Participants:"
echo "  1. user1 (owner)"
echo "  2. user2"
echo "  3. user3"
echo "  4. user4"
echo "  5. user5"
echo "  6. [PENDING] user6 - waiting for approval"
echo ""
echo "Login as owner: user1@fligolf.com / MADcap(123)"
echo ""
echo "To approve user6 and trigger 6/6:"
echo "  1. Go to PocketBase Admin -> join_requests"
echo "  2. Find user6's request, change status to 'approved'"
echo "  3. Then create participant for user6 in fantasy_participants"
echo ""
echo "Or run: ./approve_pending.sh"
echo ""
echo "To reset: ./reset_test_scenario.sh"
echo "=========================================="
