#!/bin/bash
# Seed production database
# Run all seed scripts against the production PocketBase

set -e

PROD_URL="${PROD_URL:-https://pocketbase-production-5f03.up.railway.app}"

echo "=== Seeding Production Database ==="
echo "Target: $PROD_URL"
echo ""

# Check health
echo "Checking PocketBase health..."
if ! curl -s "$PROD_URL/api/health" | grep -q "healthy"; then
  echo "Error: PocketBase is not healthy at $PROD_URL"
  exit 1
fi
echo "✓ PocketBase is healthy"
echo ""

# Run seed scripts in order
echo "Running seed_tournaments.sh..."
PB_URL="$PROD_URL" ./seed_tournaments.sh

echo ""
echo "Running seed_pros.sh..."
PB_URL="$PROD_URL" ./seed_pros.sh

echo ""
echo "Running seed.sh (users)..."
PB_URL="$PROD_URL" ./seed.sh

echo ""
echo "=== Production Seeding Complete ==="
echo ""
echo "Admin URL: $PROD_URL/_/"
echo "API URL: $PROD_URL/api/"
