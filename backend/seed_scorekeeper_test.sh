#!/bin/bash
# Seed script for testing scorekeeper functionality
# Creates 6 groups with staggered tee times (10 min apart)
# All groups start on hole 1 and play front 9, then back 9 after halftime

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "Waiting for PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

echo "Setting up scorekeeper test data..."

# Get first tournament
tournament=$(curl -s "$PB_URL/api/collections/tournaments/records?perPage=1" | grep -o '"items":\[[^]]*\]' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$tournament" ]; then
  echo "Error: No tournaments found. Run seed_tournaments.sh first."
  exit 1
fi
echo "Using tournament: $tournament"

# Get pro teams (need 12 for 6 groups of 2)
teams=$(curl -s "$PB_URL/api/collections/pro_teams/records?perPage=14")
team_ids=$(echo "$teams" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -14)
team_array=($team_ids)

if [ ${#team_array[@]} -lt 12 ]; then
  echo "Error: Need at least 12 pro teams for 6 groups. Found ${#team_array[@]}. Run seed_pros.sh first."
  exit 1
fi
echo "Found ${#team_array[@]} pro teams"

# Create or get test scorekeeper user
scorekeeper_email="scorekeeper@test.com"
existing_user=$(curl -s "$PB_URL/api/collections/users/records?filter=(email='$scorekeeper_email')" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)

if [ "$existing_user" -gt 0 ]; then
  scorekeeper_id=$(curl -s "$PB_URL/api/collections/users/records?filter=(email='$scorekeeper_email')" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Using existing scorekeeper user: $scorekeeper_id"
else
  # Create scorekeeper user
  user_result=$(curl -s -X POST "$PB_URL/api/collections/users/records" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "scorekeeper@test.com",
      "password": "testpass123",
      "passwordConfirm": "testpass123",
      "emailVisibility": true
    }')
  scorekeeper_id=$(echo "$user_result" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$scorekeeper_id" ]; then
    echo "Error creating user: $user_result"
    exit 1
  fi
  
  # Create user profile
  curl -s -X POST "$PB_URL/api/collections/user_profiles/records" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$scorekeeper_id\",\"display_name\":\"Test Scorekeeper\",\"total_fantasy_points\":0}" > /dev/null
  
  echo "Created scorekeeper user: $scorekeeper_id (scorekeeper@test.com / testpass123)"
fi

# Delete existing groups for this tournament
echo "Clearing existing groups..."
existing_groups=$(curl -s "$PB_URL/api/collections/groups/records?filter=(tournament_id='$tournament')")
group_ids=$(echo "$existing_groups" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
for gid in $group_ids; do
  curl -s -X DELETE "$PB_URL/api/collections/groups/records/$gid" > /dev/null
done

# Create 6 groups with staggered tee times (10 min apart starting at 1:10pm = 20:10 UTC)
# All groups start on hole 1, play front 9 first, then back 9 after halftime
echo "Creating 6 groups with staggered tee times..."

# Group A: 1:10pm (20:10 UTC) - Teams 1 & 2
group_a=$(curl -s -X POST "$PB_URL/api/collections/groups/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$tournament\",
    \"name\": \"Group A\",
    \"team_ids\": [\"${team_array[0]}\", \"${team_array[1]}\"],
    \"scorekeeper_id\": \"$scorekeeper_id\",
    \"tee_time\": \"2027-04-03T20:10:00Z\",
    \"starting_hole\": 1
  }")
group_a_id=$(echo "$group_a" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Group A: 1:10pm - $group_a_id (scorekeeper assigned)"

# Group B: 1:20pm (20:20 UTC) - Teams 3 & 4
group_b=$(curl -s -X POST "$PB_URL/api/collections/groups/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$tournament\",
    \"name\": \"Group B\",
    \"team_ids\": [\"${team_array[2]}\", \"${team_array[3]}\"],
    \"tee_time\": \"2027-04-03T20:20:00Z\",
    \"starting_hole\": 1
  }")
group_b_id=$(echo "$group_b" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Group B: 1:20pm - $group_b_id"

# Group C: 1:30pm (20:30 UTC) - Teams 5 & 6
group_c=$(curl -s -X POST "$PB_URL/api/collections/groups/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$tournament\",
    \"name\": \"Group C\",
    \"team_ids\": [\"${team_array[4]}\", \"${team_array[5]}\"],
    \"tee_time\": \"2027-04-03T20:30:00Z\",
    \"starting_hole\": 1
  }")
group_c_id=$(echo "$group_c" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Group C: 1:30pm - $group_c_id"

# Group D: 1:40pm (20:40 UTC) - Teams 7 & 8
group_d=$(curl -s -X POST "$PB_URL/api/collections/groups/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$tournament\",
    \"name\": \"Group D\",
    \"team_ids\": [\"${team_array[6]}\", \"${team_array[7]}\"],
    \"tee_time\": \"2027-04-03T20:40:00Z\",
    \"starting_hole\": 1
  }")
group_d_id=$(echo "$group_d" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Group D: 1:40pm - $group_d_id"

# Group E: 1:50pm (20:50 UTC) - Teams 9 & 10
group_e=$(curl -s -X POST "$PB_URL/api/collections/groups/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$tournament\",
    \"name\": \"Group E\",
    \"team_ids\": [\"${team_array[8]}\", \"${team_array[9]}\"],
    \"tee_time\": \"2027-04-03T20:50:00Z\",
    \"starting_hole\": 1
  }")
group_e_id=$(echo "$group_e" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Group E: 1:50pm - $group_e_id"

# Group F: 2:00pm (21:00 UTC) - Teams 11 & 12
group_f=$(curl -s -X POST "$PB_URL/api/collections/groups/records" \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$tournament\",
    \"name\": \"Group F\",
    \"team_ids\": [\"${team_array[10]}\", \"${team_array[11]}\"],
    \"tee_time\": \"2027-04-03T21:00:00Z\",
    \"starting_hole\": 1
  }")
group_f_id=$(echo "$group_f" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Group F: 2:00pm - $group_f_id"

echo ""
echo "Tournament structure:"
echo "  - 6 groups, 2 teams each (12 teams total)"
echo "  - Staggered tee times: 1:10pm, 1:20pm, 1:30pm, 1:40pm, 1:50pm, 2:00pm"
echo "  - All start on hole 1"
echo "  - Front 9 -> Halftime -> Back 9 -> Playoff (if needed)"
echo ""
echo "Scorekeeper test setup complete!"
echo ""
echo "Login credentials:"
echo "  Email: scorekeeper@test.com"
echo "  Password: testpass123"
echo ""
echo "Navigate to /scorekeeper to test the scoring form."
