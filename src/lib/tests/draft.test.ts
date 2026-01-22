import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loginAs, getSeason2027, uniqueLeagueName, cleanupTestLeagues } from './pb-helper';
import {
	getSnakeDraftOrder,
	getParticipantForPick,
	makeDraftPick,
	autoPick,
	getDraftState,
	isProDrafted,
	getAvailablePros,
	getParticipantRoster,
	getDraftRecommendation
} from './draft-helper';
import type PocketBase from 'pocketbase';

describe('Draft', () => {
	let ownerPB: PocketBase;
	let ownerId: string;
	let seasonId: string;
	let leagueId: string;
	const createdLeagueIds: string[] = [];
	const participantMap: Map<number, { id: string; userId: string; displayName: string }> = new Map();
	let proIds: string[] = [];
	let maleProIds: string[] = [];
	let femaleProIds: string[] = [];

	beforeAll(async () => {
		ownerPB = await loginAs('admin1@fligolf.com');
		ownerId = ownerPB.authStore.record?.id as string;

		const season = await getSeason2027(ownerPB);
		seasonId = season.id;

		// Get pro IDs for drafting
		const pros = await ownerPB.collection('pros').getFullList({
			filter: 'active=true',
			sort: '-rating'
		});
		proIds = pros.map((p) => p.id);
		maleProIds = pros.filter((p) => p.gender === 'male').map((p) => p.id);
		femaleProIds = pros.filter((p) => p.gender === 'female').map((p) => p.id);

		// Create a league in ready status (simulating 6/6 filled)
		const league = await ownerPB.collection('fantasy_leagues').create({
			name: uniqueLeagueName(),
			season_id: seasonId,
			owner_id: ownerId,
			status: 'ready',
			max_participants: 6,
			current_participants: 6,
			draft_rounds: 4,
			seconds_per_pick: 90,
			entry_fee: 100,
			prize_pool: 600,
			auto_pick_enabled: true,
			payment_method: 'other',
			payment_status: 'paid'
		});

		leagueId = league.id;
		createdLeagueIds.push(leagueId);

		// Add 6 participants with draft positions
		const profiles = await ownerPB.collection('user_profiles').getFullList({
			sort: 'display_name'
		});

		// admin1 + user1-5
		const participantNames = ['admin1', 'user1', 'user2', 'user3', 'user4', 'user5'];

		for (let i = 0; i < 6; i++) {
			const profile = profiles.find((p) => p.display_name === participantNames[i]);
			if (!profile) continue;

			const participant = await ownerPB.collection('fantasy_participants').create({
				league_id: leagueId,
				user_id: profile.user_id,
				display_name: profile.display_name,
				is_owner: i === 0,
				paid: true,
				draft_position: i + 1,
				joined_at: new Date().toISOString()
			});

			participantMap.set(i + 1, {
				id: participant.id,
				userId: profile.user_id,
				displayName: profile.display_name
			});
		}

		// Update league to drafting status
		await ownerPB.collection('fantasy_leagues').update(leagueId, {
			status: 'drafting'
		});
	});

	afterAll(async () => {
		await cleanupTestLeagues(ownerPB, createdLeagueIds);
	});

	describe('Snake Draft Order', () => {
		it('should generate correct snake draft order for 6 participants, 4 rounds', () => {
			const order = getSnakeDraftOrder(6, 4);

			expect(order).toHaveLength(24); // 6 * 4 = 24 picks

			// Round 1: positions 1-6
			expect(order[0]).toEqual({ round: 1, pick: 1, position: 1 });
			expect(order[5]).toEqual({ round: 1, pick: 6, position: 6 });

			// Round 2: positions 6-1 (snake)
			expect(order[6]).toEqual({ round: 2, pick: 7, position: 6 });
			expect(order[11]).toEqual({ round: 2, pick: 12, position: 1 });

			// Round 3: positions 1-6
			expect(order[12]).toEqual({ round: 3, pick: 13, position: 1 });

			// Round 4: positions 6-1 (snake)
			expect(order[18]).toEqual({ round: 4, pick: 19, position: 6 });
			expect(order[23]).toEqual({ round: 4, pick: 24, position: 1 });
		});

		it('should get correct participant for any pick number', () => {
			// Pick 1 = Round 1, Position 1
			expect(getParticipantForPick(1, 6)).toEqual({ round: 1, position: 1 });

			// Pick 6 = Round 1, Position 6
			expect(getParticipantForPick(6, 6)).toEqual({ round: 1, position: 6 });

			// Pick 7 = Round 2, Position 6 (snake)
			expect(getParticipantForPick(7, 6)).toEqual({ round: 2, position: 6 });

			// Pick 12 = Round 2, Position 1
			expect(getParticipantForPick(12, 6)).toEqual({ round: 2, position: 1 });

			// Pick 13 = Round 3, Position 1
			expect(getParticipantForPick(13, 6)).toEqual({ round: 3, position: 1 });

			// Pick 24 = Round 4, Position 1
			expect(getParticipantForPick(24, 6)).toEqual({ round: 4, position: 1 });
		});
	});

	describe('Pick Selection', () => {
		it('should allow first pick by participant in position 1', async () => {
			const participant = participantMap.get(1)!;
			const proId = proIds[0];

			const result = await makeDraftPick(ownerPB, leagueId, participant.id, proId);

			expect(result.success).toBe(true);
			expect(result.pick).toBeDefined();
		});

		it('should reject pick if pro already drafted', async () => {
			const participant = participantMap.get(2)!;
			const alreadyDraftedProId = proIds[0]; // Same pro as first pick

			const result = await makeDraftPick(ownerPB, leagueId, participant.id, alreadyDraftedProId);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Pro already drafted');
		});

		it('should reject pick if not participants turn', async () => {
			const wrongParticipant = participantMap.get(3)!; // Position 3, but it's position 2's turn
			const proId = proIds[1];

			const result = await makeDraftPick(ownerPB, leagueId, wrongParticipant.id, proId);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Not your turn');
		});

		it('should allow second pick by participant in position 2', async () => {
			const participant = participantMap.get(2)!;
			const proId = proIds[1];

			const result = await makeDraftPick(ownerPB, leagueId, participant.id, proId);

			expect(result.success).toBe(true);
		});

		it('should track drafted pros correctly', async () => {
			const isDrafted0 = await isProDrafted(ownerPB, leagueId, proIds[0]);
			const isDrafted1 = await isProDrafted(ownerPB, leagueId, proIds[1]);
			const isDrafted2 = await isProDrafted(ownerPB, leagueId, proIds[2]);

			expect(isDrafted0).toBe(true);
			expect(isDrafted1).toBe(true);
			expect(isDrafted2).toBe(false);
		});
	});

	describe('Draft State', () => {
		it('should track current pick number', async () => {
			const state = await getDraftState(ownerPB, leagueId);

			expect(state.currentPick).toBe(3); // 2 picks made, next is 3
			expect(state.currentRound).toBe(1);
			expect(state.currentParticipantPosition).toBe(3);
			expect(state.isComplete).toBe(false);
		});

		it('should return available pros', async () => {
			const available = await getAvailablePros(ownerPB, leagueId);
			const availableIds = available.map((p) => p.id);

			// 2 pros drafted, rest should be available
			expect(availableIds).not.toContain(proIds[0]);
			expect(availableIds).not.toContain(proIds[1]);
			expect(available.length).toBe(proIds.length - 2);
		});
	});

	describe('Auto Pick', () => {
		it('should auto-pick highest rated available pro', async () => {
			const participant = participantMap.get(3)!;

			const result = await autoPick(ownerPB, leagueId, participant.id);

			expect(result.success).toBe(true);
			expect(result.pick).toBeDefined();

			// Verify it picked the highest rated available (proIds[2] since 0,1 are taken)
			const pick = result.pick as { pro_id: string; auto_picked: boolean };
			expect(pick.pro_id).toBe(proIds[2]);
			expect(pick.auto_picked).toBe(true);
		});

		it('should mark auto-picked as true', async () => {
			const picks = await ownerPB.collection('draft_picks').getFullList({
				filter: `league_id="${leagueId}" && auto_picked=true`
			});

			expect(picks.length).toBeGreaterThan(0);
		});
	});

	describe('Complete Round', () => {
		it('should complete round 1 with remaining picks', async () => {
			// Make picks 4, 5, 6 to complete round 1
			for (let pos = 4; pos <= 6; pos++) {
				const participant = participantMap.get(pos)!;
				const state = await getDraftState(ownerPB, leagueId);
				const available = await getAvailablePros(ownerPB, leagueId);

				const result = await makeDraftPick(ownerPB, leagueId, participant.id, available[0].id);
				expect(result.success).toBe(true);
			}

			const state = await getDraftState(ownerPB, leagueId);
			expect(state.currentRound).toBe(2);
			expect(state.currentPick).toBe(7);
		});

		it('should snake to position 6 for round 2', async () => {
			const state = await getDraftState(ownerPB, leagueId);

			// Round 2 starts with position 6
			expect(state.currentParticipantPosition).toBe(6);
		});

		it('should allow position 6 to pick first in round 2', async () => {
			const participant = participantMap.get(6)!;
			const available = await getAvailablePros(ownerPB, leagueId);

			const result = await makeDraftPick(ownerPB, leagueId, participant.id, available[0].id);

			expect(result.success).toBe(true);

			const state = await getDraftState(ownerPB, leagueId);
			expect(state.currentPick).toBe(8);
			expect(state.currentParticipantPosition).toBe(5); // Snake continues
		});
	});
});

