/// <reference path="../pb_data/types.d.ts" />
// Pro tournament scores - tracks each pro's performance in each tournament

migrate((app) => {
    const collection = new Collection({
        "name": "pro_tournament_scores",
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
                "id": "number_score",
                "max": 50,
                "min": -30,
                "name": "score",
                "onlyInt": false,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_position",
                "max": 10,
                "min": 0,
                "name": "position",
                "pattern": "",
                "presentable": false,
                "primaryKey": false,
                "required": false,
                "system": false,
                "type": "text"
            },
            {
                "hidden": false,
                "id": "number_thru",
                "max": 72,
                "min": 0,
                "name": "thru",
                "onlyInt": true,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "hidden": false,
                "id": "number_strokes",
                "max": null,
                "min": 0,
                "name": "strokes",
                "onlyInt": true,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "hidden": false,
                "id": "json_round_scores",
                "maxSize": 1000,
                "name": "round_scores",
                "presentable": false,
                "required": false,
                "system": false,
                "type": "json"
            }
        ],
        "indexes": [
            "CREATE INDEX idx_pro_tournament_scores_tournament ON pro_tournament_scores (tournament_id)",
            "CREATE INDEX idx_pro_tournament_scores_pro ON pro_tournament_scores (pro_id)",
            "CREATE UNIQUE INDEX idx_pro_tournament_scores_unique ON pro_tournament_scores (tournament_id, pro_id)"
        ]
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pro_tournament_scores");
    return app.delete(collection);
});
