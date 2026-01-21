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
        "id": "text1579384326",
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
        "hidden": false,
        "id": "select3343321666",
        "maxSelect": 1,
        "name": "gender",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "male",
          "female"
        ]
      },
      {
        "hidden": false,
        "id": "number1878857607",
        "max": null,
        "min": 1,
        "name": "world_ranking",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number3632866850",
        "max": 1100,
        "min": 0,
        "name": "rating",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "bool1260321794",
        "name": "active",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "cascadeDelete": false,
        "collectionId": "pbc_1278407781",
        "hidden": false,
        "id": "relation3703905909",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "pro_team_id",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_292221920",
    "indexes": [
      "CREATE INDEX idx_pros_gender ON pros (gender)",
      "CREATE INDEX idx_pros_team ON pros (pro_team_id)"
    ],
    "listRule": "",
    "name": "pros",
    "system": false,
    "type": "base",
    "updateRule": "",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_292221920");

  return app.delete(collection);
})
