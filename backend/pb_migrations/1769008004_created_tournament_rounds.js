/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_tournaments",
        "hidden": false,
        "id": "relation_tournament",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "tournament_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number_round",
        "max": 4,
        "min": 1,
        "name": "round_number",
        "onlyInt": true,
        "presentable": true,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select_status",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "pending",
          "in_progress",
          "complete"
        ]
      }
    ],
    "id": "pbc_tournament_rounds",
    "indexes": [
      "CREATE UNIQUE INDEX idx_rounds_tournament_number ON tournament_rounds (tournament_id, round_number)"
    ],
    "listRule": "",
    "name": "tournament_rounds",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_tournament_rounds");
  return app.delete(collection);
})
