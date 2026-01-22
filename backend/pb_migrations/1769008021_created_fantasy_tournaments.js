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
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_tournament_name",
        "max": 100,
        "min": 1,
        "name": "tournament_name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number_tournament_number",
        "max": 20,
        "min": 1,
        "name": "tournament_number",
        "onlyInt": true,
        "presentable": false,
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
          "upcoming",
          "live",
          "complete",
          "cancelled"
        ]
      },
      {
        "hidden": false,
        "id": "date_start",
        "max": "",
        "min": "",
        "name": "start_date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "bool_points_calculated",
        "name": "points_calculated",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ],
    "id": "pbc_fantasy_tournaments",
    "indexes": [
      "CREATE INDEX idx_fantasy_tournaments_league ON fantasy_tournaments (league_id)",
      "CREATE UNIQUE INDEX idx_fantasy_tournaments_league_tournament ON fantasy_tournaments (league_id, tournament_id)"
    ],
    "listRule": "",
    "name": "fantasy_tournaments",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_tournaments");
  return app.delete(collection);
})
