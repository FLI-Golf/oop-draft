/// <reference path="../pb_data/types.d.ts" />
// Add playoff option to tournament current_half field
// Flow: front -> halftime -> back -> playoff (if needed) -> complete

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  // Find and update current_half field to include playoff
  const halfField = collection.fields.find(f => f.name === "current_half");
  if (halfField) {
    halfField.values = ["front", "back", "playoff", "complete"];
  }

  // Update status to include playoff
  const statusField = collection.fields.find(f => f.name === "status");
  if (statusField) {
    statusField.values = ["scheduled", "live", "halftime", "playoff", "final"];
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  // Revert current_half field
  const halfField = collection.fields.find(f => f.name === "current_half");
  if (halfField) {
    halfField.values = ["front", "back", "complete"];
  }

  // Revert status field
  const statusField = collection.fields.find(f => f.name === "status");
  if (statusField) {
    statusField.values = ["scheduled", "live", "halftime", "final"];
  }

  return app.save(collection);
});
