/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_holes");

  collection.fields.push(new Field({
    "hidden": false,
    "id": "number_distance",
    "max": 1000,
    "min": 50,
    "name": "distance",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_holes");

  collection.fields.removeById("number_distance");

  return app.save(collection);
})
