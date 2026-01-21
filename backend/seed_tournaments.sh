#!/bin/bash
# Seed script for 2027 season with Turf Paradise course and 6 tournaments
# Skips if data already exists

set -e

PB_URL="${PB_URL:-http://localhost:8090}"

echo "Waiting for PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Check if season already exists
existing=$(curl -s "$PB_URL/api/collections/seasons/records?filter=(year=2027)" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$existing" -gt 0 ]; then
  echo "2027 season already exists. Skipping tournament seed."
  exit 0
fi

echo "Seeding 2027 season and tournaments..."

# Create 2027 Season with $4M yearly pot
season=$(curl -s -X POST "$PB_URL/api/collections/seasons/records" \
  -H "Content-Type: application/json" \
  -d '{"name":"2027 Season","year":2027,"active":true,"yearly_pot":4000000}')
season_id=$(echo "$season" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created season: 2027 Season -> $season_id (yearly_pot: \$4,000,000)"

# Create Turf Paradise course (9 holes)
course=$(curl -s -X POST "$PB_URL/api/collections/courses/records" \
  -H "Content-Type: application/json" \
  -d '{"name":"Turf Paradise","location":"Phoenix, Arizona","hole_count":9}')
course_id=$(echo "$course" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created course: Turf Paradise -> $course_id"

# Create 9 holes with names - all par 3, distances 200-320 feet
holes=(
  '{"number":1,"name":"The Opener","par":3,"distance":200}'
  '{"number":2,"name":"Desert Run","par":3,"distance":245}'
  '{"number":3,"name":"Cactus Alley","par":3,"distance":220}'
  '{"number":4,"name":"The Wash","par":3,"distance":280}'
  '{"number":5,"name":"Sunset View","par":3,"distance":260}'
  '{"number":6,"name":"Snake Bend","par":3,"distance":290}'
  '{"number":7,"name":"Dust Devil","par":3,"distance":235}'
  '{"number":8,"name":"Canyon Shot","par":3,"distance":305}'
  '{"number":9,"name":"The Finisher","par":3,"distance":320}'
)

echo "Creating holes..."
for hole in "${holes[@]}"; do
  # Add course_id to hole data
  hole_data=$(echo "$hole" | sed "s/}$/,\"course_id\":\"$course_id\"}/")
  curl -s -X POST "$PB_URL/api/collections/holes/records" \
    -H "Content-Type: application/json" \
    -d "$hole_data" > /dev/null
done
echo "  Created 9 holes for Turf Paradise"

# Create 6 tournaments in April-May 2027 (every Saturday)
# Progressive prize pools: 10%, 12.5%, 15%, 17.5%, 20%, 25% of $4M
# April 2027: Saturdays are 3, 10, 17, 24
# May 2027: Saturdays are 1, 8
# Start time: 1pm Arizona (UTC-7) = 8pm UTC (20:00)
tournaments=(
  '{"name":"Tournament 1 - Spring Opener","start_date":"2027-04-03T20:00:00Z","prize_pool":400000,"start_type":"standard"}'
  '{"name":"Tournament 2 - Desert Classic","start_date":"2027-04-10T20:00:00Z","prize_pool":500000,"start_type":"standard"}'
  '{"name":"Tournament 3 - Cactus Cup","start_date":"2027-04-17T20:00:00Z","prize_pool":600000,"start_type":"standard"}'
  '{"name":"Tournament 4 - Arizona Open","start_date":"2027-04-24T20:00:00Z","prize_pool":700000,"start_type":"standard"}'
  '{"name":"Tournament 5 - Phoenix Showdown","start_date":"2027-05-01T20:00:00Z","prize_pool":800000,"start_type":"standard"}'
  '{"name":"Tournament 6 - Season Finale","start_date":"2027-05-08T20:00:00Z","prize_pool":1000000,"start_type":"standard"}'
)

echo "Creating tournaments..."
for t in "${tournaments[@]}"; do
  # Add season_id, course_id, status (no rounds - using front/back halves)
  t_data=$(echo "$t" | sed "s/}$/,\"season_id\":\"$season_id\",\"course_id\":\"$course_id\",\"status\":\"scheduled\"}/")
  result=$(curl -s -X POST "$PB_URL/api/collections/tournaments/records" \
    -H "Content-Type: application/json" \
    -d "$t_data")
  t_id=$(echo "$result" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  t_name=$(echo "$t" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  t_prize=$(echo "$t" | grep -o '"prize_pool":[0-9]*' | cut -d: -f2)
  echo "  Created: $t_name -> $t_id (prize: \$$(printf "%'d" $t_prize))"
done

echo ""
echo "Tournament seeding complete:"
echo "  - 1 Season (2027, \$4,000,000 yearly pot)"
echo "  - 1 Course (Turf Paradise, 9 holes, all par 3, 200-320 ft)"
echo "  - 6 Tournaments (April-May 2027, Saturdays at 1pm Arizona)"
echo "    Progressive prizes: \$400K -> \$500K -> \$600K -> \$700K -> \$800K -> \$1M"
echo "    Each tournament: front 9 -> halftime -> back 9"
