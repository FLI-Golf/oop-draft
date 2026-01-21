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
# Each team has 2 players (1 male, 1 female)
teams=(
  "Hyzer Heros"
  "Huk-a-Mania"
  "Flight Squad"
  "Birdie Storm"
  "Chain Breakers"
  "Disc Jesters"
  "Midas Touch"
  "Chain Seekers"
  "Fairway Bombers"
  "Disc Dynasty"
  "Ace Makers"
  "Glide Masters"
)

# Male pros (real PDGA pros with world rankings)
male_pros=(
  "Gannon Buhr:1050:1"
  "Ricky Wysocki:1045:2"
  "Calvin Heimburg:1040:3"
  "Isaac Robinson:1035:4"
  "Paul McBeth:1030:5"
  "Kyle Klein:1025:6"
  "Matthew Orum:1020:7"
  "Anthony Barela:1015:8"
  "Niklas Anttila:1010:9"
  "Chris Dickerson:1005:10"
  "Simon Lizotte:1000:11"
  "Ezra Robinson:995:12"
)

# Female pros (real PDGA pros with world rankings)
female_pros=(
  "Kristin Tattar:1000:1"
  "Evelina Salonen:995:2"
  "Ohn Scoggins:990:3"
  "Missy Gannon:985:4"
  "Holyn Handley:980:5"
  "Silva Saarinen:975:7"
  "Ella Hansen:970:8"
  "Hailey King:965:9"
  "Heidi Laine:960:10"
  "Paige Pierce:955:11"
  "Kat Mertsch:950:12"
  "Natalie Ryan:945:13"
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

# Create 2 reserve teams (one for males, one for females)
echo ""
echo "Creating reserve teams..."

# Reserve Males team
team=$(curl -s -X POST "$PB_URL/api/collections/pro_teams/records" \
  -H "Content-Type: application/json" \
  -d "{\"team_name\":\"Reserve Males\",\"team_size\":2,\"team_earnings\":0,\"team_points\":0,\"is_reserve\":true}")
team_id=$(echo "$team" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created reserve team: Reserve Males -> $team_id"
curl -s -X POST "$PB_URL/api/collections/pros/records" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Reserve Male 1\",\"gender\":\"male\",\"rating\":900,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
curl -s -X POST "$PB_URL/api/collections/pros/records" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Reserve Male 2\",\"gender\":\"male\",\"rating\":890,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
echo "  Added 2 reserve males"

# Reserve Females team
team=$(curl -s -X POST "$PB_URL/api/collections/pro_teams/records" \
  -H "Content-Type: application/json" \
  -d "{\"team_name\":\"Reserve Females\",\"team_size\":2,\"team_earnings\":0,\"team_points\":0,\"is_reserve\":true}")
team_id=$(echo "$team" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created reserve team: Reserve Females -> $team_id"
curl -s -X POST "$PB_URL/api/collections/pros/records" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Reserve Female 1\",\"gender\":\"female\",\"rating\":880,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
curl -s -X POST "$PB_URL/api/collections/pros/records" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Reserve Female 2\",\"gender\":\"female\",\"rating\":870,\"active\":true,\"pro_team_id\":\"$team_id\"}" > /dev/null
echo "  Added 2 reserve females"

echo ""
echo "Pro seeding complete:"
echo "  - 12 Pro Teams (24 pros: 12 male, 12 female)"
echo "  - 2 Reserve Teams (4 reserve pros: 2 male, 2 female)"
echo "  - Total: 14 teams, 28 pros"
