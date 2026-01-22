/// <reference path="../pb_data/types.d.ts" />
// Add draft_management and draft_results to fantasy_tournaments
//
// draft_management: Object tracking draft state
// {
//   "draft_order": ["user1_id", "user2_id", ...],  // Randomized order (from league)
//   "available_pros": ["pro1_id", "pro2_id", ...], // Shrinks as pros are picked
//   "current_round": 1,                            // 1 to draft_rounds
//   "current_pick": 1,                             // 1 to (participants * rounds)
//   "current_drafter_id": "user1_id",              // Whose turn
//   "pick_deadline": "2027-04-03T20:01:30Z",       // When auto-pick triggers
//   "status": "waiting" | "in_progress" | "complete",
//   "snake_direction": 1 | -1                      // 1=forward, -1=reverse
// }
//
// draft_results: Object with participant teams and pick history
// {
//   "teams": {
//     "user1_id": ["pro5_id", "pro12_id", "pro8_id", "pro22_id"],
//     "user2_id": ["pro3_id", "pro7_id", "pro15_id", "pro19_id"],
//     ...
//   },
//   "picks": [
//     {"pick": 1, "round": 1, "user_id": "user1_id", "pro_id": "pro5_id", "timestamp": "..."},
//     {"pick": 2, "round": 1, "user_id": "user2_id", "pro_id": "pro3_id", "timestamp": "..."},
//     ...
//   ]
// }

migrate((app) => {
  const collection = app.findCollectionByNameOrId("fantasy_tournaments")
  
  collection.fields.add(new Field({
    type: "json",
    id: "json_draft_management",
    name: "draft_management",
    maxSize: 200000,
    required: false
  }))

  collection.fields.add(new Field({
    type: "json",
    id: "json_draft_results",
    name: "draft_results",
    maxSize: 200000,
    required: false
  }))
  
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("fantasy_tournaments")
  
  collection.fields.removeByName("draft_management")
  collection.fields.removeByName("draft_results")
  
  app.save(collection)
})