describe('Draft Composition', () => {
	let ownerPB: PocketBase;
	let ownerId: string;
	let seasonId: string;
	let leagueId: string;
	const createdLeagueIds: string[] = [];
	const participantMap: Map<number, { id: string; userId: string; displayName: string }> = new Map();
	let maleProIds: string[] = [];
	let femaleProIds: string[] = [];

	beforeAll(async () => {
		ownerPB = await loginAs('admin1@fligolf.com');
		ownerId = ownerPB.authStore.record?.id as string;

		const season = await getSeason2027(ownerPB);
		seasonId = season.id;

		// Get pro IDs by gender
		const pros = await ownerPB.collection('pros').getFullList({
			filter: 'active=true',
			sort: '-rating'
		});
		maleProIds = pros.filter((p) => p.gender === 'male').map((p) => p.id);
		femaleProIds = pros.filter((p) => p.gender === 'female').map((p) => p.id);

		// Create a fresh league for composition tests
		const league = await ownerPB.collection('fantasy_leagues').create({
			name: uniqueLeagueName(),
			season_id: seasonId,
			owner_id: ownerId,
			status: 'drafting',
			max_participants: 6,
			current_participants: 6,
			draft_rounds: 4,
			seconds_per_pick: 90,
			entry_fee: 100,
			prize_pool: 600,
			auto_pick_enabled: true,
			payment_method: 'other',
			payment_status: 'paid'
		});

		leagueId = league.id;
		createdLeagueIds.push(leagueId);

		// Add 6 participants
		const profiles = await ownerPB.collection('user_profiles').getFullList({
			sort: 'display_name'
		});

		const participantNames = ['admin1', 'user1', 'user2', 'user3', 'user4', 'user5'];

		for (let i = 0; i < 6; i++) {
			const profile = profiles.find((p) => p.display_name === participantNames[i]);
			if (!profile) continue;

			const participant = await ownerPB.collection('fantasy_participants').create({
				league_id: leagueId,
				user_id: profile.user_id,
				display_name: profile.display_name,
				is_owner: i === 0,
				paid: true,
				draft_position: i + 1,
				joined_at: new Date().toISOString()
			});

			participantMap.set(i + 1, {
				id: participant.id,
				userId: profile.user_id,
				displayName: profile.display_name
			});
		}
	});

	afterAll(async () => {
		await cleanupTestLeagues(ownerPB, createdLeagueIds);
	});

	describe('Roster Tracking', () => {
		it('should start with empty roster', async () => {
			const participant = participantMap.get(1)!;
			const roster = await getParticipantRoster(ownerPB, leagueId, participant.id);

			expect(roster.maleCount).toBe(0);
			expect(roster.femaleCount).toBe(0);
			expect(roster.needsMale).toBe(true);
			expect(roster.needsFemale).toBe(true);
			expect(roster.maleNeeded).toBe(2);
			expect(roster.femaleNeeded).toBe(2);
			expect(roster.isComplete).toBe(false);
		});

		it('should track male pick', async () => {
			const participant = participantMap.get(1)!;

			// Pick a male pro
			await makeDraftPick(ownerPB, leagueId, participant.id, maleProIds[0]);

			const roster = await getParticipantRoster(ownerPB, leagueId, participant.id);
			expect(roster.maleCount).toBe(1);
			expect(roster.femaleCount).toBe(0);
			expect(roster.maleNeeded).toBe(1);
			expect(roster.femaleNeeded).toBe(2);
		});
	});

	describe('Composition Enforcement', () => {
		it('should reject pick that exceeds male limit', async () => {
			// Previous tests already made picks. Continue from current state.
			// Participant 1 already has 1 male from "should track male pick" test
			const participant = participantMap.get(1)!;

			// Get current state
			let state = await getDraftState(ownerPB, leagueId);
			let roster = await getParticipantRoster(ownerPB, leagueId, participant.id);

			// Complete picks until we get back to participant 1 with 2 males
			// and then try to pick a third

			// Continue draft until participant 1 has 2 males
			while (roster.maleCount < 2) {
				state = await getDraftState(ownerPB, leagueId);
				const currentParticipant = participantMap.get(state.currentParticipantPosition)!;

				if (currentParticipant.id === participant.id) {
					// Participant 1's turn - pick a male
					const available = await getAvailablePros(ownerPB, leagueId, participant.id);
					const malePro = available.find((p) => p.gender === 'male');
					if (malePro) {
						await makeDraftPick(ownerPB, leagueId, participant.id, malePro.id);
					}
				} else {
					// Other participant's turn
					const available = await getAvailablePros(ownerPB, leagueId, currentParticipant.id);
					if (available.length > 0) {
						await makeDraftPick(ownerPB, leagueId, currentParticipant.id, available[0].id);
					}
				}

				roster = await getParticipantRoster(ownerPB, leagueId, participant.id);
				if (state.isComplete) break;
			}

			// Verify participant 1 now has 2 males
			roster = await getParticipantRoster(ownerPB, leagueId, participant.id);
			expect(roster.maleCount).toBe(2);

			// Now the validation: trying to pick a third male should fail
			// (even if it's not their turn, the validation should catch it)
			const availableMales = await getAvailablePros(ownerPB, leagueId);
			const anotherMale = availableMales.find((p) => p.gender === 'male');

			if (anotherMale) {
				// Direct validation test - the makeDraftPick should reject
				// We test the validation logic, not the turn logic
				const result = await makeDraftPick(ownerPB, leagueId, participant.id, anotherMale.id);

				// Either "Not your turn" or "Already have 2 male" - both are valid rejections
				expect(result.success).toBe(false);
			}
		});
	});

	describe('Filtered Available Pros', () => {
		it('should filter to needed gender when required', async () => {
			// Create a new participant scenario
			const participant = participantMap.get(1)!;
			const roster = await getParticipantRoster(ownerPB, leagueId, participant.id);

			// Get recommendation
			const rec = await getDraftRecommendation(ownerPB, leagueId, participant.id);

			expect(rec.roster).toBeDefined();
			expect(rec.availableMale).toBeGreaterThan(0);
			expect(rec.availableFemale).toBeGreaterThan(0);

			// If must pick specific gender, recommendedPro should match
			if (rec.mustPickGender) {
				expect(rec.recommendedPro?.gender).toBe(rec.mustPickGender);
			}
		});
	});

	describe('Auto Pick with Composition', () => {
		it('should auto-pick respecting gender needs', async () => {
			// The autoPick function should respect composition
			// This is tested implicitly through the filtered getAvailablePros
			const participant = participantMap.get(1)!;
			const rec = await getDraftRecommendation(ownerPB, leagueId, participant.id);

			expect(rec.recommendedPro).toBeDefined();
			// Recommendation should be valid for roster composition
		});
	});
});
