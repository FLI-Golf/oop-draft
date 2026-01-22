#!/bin/bash
# Seed script for fantasy league demo
# Creates a complete fantasy league with 6 participants and fantasy_tournaments

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "Waiting for PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Check if fantasy leagues already exist
existing=$(curl -s "$PB_URL/api/collections/fantasy_leagues/records" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$existing" -gt 0 ]; then
  echo "Fantasy leagues already exist ($existing). Skipping fantasy seed."
  exit 0
fi

echo "Seeding fantasy league demo..."

# Get season ID
season_id=$(curl -s "$PB_URL/api/collections/seasons/records?filter=(year=2027)" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$season_id" ]; then
  echo "Error: 2027 season not found. Run seed_tournaments.sh first."
  exit 1
fi
echo "Found season: $season_id"

# Get user IDs via user_profiles (which has open list rules)
owner_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='admin1')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Owner (admin1): $owner_id"

# Create fantasy league (simulating paid via "other" method)
league=$(curl -s -X POST "$PB_URL/api/collections/fantasy_leagues/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"FLI Golf League 2027\",
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
    \"invited_emails\":[\"user1@fligolf.com\",\"user2@fligolf.com\",\"user3@fligolf.com\",\"user4@fligolf.com\",\"user5@fligolf.com\"]
  }")
league_id=$(echo "$league" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created league: FLI Golf League 2027 -> $league_id"

# Create owner as first participant
curl -s -X POST "$PB_URL/api/collections/fantasy_participants/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"league_id\":\"$league_id\",
    \"user_id\":\"$owner_id\",
    \"display_name\":\"admin1\",
    \"is_owner\":true,
    \"paid\":true,
    \"joined_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null
echo "  Added owner as participant 1/6"

# Add 5 more participants (simulating approved join requests)
participant_count=2
for i in 1 2 3 4 5; do
  user_id=$(curl -s "$PB_URL/api/collections/user_profiles/records?filter=(display_name='user${i}')" | grep -o '"user_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$user_id" ]; then
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
    echo "  Added user${i} as participant ${participant_count}/6"
    participant_count=$((participant_count + 1))
  fi
done

# Update league to ready status with 6 participants
curl -s -X PATCH "$PB_URL/api/collections/fantasy_leagues/records/$league_id" \
  -H "Content-Type: application/json" \
  -d '{"status":"ready","current_participants":6}' > /dev/null
echo "League status: ready (6/6 participants)"

# Assign random draft positions to participants
echo "Assigning random draft positions..."
participants=$(curl -s "$PB_URL/api/collections/fantasy_participants/records?filter=(league_id='$league_id')" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Shuffle and assign positions
position=1
for pid in $(echo "$participants" | shuf); do
  curl -s -X PATCH "$PB_URL/api/collections/fantasy_participants/records/$pid" \
    -H "Content-Type: application/json" \
    -d "{\"draft_position\":$position}" > /dev/null
  position=$((position + 1))
done
echo "  Draft positions assigned (1-6)"

# Create fantasy_tournaments for all 6 tournaments in the season
echo "Creating fantasy tournaments..."
tournaments=$(curl -s "$PB_URL/api/collections/tournaments/records?filter=(season_id='$season_id')&sort=start_date")

tournament_num=1
echo "$tournaments" | grep -o '"id":"[^"]*"\|"name":"[^"]*"\|"start_date":"[^"]*"' | paste - - - | while read line; do
  t_id=$(echo "$line" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  t_name=$(echo "$line" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  t_date=$(echo "$line" | grep -o '"start_date":"[^"]*"' | cut -d'"' -f4)
  
  curl -s -X POST "$PB_URL/api/collections/fantasy_tournaments/records" \
    -H "Content-Type: application/json" \
    -d "{
      \"league_id\":\"$league_id\",
      \"tournament_id\":\"$t_id\",
      \"tournament_name\":\"$t_name\",
      \"tournament_number\":$tournament_num,
      \"status\":\"upcoming\",
      \"start_date\":\"$t_date\",
      \"points_calculated\":false
    }" > /dev/null
  echo "  Created: $t_name (Tournament #$tournament_num)"
  tournament_num=$((tournament_num + 1))
done

echo ""
echo "Fantasy league seeding complete:"
echo "  - 1 Fantasy League (FLI Golf League 2027)"
echo "  - 6 Participants with random draft positions"
echo "  - 6 Fantasy Tournaments linked to season tournaments"
echo "  - Status: ready (waiting for draft)"
