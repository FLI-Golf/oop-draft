/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");

  // JSON field to store invited emails
  collection.fields.push(new Field({
    "hidden": false,
    "id": "json_invited_emails",
    "maxSize": 10000,
    "name": "invited_emails",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");

  collection.fields.removeById("json_invited_emails");

  return app.save(collection);
})
