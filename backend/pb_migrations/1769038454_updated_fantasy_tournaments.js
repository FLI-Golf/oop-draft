/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_tournaments")

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "json4066252727",
    "maxSize": 0,
    "name": "draft_order",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_tournaments")

  // remove field
  collection.fields.removeById("json4066252727")

  return app.save(collection)
})
