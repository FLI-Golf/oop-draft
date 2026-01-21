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
        "cascadeDelete": true,
        "collectionId": "pbc_groups",
        "hidden": false,
        "id": "relation_group",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "group_id",
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
        "id": "number_hole",
        "max": 18,
        "min": 1,
        "name": "hole_number",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_throws",
        "max": 15,
        "min": 1,
        "name": "throws",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "hidden": false,
        "id": "relation_entered_by",
        "maxSelect": 1,
        "minSelect": 1,
        "name": "entered_by_id",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "date_entered_at",
        "max": "",
        "min": "",
        "name": "entered_at",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      }
    ],
    "id": "pbc_hole_score_events",
    "indexes": [
      "CREATE INDEX idx_scores_round_pro ON hole_score_events (round_id, pro_id)",
      "CREATE INDEX idx_scores_group ON hole_score_events (group_id)"
    ],
    "listRule": "",
    "name": "hole_score_events",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_hole_score_events");
  return app.delete(collection);
})
