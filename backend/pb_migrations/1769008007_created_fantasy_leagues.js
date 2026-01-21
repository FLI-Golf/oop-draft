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
        "collectionId": "pbc_seasons",
        "hidden": false,
        "id": "relation_season",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "season_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation_owner",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "owner_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
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
          "pending_players",
          "ready",
          "drafting",
          "active",
          "complete"
        ]
      },
      {
        "hidden": false,
        "id": "number_max_participants",
        "max": 20,
        "min": 2,
        "name": "max_participants",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_current_participants",
        "max": 20,
        "min": 0,
        "name": "current_participants",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_draft_rounds",
        "max": 10,
        "min": 1,
        "name": "draft_rounds",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_seconds_per_pick",
        "max": 300,
        "min": 30,
        "name": "seconds_per_pick",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_entry_fee",
        "max": null,
        "min": 0,
        "name": "entry_fee",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
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
      },
      {
        "hidden": false,
        "id": "date_draft_start",
        "max": "",
        "min": "",
        "name": "draft_start_time",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "bool_auto_pick",
        "name": "auto_pick_enabled",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ],
    "id": "pbc_fantasy_leagues",
    "indexes": [
      "CREATE INDEX idx_fantasy_leagues_season ON fantasy_leagues (season_id)",
      "CREATE INDEX idx_fantasy_leagues_owner ON fantasy_leagues (owner_id)",
      "CREATE INDEX idx_fantasy_leagues_status ON fantasy_leagues (status)"
    ],
    "listRule": "",
    "name": "fantasy_leagues",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");
  return app.delete(collection);
})
