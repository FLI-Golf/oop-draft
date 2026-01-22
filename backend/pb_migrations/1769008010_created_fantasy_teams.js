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
        "collectionId": "pbc_fantasy_participants",
        "hidden": false,
        "id": "relation_participant",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "participant_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_fantasy_leagues",
        "hidden": false,
        "id": "relation_league",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "league_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_name",
        "max": 100,
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
        "collectionId": "pbc_292221920",
        "hidden": false,
        "id": "relation_pros",
        "maxSelect": 10,
        "minSelect": 0,
        "name": "pro_ids",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_fantasy_teams",
    "indexes": [
      "CREATE UNIQUE INDEX idx_fantasy_teams_participant ON fantasy_teams (participant_id)",
      "CREATE INDEX idx_fantasy_teams_league ON fantasy_teams (league_id)"
    ],
    "listRule": "",
    "name": "fantasy_teams",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_teams");
  return app.delete(collection);
})
