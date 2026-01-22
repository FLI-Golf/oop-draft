/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_seasons");

  collection.fields.push(new Field({
    "hidden": false,
    "id": "number_yearly_pot",
    "max": null,
    "min": 0,
    "name": "yearly_pot",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_seasons");

  collection.fields.removeById("number_yearly_pot");

  return app.save(collection);
})
