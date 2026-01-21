#!/bin/bash
# Seed script for test users
# Runs after PocketBase starts - skips if users already exist

set -e

PB_URL="${PB_URL:-http://localhost:8090}"
PASSWORD="MADcap(123)"

# Wait for PocketBase to be ready
echo "Waiting for PocketBase..."
for i in {1..30}; do
  if curl -s "$PB_URL/api/health" | grep -q "healthy"; then
    break
  fi
  sleep 1
done

# Check if users already exist
existing=$(curl -s "$PB_URL/api/collections/user_profiles/records" | grep -o '"totalItems":[0-9]*' | cut -d: -f2)
if [ "$existing" -gt 0 ]; then
  echo "Seed data already exists ($existing user_profiles). Skipping."
  exit 0
fi

echo "Seeding test users..."

create_user() {
  local email=$1
  local display_name=$2
  local role=$3
  
  # Create auth user
  user=$(curl -s -X POST "$PB_URL/api/collections/users/records" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"passwordConfirm\":\"${PASSWORD}\"}")
  
  user_id=$(echo "$user" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$user_id" ]; then
    # Create user_profile
    curl -s -X POST "$PB_URL/api/collections/user_profiles/records" \
      -H "Content-Type: application/json" \
      -d "{\"user_id\":\"${user_id}\",\"display_name\":\"${display_name}\",\"role\":[\"${role}\"]}" > /dev/null
    echo "  Created: $email ($role)"
  else
    echo "  Failed: $email"
  fi
}

# 2 Admins
create_user "admin1@fligolf.com" "admin1" "admin"
create_user "admin2@fligolf.com" "admin2" "admin"

# 6 Scorekeepers
for i in $(seq 1 6); do
  create_user "scorekeeper${i}@fligolf.com" "scorekeeper${i}" "scorekeeper"
done

# 12 Users
for i in $(seq 1 12); do
  create_user "user${i}@fligolf.com" "user${i}" "user"
done

echo "Seeding complete: 2 admins, 6 scorekeepers, 12 users"
echo "All passwords: $PASSWORD"
