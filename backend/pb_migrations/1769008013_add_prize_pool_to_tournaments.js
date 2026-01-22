/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  collection.fields.push(new Field({
    "hidden": false,
    "id": "number_prize_pool",
    "max": null,
    "min": 0,
    "name": "prize_pool",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournaments");

  collection.fields.removeById("number_prize_pool");

  return app.save(collection);
})
