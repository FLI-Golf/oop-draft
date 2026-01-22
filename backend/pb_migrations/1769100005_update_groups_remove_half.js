/// <reference path="../pb_data/types.d.ts" />
// Update groups: remove half field since all groups play both front and back 9
// Groups have staggered tee times (10 min apart) and all start on hole 1

migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");

  // Remove half index
  collection.indexes = collection.indexes.filter(idx => !idx.includes("half"));

  // Remove half field
  collection.fields.removeById("select_half");

  // Update starting_hole to allow 1-18 (full course)
  const startingHoleField = collection.fields.find(f => f.name === "starting_hole");
  if (startingHoleField) {
    startingHoleField.max = 18;
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");

  // Re-add half field
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

  // Re-add half index
  collection.indexes.push("CREATE INDEX idx_groups_half ON groups (half)");

  // Revert starting_hole max to 9
  const startingHoleField = collection.fields.find(f => f.name === "starting_hole");
  if (startingHoleField) {
    startingHoleField.max = 9;
  }

  return app.save(collection);
});
