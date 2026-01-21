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
        "cascadeDelete": false,
        "collectionId": "pbc_292221920",
        "hidden": false,
        "id": "relation_pro",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "pro_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "number_round",
        "max": 10,
        "min": 1,
        "name": "round_number",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_pick",
        "max": 200,
        "min": 1,
        "name": "pick_number",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "bool_auto_picked",
        "name": "auto_picked",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "date_picked_at",
        "max": "",
        "min": "",
        "name": "picked_at",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_draft_picks",
    "indexes": [
      "CREATE INDEX idx_draft_picks_league ON draft_picks (league_id)",
      "CREATE UNIQUE INDEX idx_draft_picks_league_pro ON draft_picks (league_id, pro_id)",
      "CREATE INDEX idx_draft_picks_participant ON draft_picks (participant_id)"
    ],
    "listRule": "",
    "name": "draft_picks",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_draft_picks");
  return app.delete(collection);
})
