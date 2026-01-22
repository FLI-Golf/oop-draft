/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  // Remove round fields
  collection.fields.removeById("number_current_round");
  collection.fields.removeById("number_total_rounds");

  // Add current_half field
  collection.fields.push(new Field({
    "hidden": false,
    "id": "select_current_half",
    "maxSelect": 1,
    "name": "current_half",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "front",
      "back",
      "complete"
    ]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  // Remove current_half
  collection.fields.removeById("select_current_half");

  // Re-add round fields
  collection.fields.push(new Field({
    "hidden": false,
    "id": "number_current_round",
    "max": 4,
    "min": 0,
    "name": "current_round",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));

  collection.fields.push(new Field({
    "hidden": false,
    "id": "number_total_rounds",
    "max": 4,
    "min": 1,
    "name": "total_rounds",
    "onlyInt": true,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }));

  return app.save(collection);
})
