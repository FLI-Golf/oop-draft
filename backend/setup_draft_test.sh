#!/bin/bash
# Setup script to get a league ready for draft testing
# Creates a league with 6 participants and fantasy tournaments initialized
#
# End state:
# - League "user1-XXXX" with status "ready"
# - 6 participants (user1 as owner + user2-6)
# - 6 fantasy tournaments with draft_management initialized
# - Draft status: "waiting" (ready to start)
#
# Login: user1@fligolf.com / MADcap(123)

set -e

PB_URL="${PB_URL:-http://localhost:8090}"
PASSWORD="MADcap(123)"

echo "=== Draft Test Setup ==="
echo ""

# Check if PocketBase is running
echo "Checking PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    echo "  PocketBase is running"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "  ERROR: PocketBase not running. Start it first."
    exit 1
  fi
  sleep 1
done

# Check if users exist
echo ""
echo "Checking users..."
user_count=$(curl -s "$PB_URL/api/collections/user_profiles/records" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$user_count" -lt 6 ]; then
  echo "  Running seed.sh to create users..."
  ./seed.sh
else
  echo "  Users exist ($user_count profiles)"
fi

# Check if season/tournaments exist
echo ""
echo "Checking season and tournaments..."
season_count=$(curl -s "$PB_URL/api/collections/seasons/records" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$season_count" -eq 0 ]; then
  echo "  Running seed_tournaments.sh..."
  ./seed_tournaments.sh
else
  echo "  Season exists"
fi

# Check if pros exist
echo ""
echo "Checking pros..."
pro_count=$(curl -s "$PB_URL/api/collections/pros/records" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$pro_count" -eq 0 ]; then
  echo "  Running seed_pros.sh..."
  ./seed_pros.sh
else
  echo "  Pros exist ($pro_count)"
fi

# Get user1's ID
echo ""
echo "Getting user IDs..."
user1_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user1')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$user1_id" ]; then
  echo "  ERROR: user1 not found"
  exit 1
fi
echo "  user1: $user1_id"

# Check for existing test league
echo ""
echo "Checking for existing test league..."
existing_league=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records?filter=(owner_id='$user1_id')" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$existing_league" ]; then
  echo "  Found existing league: $existing_league"
  echo "  Cleaning up..."
  
  # Delete fantasy_tournaments
  curl -s "$PB_URL/api/collections/fantasy_tournaments/records?filter=(league_id='$existing_league')" | \
    grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
      curl -s -X DELETE "$PB_URL/api/collections/fantasy_tournaments/records/$id" > /dev/null
    done
  
  # Delete participants
  curl -s "$PB_URL/api/collections/fantasy_participants/records?filter=(league_id='$existing_league')" | \
    grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
      curl -s -X DELETE "$PB_URL/api/collections/fantasy_participants/records/$id" > /dev/null
    done
  
  # Delete join requests
  curl -s "$PB_URL/api/collections/join_requests/records?filter=(league_id='$existing_league')" | \
    grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read id; do
      curl -s -X DELETE "$PB_URL/api/collections/join_requests/records/$id" > /dev/null
    done
  
  # Delete league
  curl -s -X DELETE "$PB_URL/api/collections/fantasy_leagues/records/$existing_league" > /dev/null
  echo "  Cleaned up"
fi

# Get season ID
season_id=$(curl -s "$PB_URL/api/collections/seasons/records?filter=(year=2027)" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "Season ID: $season_id"

# Create new league
echo ""
echo "Creating league..."
league_name="user1-${user1_id: -4}"
league_response=$(curl -s -X POST "$PB_URL/api/collections/fantasy_leagues/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$league_name\",
    \"season_id\": \"$season_id\",
    \"owner_id\": \"$user1_id\",
    \"status\": \"pending_players\",
    \"max_participants\": 6,
    \"current_participants\": 1,
    \"draft_rounds\": 4,
    \"seconds_per_pick\": 7,
    \"entry_fee\": 0,
    \"prize_pool\": 0,
    \"auto_pick_enabled\": true,
    \"payment_method\": \"other\",
    \"payment_status\": \"paid\"
  }")

league_id=$(echo "$league_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Created league: $league_name ($league_id)"

# Add owner as participant
echo ""
echo "Adding owner as participant..."
curl -s -X POST "$PB_URL/api/collections/fantasy_participants/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"league_id\": \"$league_id\",
    \"user_id\": \"$user1_id\",
    \"display_name\": \"user1\",
    \"is_owner\": true,
    \"paid\": true,
    \"joined_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null
echo "  Added user1 (owner)"

# Add user2-6 as participants (this triggers the hook on the 5th one)
echo ""
echo "Adding participants (user2-6)..."
for i in 2 3 4 5 6; do
  user_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user${i}')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$user_id" ]; then
    echo "  user${i}: not found, skipping"
    continue
  fi

  curl -s -X POST "$PB_URL/api/collections/fantasy_participants/records" \
    -H "Content-Type: application/json" \
    -d "{
      \"league_id\": \"$league_id\",
      \"user_id\": \"$user_id\",
      \"display_name\": \"user${i}\",
      \"is_owner\": false,
      \"paid\": false,
      \"joined_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }" > /dev/null

  # Update participant count
  curl -s -X PATCH "$PB_URL/api/collections/fantasy_leagues/records/$league_id" \
    -H "Content-Type: application/json" \
    -d "{\"current_participants\": $i}" > /dev/null

  echo "  Added user${i}"
  
  # Small delay to let hook process
  sleep 0.5
done

# Wait for hook to complete
sleep 2

# Verify final state
echo ""
echo "=== Verification ==="
league_status=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records/$league_id" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
participant_count=$(curl -s "$PB_URL/api/collections/fantasy_participants/records?filter=(league_id='$league_id')" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
tournament_count=$(curl -s "$PB_URL/api/collections/fantasy_tournaments/records?filter=(league_id='$league_id')" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)

echo "  League: $league_name"
echo "  Status: $league_status"
echo "  Participants: $participant_count/6"
echo "  Fantasy Tournaments: $tournament_count"

# Get first tournament for URL
first_tournament=$(curl -s "$PB_URL/api/collections/fantasy_tournaments/records?filter=(league_id='$league_id')&sort=tournament_number" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "=== Ready for Testing ==="
echo ""
echo "Login: user1@fligolf.com / $PASSWORD"
echo ""
echo "League URL: /user/league/$league_id"
echo "Draft URL:  /user/league/$league_id/draft/$first_tournament"
echo ""
