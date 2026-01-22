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

        // Set draft_order on league (used by all tournaments)
        league.set("draft_order", JSON.stringify(draftOrder));
        console.log(`  Draft order set: ${draftOrder.join(", ")}`);

        // 2b. Get all available pros for draft pool
        const pros = $app.findRecordsByFilter(
            "pros",
            "",
            "name",
            0,
            0
        );
        const allProIds = pros.map(p => p.id);
        console.log(`  ${allProIds.length} pros available for drafts`);

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

            // Set draft_order (array of user_ids in randomized order)
            fantasyTournament.set("draft_order", JSON.stringify(draftOrder));

            // Build participant info map for display names
            const participantInfo = {};
            for (const p of shuffled) {
                participantInfo[p.get("user_id")] = {
                    user_id: p.get("user_id"),
                    display_name: p.get("display_name"),
                    draft_position: p.get("draft_position"),
                    is_owner: p.get("is_owner")
                };
            }

            // Build pro info for the pool
            const proPool = pros.map(p => ({
                id: p.id,
                name: p.get("name"),
                team_id: p.get("pro_team_id"),
                rating: p.get("rating"),
                gender: p.get("gender")
            }));

            // Initialize draft_management with full context
            const draftManagement = {
                status: "waiting",  // waiting | in_progress | paused | complete
                current_round: 1,
                current_pick: 1,
                current_drafter_id: draftOrder[0],
                current_drafter_name: participantInfo[draftOrder[0]].display_name,
                pick_deadline: null,
                snake_direction: 1,  // 1 = forward (1->6), -1 = reverse (6->1)
                settings: {
                    seconds_per_pick: league.get("seconds_per_pick"),
                    total_rounds: league.get("draft_rounds"),
                    total_participants: draftOrder.length,
                    total_picks: league.get("draft_rounds") * draftOrder.length,
                    auto_pick_enabled: league.get("auto_pick_enabled")
                },
                participants: participantInfo,
                available_pros: proPool
            };
            fantasyTournament.set("draft_management", JSON.stringify(draftManagement));

            // Initialize draft_results
            const teams = {};
            for (const userId of draftOrder) {
                teams[userId] = {
                    user_id: userId,
                    display_name: participantInfo[userId].display_name,
                    pros: []  // Will contain {id, name, rating, gender, pick_number, round}
                };
            }
            const draftResults = {
                teams: teams,
                picks: [],  // Will contain {pick_number, round, user_id, user_name, pro_id, pro_name, timestamp}
                completed_at: null
            };
            fantasyTournament.set("draft_results", JSON.stringify(draftResults));

            $app.save(fantasyTournament);
            console.log(`  Created fantasy tournament: ${t.get("name")} (#${tournamentNumber}) with draft initialized`);
        }

        console.log(`League ${leagueId} setup complete!`);
    }

    // Save league updates
    $app.save(league);

}, "fantasy_participants");
