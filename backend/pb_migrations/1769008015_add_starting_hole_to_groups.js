/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");

  collection.fields.push(new Field({
    "hidden": false,
    "id": "number_starting_hole",
    "max": 18,
    "min": 1,
    "name": "starting_hole",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");

  collection.fields.removeById("number_starting_hole");

  return app.save(collection);
})
