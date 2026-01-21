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
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation_user",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "user_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_display_name",
        "max": 100,
        "min": 1,
        "name": "display_name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_message",
        "max": 500,
        "min": 0,
        "name": "message",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
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
          "approved",
          "rejected",
          "cancelled"
        ]
      },
      {
        "hidden": false,
        "id": "date_responded_at",
        "max": "",
        "min": "",
        "name": "responded_at",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_join_requests",
    "indexes": [
      "CREATE INDEX idx_join_requests_league ON join_requests (league_id)",
      "CREATE INDEX idx_join_requests_user ON join_requests (user_id)",
      "CREATE INDEX idx_join_requests_status ON join_requests (status)"
    ],
    "listRule": "",
    "name": "join_requests",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_join_requests");
  return app.delete(collection);
})
