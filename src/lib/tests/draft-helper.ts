import type PocketBase from 'pocketbase';

// Team composition requirements
const REQUIRED_MALE = 2;
const REQUIRED_FEMALE = 2;
const TOTAL_ROSTER_SIZE = REQUIRED_MALE + REQUIRED_FEMALE;

export interface RosterComposition {
	maleCount: number;
	femaleCount: number;
	needsMale: boolean;
	needsFemale: boolean;
	maleNeeded: number;
	femaleNeeded: number;
	isComplete: boolean;
}

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
 * Get a participant's current roster composition (male/female counts).
 */
export async function getParticipantRoster(
	pb: PocketBase,
	leagueId: string,
	participantId: string
): Promise<RosterComposition> {
	// Get all picks by this participant
	const picks = await pb.collection('draft_picks').getFullList({
		filter: `league_id="${leagueId}" && participant_id="${participantId}"`
	});

	if (picks.length === 0) {
		return {
			maleCount: 0,
			femaleCount: 0,
			needsMale: true,
			needsFemale: true,
			maleNeeded: REQUIRED_MALE,
			femaleNeeded: REQUIRED_FEMALE,
			isComplete: false
		};
	}

	// Get the pros to check gender
	const proIds = picks.map((p) => p.pro_id);
	const pros = await pb.collection('pros').getFullList({
		filter: proIds.map((id) => `id="${id}"`).join(' || ')
	});

	const maleCount = pros.filter((p) => p.gender === 'male').length;
	const femaleCount = pros.filter((p) => p.gender === 'female').length;

	const maleNeeded = Math.max(0, REQUIRED_MALE - maleCount);
	const femaleNeeded = Math.max(0, REQUIRED_FEMALE - femaleCount);

	return {
		maleCount,
		femaleCount,
		needsMale: maleNeeded > 0,
		needsFemale: femaleNeeded > 0,
		maleNeeded,
		femaleNeeded,
		isComplete: maleCount >= REQUIRED_MALE && femaleCount >= REQUIRED_FEMALE
	};
}

/**
 * Get available pros (not yet drafted in this league).
 * Optionally filter by gender based on participant's roster needs.
 */
export async function getAvailablePros(
	pb: PocketBase,
	leagueId: string,
	participantId?: string
): Promise<{ id: string; name: string; gender: string; rating: number }[]> {
	// Get all active pros
	const allPros = await pb.collection('pros').getFullList({
		filter: 'active=true',
		sort: '-rating'
	});

	// Get drafted pros in this league
	const draftedPicks = await pb.collection('draft_picks').getFullList({
		filter: `league_id="${leagueId}"`
	});

	const draftedProIds = new Set(draftedPicks.map((p) => p.pro_id));

	// Filter out drafted pros
	let available = allPros.filter((p) => !draftedProIds.has(p.id));

	// If participantId provided, filter by composition needs
	if (participantId) {
		const roster = await getParticipantRoster(pb, leagueId, participantId);

		// Calculate picks remaining for this participant
		const picksRemaining = TOTAL_ROSTER_SIZE - (roster.maleCount + roster.femaleCount);

		// If we MUST pick a specific gender to complete roster, filter
		if (picksRemaining === roster.maleNeeded && roster.maleNeeded > 0) {
			// Must pick male - only males remaining picks needed
			available = available.filter((p) => p.gender === 'male');
		} else if (picksRemaining === roster.femaleNeeded && roster.femaleNeeded > 0) {
			// Must pick female - only females remaining picks needed
			available = available.filter((p) => p.gender === 'female');
		}
		// Otherwise, can pick either gender (still have flexibility)
	}

	return available.map((p) => ({
		id: p.id,
		name: p.name,
		gender: p.gender,
		rating: p.rating
	}));
}

/**
 * Get available pros filtered by gender.
 */
