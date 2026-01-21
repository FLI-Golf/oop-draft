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
        "cascadeDelete": true,
        "collectionId": "pbc_tournament_rounds",
        "hidden": false,
        "id": "relation_round",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "round_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_name",
        "max": 50,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1278407781",
        "hidden": false,
        "id": "relation_teams",
        "maxSelect": 4,
        "minSelect": 1,
        "name": "team_ids",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation_scorekeeper",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "scorekeeper_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "date_tee_time",
        "max": "",
        "min": "",
        "name": "tee_time",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_groups",
    "indexes": [
      "CREATE INDEX idx_groups_round ON groups (round_id)"
    ],
    "listRule": "",
    "name": "groups",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_groups");
  return app.delete(collection);
})
