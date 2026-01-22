/// <reference path="../pb_data/types.d.ts" />
// Remove draft_pool and draft_results from fantasy_leagues
// Keep draft_order as it's set once when league fills and used by all tournaments

migrate((app) => {
  const collection = app.findCollectionByNameOrId("fantasy_leagues")
  
  collection.fields.removeByName("draft_pool")
  collection.fields.removeByName("draft_results")
  
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("fantasy_leagues")
  
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
})
