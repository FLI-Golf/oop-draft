/// <reference path="../pb_data/types.d.ts" />
// Add draft_status field to fantasy_tournaments for easier querying
// Values: pending (not ready), ready (can start draft), in_progress, complete

migrate((app) => {
  const collection = app.findCollectionByNameOrId("fantasy_tournaments");

  collection.fields.push(new Field({
    "hidden": false,
    "id": "select_draft_status",
    "maxSelect": 1,
    "name": "draft_status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "pending",
      "ready",
      "in_progress",
      "complete"
    ]
  }));

  // Add index for querying by draft status
  collection.indexes.push("CREATE INDEX idx_fantasy_tournaments_draft_status ON fantasy_tournaments (draft_status)");

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("fantasy_tournaments");

  // Remove index
  collection.indexes = collection.indexes.filter(idx => !idx.includes("draft_status"));

  // Remove field
  collection.fields.removeById("select_draft_status");

  return app.save(collection);
});
