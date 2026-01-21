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

        // Build draft_order array (user_ids in draft order)
        const draftOrder = [];
        
        // Assign positions 1 through N
        for (let i = 0; i < shuffled.length; i++) {
            shuffled[i].set("draft_position", i + 1);
            $app.save(shuffled[i]);
            draftOrder.push(shuffled[i].get("user_id"));
            console.log(`  Assigned draft position ${i + 1} to ${shuffled[i].get("display_name")}`);
        }

        // Set draft_order on league
        league.set("draft_order", JSON.stringify(draftOrder));
        console.log(`  Draft order set: ${draftOrder.join(", ")}`);

        // 2b. Build draft_pool with all available pros
        const pros = $app.findRecordsByFilter(
            "pros",
            "",
            "name",
            0,
            0
        );
        const draftPool = pros.map(p => p.id);
        league.set("draft_pool", JSON.stringify(draftPool));
        console.log(`  Draft pool initialized with ${draftPool.length} pros`);

        // 2c. Initialize empty draft_results
        const draftResults = {};
        for (const userId of draftOrder) {
            draftResults[userId] = [];
        }
        league.set("draft_results", JSON.stringify(draftResults));
        console.log(`  Draft results initialized for ${draftOrder.length} participants`);

        // 3. Create fantasy_tournaments for scheduled tournaments only (not already played)
        const seasonId = league.get("season_id");
        const tournaments = $app.findRecordsByFilter(
            "tournaments",
            `season_id = "${seasonId}" && status = "scheduled"`,
            "start_date",
            0,
            0
        );

        console.log(`Creating ${tournaments.length} fantasy tournaments (scheduled only)...`);

        // Get all season tournaments to determine correct tournament_number
        const allTournaments = $app.findRecordsByFilter(
            "tournaments",
            `season_id = "${seasonId}"`,
            "start_date",
            0,
            0
        );

        // Create a map of tournament_id to its position in the season
        const tournamentPositions = {};
        for (let i = 0; i < allTournaments.length; i++) {
            tournamentPositions[allTournaments[i].id] = i + 1;
        }

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
            
            // Use the tournament's position in the full season, not just among scheduled
            const tournamentNumber = tournamentPositions[t.id];
            
            fantasyTournament.set("league_id", leagueId);
            fantasyTournament.set("tournament_id", t.id);
            fantasyTournament.set("tournament_name", t.get("name"));
            fantasyTournament.set("tournament_number", tournamentNumber);
            fantasyTournament.set("status", "upcoming");
            fantasyTournament.set("start_date", t.get("start_date"));
            fantasyTournament.set("points_calculated", false);

            $app.save(fantasyTournament);
            console.log(`  Created fantasy tournament: ${t.get("name")} (#${tournamentNumber})`);
        }

        console.log(`League ${leagueId} setup complete!`);
    }

    // Save league updates
    $app.save(league);

}, "fantasy_participants");