export async function getAvailableProsByGender(
	pb: PocketBase,
	leagueId: string,
	gender: 'male' | 'female'
): Promise<{ id: string; name: string; gender: string; rating: number }[]> {
	const available = await getAvailablePros(pb, leagueId);
	return available.filter((p) => p.gender === gender);
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
 * Validates: pro not drafted, correct turn, and composition rules.
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

	// Check composition rules
	const roster = await getParticipantRoster(pb, leagueId, participantId);
	const pro = await pb.collection('pros').getOne(proId);
	const proGender = pro.gender;

	// Calculate picks remaining
	const picksRemaining = TOTAL_ROSTER_SIZE - (roster.maleCount + roster.femaleCount);

	// Validate gender selection based on remaining picks
	if (proGender === 'male' && roster.maleCount >= REQUIRED_MALE) {
		return { success: false, error: 'Already have 2 male pros. Must pick female.' };
	}
	if (proGender === 'female' && roster.femaleCount >= REQUIRED_FEMALE) {
		return { success: false, error: 'Already have 2 female pros. Must pick male.' };
	}

	// Check if this pick would make it impossible to complete roster
	if (picksRemaining > 1) {
		// Not the last pick, check if we'd lock ourselves out
		if (proGender === 'male') {
			const newMaleCount = roster.maleCount + 1;
			const remainingAfter = picksRemaining - 1;
			const femaleStillNeeded = REQUIRED_FEMALE - roster.femaleCount;
			if (remainingAfter < femaleStillNeeded) {
				return { success: false, error: `Must pick female. Only ${remainingAfter} picks left and need ${femaleStillNeeded} female.` };
			}
		} else {
			const newFemaleCount = roster.femaleCount + 1;
			const remainingAfter = picksRemaining - 1;
			const maleStillNeeded = REQUIRED_MALE - roster.maleCount;
			if (remainingAfter < maleStillNeeded) {
				return { success: false, error: `Must pick male. Only ${remainingAfter} picks left and need ${maleStillNeeded} male.` };
			}
		}
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
 * Respects team composition (2 male, 2 female).
 * Uses pro rating as the ranking criteria.
 */
export async function autoPick(
	pb: PocketBase,
	leagueId: string,
	participantId: string
): Promise<{ success: boolean; error?: string; pick?: unknown; recommendation?: string }> {
	// Get roster composition to determine what's needed
	const roster = await getParticipantRoster(pb, leagueId, participantId);

	// Get available pros (already filtered by composition needs)
	const available = await getAvailablePros(pb, leagueId, participantId);

	if (available.length === 0) {
		return { success: false, error: 'No pros available' };
	}

	// Best pro is first (already sorted by rating)
	const bestPro = available[0];

	// Generate recommendation message
	let recommendation = `Auto-picked ${bestPro.name} (${bestPro.gender}, rating: ${bestPro.rating})`;
	if (roster.maleNeeded > 0 && roster.femaleNeeded > 0) {
		recommendation += ` - Need ${roster.maleNeeded} more male, ${roster.femaleNeeded} more female`;
	} else if (roster.maleNeeded > 0) {
		recommendation += ` - Need ${roster.maleNeeded} more male`;
	} else if (roster.femaleNeeded > 0) {
		recommendation += ` - Need ${roster.femaleNeeded} more female`;
	}

	const result = await makeDraftPick(pb, leagueId, participantId, bestPro.id, true);

	return { ...result, recommendation };
}

/**
 * Get draft recommendation for a participant (without making the pick).
 */
export async function getDraftRecommendation(
	pb: PocketBase,
	leagueId: string,
	participantId: string
): Promise<{
	recommendedPro: { id: string; name: string; gender: string; rating: number } | null;
	roster: RosterComposition;
	availableMale: number;
	availableFemale: number;
	mustPickGender: 'male' | 'female' | null;
}> {
	const roster = await getParticipantRoster(pb, leagueId, participantId);
	const available = await getAvailablePros(pb, leagueId, participantId);
	const allAvailable = await getAvailablePros(pb, leagueId);

	const availableMale = allAvailable.filter((p) => p.gender === 'male').length;
	const availableFemale = allAvailable.filter((p) => p.gender === 'female').length;

	// Determine if must pick specific gender
	const picksRemaining = TOTAL_ROSTER_SIZE - (roster.maleCount + roster.femaleCount);
	let mustPickGender: 'male' | 'female' | null = null;

	if (picksRemaining === roster.maleNeeded && roster.maleNeeded > 0) {
		mustPickGender = 'male';
	} else if (picksRemaining === roster.femaleNeeded && roster.femaleNeeded > 0) {
		mustPickGender = 'female';
	}

	return {
		recommendedPro: available.length > 0 ? available[0] : null,
		roster,
		availableMale,
		availableFemale,
		mustPickGender
	};
}
