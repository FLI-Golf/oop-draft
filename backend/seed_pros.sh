#!/bin/bash
# Seed script for pro teams and pros
# Creates teams of 2 pros each for fantasy draft testing

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "Waiting for PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Check if pros already exist
existing=$(curl -s "$PB_URL/api/collections/pros/records" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$existing" -gt 0 ]; then
  echo "Pros already exist ($existing). Skipping pro seed."
  exit 0
fi

echo "Seeding pro teams and pros..."

# Create 12 pro teams (24 pros total for a good draft pool)
# Each team has 2 players (1 male, 1 female typically, but we'll mix it up)
teams=(
  "Desert Eagles"
  "Phoenix Flyers"
  "Cactus Kings"
  "Arizona Aces"
  "Sun Devils"
  "Canyon Crushers"
  "Dust Storm"
  "Mesa Mavericks"
  "Scottsdale Stars"
  "Tempe Thunder"
  "Tucson Titans"
  "Flagstaff Flickers"
)

# Male pros (fictional names with ratings)
male_pros=(
  "Jake Thompson:1050:1"
  "Marcus Chen:1045:2"
  "Ryan Mitchell:1040:3"
  "David Garcia:1035:4"
  "Chris Anderson:1030:5"
  "Mike Johnson:1025:6"
  "Tyler Williams:1020:7"
  "Brandon Lee:1015:8"
  "Josh Martinez:1010:9"
  "Kevin Brown:1005:10"
  "Alex Davis:1000:11"
  "Matt Wilson:995:12"
)

# Female pros (fictional names with ratings)
female_pros=(
  "Sarah Collins:1000:1"
  "Emily Rodriguez:995:2"
  "Jessica Taylor:990:3"
  "Amanda White:985:4"
  "Rachel Kim:980:5"
  "Lauren Scott:975:6"
  "Megan Clark:970:7"
  "Ashley Moore:965:8"
  "Nicole Adams:960:9"
  "Stephanie Hall:955:10"
  "Christina Young:950:11"
  "Jennifer King:945:12"
)

team_index=0
for team_name in "${teams[@]}"; do
  # Create team
  team=$(curl -s -X POST "$PB_URL/api/collections/pro_teams/records" \
    -H "Content-Type: application/json" \
    -d "{\"team_name\":\"$team_name\",\"team_size\":2,\"team_earnings\":0,\"team_points\":0,\"is_reserve\":false}")
  team_id=$(echo "$team" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Created team: $team_name -> $team_id"
  
  # Get male and female pro for this team
  male_data="${male_pros[$team_index]}"
  female_data="${female_pros[$team_index]}"
  
  # Parse male pro data
  male_name=$(echo "$male_data" | cut -d: -f1)
  male_rating=$(echo "$male_data" | cut -d: -f2)
  male_rank=$(echo "$male_data" | cut -d: -f3)
  
  # Parse female pro data
  female_name=$(echo "$female_data" | cut -d: -f1)
  female_rating=$(echo "$female_data" | cut -d: -f2)
  female_rank=$(echo "$female_data" | cut -d: -f3)
  
  # Create male pro
  curl -s -X POST "$PB_URL/api/collections/pros/records" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$male_name\",\"gender\":\"male\",\"rating\":$male_rating,\"world_ranking\":$male_rank,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
  echo "  Added: $male_name (M, rating: $male_rating)"
  
  # Create female pro
  curl -s -X POST "$PB_URL/api/collections/pros/records" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$female_name\",\"gender\":\"female\",\"rating\":$female_rating,\"world_ranking\":$female_rank,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
  echo "  Added: $female_name (F, rating: $female_rating)"
  
  team_index=$((team_index + 1))
done

# Create 2 reserve teams
echo ""
echo "Creating reserve teams..."
for i in 1 2; do
  team=$(curl -s -X POST "$PB_URL/api/collections/pro_teams/records" \
    -H "Content-Type: application/json" \
    -d "{\"team_name\":\"Reserve Team $i\",\"team_size\":2,\"team_earnings\":0,\"team_points\":0,\"is_reserve\":true}")
  team_id=$(echo "$team" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Created reserve team: Reserve Team $i -> $team_id"
  
  # Add reserve pros
  curl -s -X POST "$PB_URL/api/collections/pros/records" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Reserve Male $i\",\"gender\":\"male\",\"rating\":900,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
  curl -s -X POST "$PB_URL/api/collections/pros/records" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Reserve Female $i\",\"gender\":\"female\",\"rating\":880,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
  echo "  Added reserve pros"
done

echo ""
echo "Pro seeding complete:"
echo "  - 12 Pro Teams (24 pros)"
echo "  - 2 Reserve Teams (4 reserve pros)"
echo "  - Total: 14 teams, 28 pros"
