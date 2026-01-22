/// <reference path="../pb_data/types.d.ts" />
// Add total_fantasy_points to user_profiles
// This is the cumulative spendable points earned from fantasy league placements

migrate((app) => {
    const collection = app.findCollectionByNameOrId("user_profiles");

    collection.fields.add(new Field({
        type: "number",
        name: "total_fantasy_points",
        required: false,
        options: {
            min: 0,
            onlyInt: true
        }
    }));

    app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("user_profiles");
    collection.fields.removeByName("total_fantasy_points");
    app.save(collection);
});
