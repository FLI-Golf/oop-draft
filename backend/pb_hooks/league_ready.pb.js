/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook: When a fantasy_participant is created, check if league is now 6/6.
 * If so:
 * 1. Update league status to 'ready'
 * 2. Assign random draft positions to all participants
 * 3. Create fantasy_tournaments for all season tournaments
 */
onRecordAfterCreateSuccess((e) => {
    const participant = e.record;
    const leagueId = participant.get("league_id");

    // Get the league
    const league = $app.findRecordById("fantasy_leagues", leagueId);
    if (!league) {
        console.log("League not found:", leagueId);
        return;
    }

    // Count current participants
    const participants = $app.findRecordsByFilter(
        "fantasy_participants",
        `league_id = "${leagueId}"`,
        "",
        0,
        0
    );

    const participantCount = participants.length;
    const maxParticipants = league.get("max_participants");

    console.log(`League ${leagueId}: ${participantCount}/${maxParticipants} participants`);

    // Update participant count on league
    league.set("current_participants", participantCount);

    // Check if league is now full
    if (participantCount >= maxParticipants && league.get("status") === "pending_players") {
        console.log(`League ${leagueId} is now full! Setting up...`);

        // 1. Update league status to 'ready'
        league.set("status", "ready");

        // 2. Assign random draft positions
        // Shuffle participants using Fisher-Yates
        const shuffled = [...participants];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Assign positions 1 through N
        for (let i = 0; i < shuffled.length; i++) {
            shuffled[i].set("draft_position", i + 1);
            $app.save(shuffled[i]);
            console.log(`  Assigned draft position ${i + 1} to ${shuffled[i].get("display_name")}`);
        }

        // 3. Create fantasy_tournaments for all season tournaments
        const seasonId = league.get("season_id");
        const tournaments = $app.findRecordsByFilter(
            "tournaments",
            `season_id = "${seasonId}"`,
            "start_date",
            0,
            0
        );

        console.log(`Creating ${tournaments.length} fantasy tournaments...`);

        for (let i = 0; i < tournaments.length; i++) {
            const t = tournaments[i];
            
            // Check if fantasy_tournament already exists
            const existing = $app.findRecordsByFilter(
                "fantasy_tournaments",
                `league_id = "${leagueId}" && tournament_id = "${t.id}"`,
                "",
                1,
                0
            );

            if (existing.length > 0) {
                console.log(`  Fantasy tournament for ${t.get("name")} already exists, skipping`);
                continue;
            }

            const collection = $app.findCollectionByNameOrId("fantasy_tournaments");
            const fantasyTournament = new Record(collection);
            
            fantasyTournament.set("league_id", leagueId);
            fantasyTournament.set("tournament_id", t.id);
            fantasyTournament.set("tournament_name", t.get("name"));
            fantasyTournament.set("tournament_number", i + 1);
            fantasyTournament.set("status", "upcoming");
            fantasyTournament.set("start_date", t.get("start_date"));
            fantasyTournament.set("points_calculated", false);

            $app.save(fantasyTournament);
            console.log(`  Created fantasy tournament: ${t.get("name")} (#${i + 1})`);
        }

        console.log(`League ${leagueId} setup complete!`);
    }

    // Save league updates
    $app.save(league);

}, "fantasy_participants");
