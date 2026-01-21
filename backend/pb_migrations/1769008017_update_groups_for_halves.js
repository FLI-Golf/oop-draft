/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");

  // Remove the index on round_id first
  collection.indexes = collection.indexes.filter(idx => !idx.includes("round_id"));

  // Remove round_id relation
  collection.fields.removeById("relation_round");

  // Add half field instead
  collection.fields.push(new Field({
    "hidden": false,
    "id": "select_half",
    "maxSelect": 1,
    "name": "half",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "front",
      "back"
    ]
  }));

  // Add new index on half
  collection.indexes.push("CREATE INDEX idx_groups_half ON groups (half)");

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");

  // Remove half index
  collection.indexes = collection.indexes.filter(idx => !idx.includes("half"));

  // Remove half field
  collection.fields.removeById("select_half");

  // Re-add round_id relation
  collection.fields.push(new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_tournament_rounds",
    "hidden": false,
    "id": "relation_round",
    "maxSelect": 1,
    "minSelect": 1,
    "name": "round_id",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }));

  // Re-add round index
  collection.indexes.push("CREATE INDEX idx_groups_round ON groups (round_id)");

  return app.save(collection);
})
