import type PocketBase from 'pocketbase';

/**
 * Snake draft order for 6 participants over 4 rounds:
 * Round 1: 1, 2, 3, 4, 5, 6
 * Round 2: 6, 5, 4, 3, 2, 1
 * Round 3: 1, 2, 3, 4, 5, 6
 * Round 4: 6, 5, 4, 3, 2, 1
 */
export function getSnakeDraftOrder(
	numParticipants: number,
	numRounds: number
): { round: number; pick: number; position: number }[] {
	const order: { round: number; pick: number; position: number }[] = [];
	let pickNumber = 1;

	for (let round = 1; round <= numRounds; round++) {
		const isEvenRound = round % 2 === 0;

		for (let i = 0; i < numParticipants; i++) {
			const position = isEvenRound ? numParticipants - i : i + 1;

			order.push({
				round,
				pick: pickNumber,
				position
			});
			pickNumber++;
		}
	}

	return order;
}

/**
 * Get the participant who should pick at a given pick number.
 */
export function getParticipantForPick(
	pickNumber: number,
	numParticipants: number
): { round: number; position: number } {
	const round = Math.ceil(pickNumber / numParticipants);
	const pickInRound = ((pickNumber - 1) % numParticipants) + 1;
	const isEvenRound = round % 2 === 0;

	const position = isEvenRound ? numParticipants - pickInRound + 1 : pickInRound;

	return { round, position };
}

/**
 * Check if a pro has already been drafted in a league.
 */
export async function isProDrafted(pb: PocketBase, leagueId: string, proId: string): Promise<boolean> {
	try {
		await pb.collection('draft_picks').getFirstListItem(`league_id="${leagueId}" && pro_id="${proId}"`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get available pros (not yet drafted in this league).
 */
export async function getAvailablePros(pb: PocketBase, leagueId: string): Promise<string[]> {
	// Get all pros
	const allPros = await pb.collection('pros').getFullList({
		filter: 'active=true'
	});

	// Get drafted pros in this league
	const draftedPicks = await pb.collection('draft_picks').getFullList({
		filter: `league_id="${leagueId}"`
	});

	const draftedProIds = new Set(draftedPicks.map((p) => p.pro_id));

	// Return available pro IDs
	return allPros.filter((p) => !draftedProIds.has(p.id)).map((p) => p.id);
}

/**
 * Get current draft state for a league.
 */
export async function getDraftState(
	pb: PocketBase,
	leagueId: string
): Promise<{
	currentPick: number;
	currentRound: number;
	currentParticipantPosition: number;
	totalPicks: number;
	isComplete: boolean;
}> {
	const league = await pb.collection('fantasy_leagues').getOne(leagueId);
	const numParticipants = league.max_participants;
	const numRounds = league.draft_rounds;
	const totalPicks = numParticipants * numRounds;

	// Count picks made
	const picks = await pb.collection('draft_picks').getFullList({
		filter: `league_id="${leagueId}"`
	});

	const currentPick = picks.length + 1;
	const isComplete = currentPick > totalPicks;

	if (isComplete) {
		return {
			currentPick: totalPicks,
			currentRound: numRounds,
			currentParticipantPosition: numParticipants,
			totalPicks,
			isComplete: true
		};
	}

	const { round, position } = getParticipantForPick(currentPick, numParticipants);

	return {
		currentPick,
		currentRound: round,
		currentParticipantPosition: position,
		totalPicks,
		isComplete: false
	};
}

/**
 * Make a draft pick.
 */
export async function makeDraftPick(
	pb: PocketBase,
	leagueId: string,
	participantId: string,
	proId: string,
	autoPicked: boolean = false
): Promise<{ success: boolean; error?: string; pick?: unknown }> {
	// Check if pro already drafted
	if (await isProDrafted(pb, leagueId, proId)) {
		return { success: false, error: 'Pro already drafted' };
	}

	// Get draft state
	const state = await getDraftState(pb, leagueId);

	if (state.isComplete) {
		return { success: false, error: 'Draft is complete' };
	}

	// Verify it's this participant's turn
	const participant = await pb.collection('fantasy_participants').getOne(participantId);
	if (participant.draft_position !== state.currentParticipantPosition) {
		return {
			success: false,
			error: `Not your turn. Expected position ${state.currentParticipantPosition}, got ${participant.draft_position}`
		};
	}

	// Make the pick
	const pick = await pb.collection('draft_picks').create({
		league_id: leagueId,
		participant_id: participantId,
		pro_id: proId,
		round_number: state.currentRound,
		pick_number: state.currentPick,
		auto_picked: autoPicked,
		picked_at: new Date().toISOString()
	});

	return { success: true, pick };
}

/**
 * Auto-pick the best available pro for a participant.
 * Uses pro rating as the ranking criteria.
 */
export async function autoPick(
	pb: PocketBase,
	leagueId: string,
	participantId: string
): Promise<{ success: boolean; error?: string; pick?: unknown }> {
	const availableProIds = await getAvailablePros(pb, leagueId);

	if (availableProIds.length === 0) {
		return { success: false, error: 'No pros available' };
	}

	// Get pros with ratings and pick highest rated
	const pros = await pb.collection('pros').getFullList({
		filter: `id="${availableProIds.join('" || id="')}"`,
		sort: '-rating'
	});

	if (pros.length === 0) {
		return { success: false, error: 'No pros available' };
	}

	const bestPro = pros[0];

	return makeDraftPick(pb, leagueId, participantId, bestPro.id, true);
}
