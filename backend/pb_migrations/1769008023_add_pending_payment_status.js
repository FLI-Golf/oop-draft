/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");

  // Find and update the status field to include pending_payment
  const statusField = collection.fields.find(f => f.name === "status");
  if (statusField) {
    statusField.values = [
      "pending_payment",
      "pending_players",
      "ready",
      "drafting",
      "active",
      "complete"
    ];
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");

  // Revert to original values
  const statusField = collection.fields.find(f => f.name === "status");
  if (statusField) {
    statusField.values = [
      "pending_players",
      "ready",
      "drafting",
      "active",
      "complete"
    ];
  }

  return app.save(collection);
})
