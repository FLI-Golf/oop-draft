/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");

  // Payment method: stripe or other
  collection.fields.push(new Field({
    "hidden": false,
    "id": "select_payment_method",
    "maxSelect": 1,
    "name": "payment_method",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "stripe",
      "other"
    ]
  }));

  // Payment status
  collection.fields.push(new Field({
    "hidden": false,
    "id": "select_payment_status",
    "maxSelect": 1,
    "name": "payment_status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "pending",
      "paid"
    ]
  }));

  // Stripe payment intent ID (for tracking)
  collection.fields.push(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_stripe_payment_id",
    "max": 255,
    "min": 0,
    "name": "stripe_payment_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_fantasy_leagues");

  collection.fields.removeById("select_payment_method");
  collection.fields.removeById("select_payment_status");
  collection.fields.removeById("text_stripe_payment_id");

  return app.save(collection);
})
