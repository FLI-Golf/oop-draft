/// <reference path="../pb_data/types.d.ts" />
// Add draft_order, draft_pool, and draft_results JSON fields to fantasy_leagues
//
// draft_order: Array of participant user_ids in randomized draft order
//   e.g., ["user3_id", "user1_id", "user5_id", "user2_id", "user6_id", "user4_id"]
//
// draft_pool: Array of available pro IDs that can be drafted
//   e.g., ["pro1_id", "pro2_id", ...] - shrinks as pros are picked
//
// draft_results: Object mapping participant user_id to their picked pros
//   e.g., {
//     "user1_id": ["pro5_id", "pro12_id", "pro8_id", "pro22_id"],
//     "user2_id": ["pro3_id", "pro7_id", "pro15_id", "pro19_id"],
//     ...
//   }

migrate((app) => {
  const collection = app.findCollectionByNameOrId("fantasy_leagues")
  
  collection.fields.add(new Field({
    type: "json",
    id: "json_draft_order",
    name: "draft_order",
    maxSize: 10000,
    required: false
  }))

  collection.fields.add(new Field({
    type: "json",
    id: "json_draft_pool",
    name: "draft_pool",
    maxSize: 100000,
    required: false
  }))

  collection.fields.add(new Field({
    type: "json",
    id: "json_draft_results",
    name: "draft_results",
    maxSize: 100000,
    required: false
  }))
  
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("fantasy_leagues")
  
  collection.fields.removeByName("draft_order")
  collection.fields.removeByName("draft_pool")
  collection.fields.removeByName("draft_results")
  
  app.save(collection)
})
