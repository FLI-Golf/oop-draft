/// <reference path="../pb_data/types.d.ts" />
// Fantasy tournament results - tracks each user's fantasy team performance per tournament

migrate((app) => {
    const collection = new Collection({
        "name": "fantasy_tournament_results",
        "type": "base",
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "updateRule": "",
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
                "collectionId": "pbc_fantasy_tournaments",
                "hidden": false,
                "id": "relation_fantasy_tournament",
                "maxSelect": 1,
                "minSelect": 1,
                "name": "fantasy_tournament_id",
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
                "hidden": false,
                "id": "number_team_score",
                "max": 200,
                "min": -100,
                "name": "team_score",
                "onlyInt": false,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "hidden": false,
                "id": "number_rank",
                "max": 6,
                "min": 1,
                "name": "rank",
                "onlyInt": true,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "hidden": false,
                "id": "number_points_earned",
                "max": 100,
                "min": 0,
                "name": "points_earned",
                "onlyInt": true,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "hidden": false,
                "id": "json_pro_scores",
                "maxSize": 10000,
                "name": "pro_scores",
                "presentable": false,
                "required": false,
                "system": false,
                "type": "json"
            }
        ],
        "indexes": [
            "CREATE INDEX idx_fantasy_results_tournament ON fantasy_tournament_results (fantasy_tournament_id)",
            "CREATE INDEX idx_fantasy_results_user ON fantasy_tournament_results (user_id)",
            "CREATE UNIQUE INDEX idx_fantasy_results_unique ON fantasy_tournament_results (fantasy_tournament_id, user_id)"
        ]
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("fantasy_tournament_results");
    return app.delete(collection);
});
