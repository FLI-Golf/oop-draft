/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  collection.fields.push(new Field({
    "hidden": false,
    "id": "select_start_type",
    "maxSelect": 1,
    "name": "start_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "standard",
      "shotgun",
      "playoff"
    ]
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  collection.fields.removeById("select_start_type");

  return app.save(collection);
})
