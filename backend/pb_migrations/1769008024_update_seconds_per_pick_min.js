/// <reference path="../pb_data/types.d.ts" />
// Update seconds_per_pick minimum from 30 to 7 for faster testing
migrate((app) => {
  const collection = app.findCollectionByNameOrId("fantasy_leagues")
  
  const field = collection.fields.find(f => f.name === "seconds_per_pick")
  if (field) {
    field.min = 7
  }
  
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("fantasy_leagues")
  
  const field = collection.fields.find(f => f.name === "seconds_per_pick")
  if (field) {
    field.min = 30
  }
  
  app.save(collection)
})
