import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loginAs, getSeason2027, uniqueLeagueName, cleanupTestLeagues } from './pb-helper';
import type PocketBase from 'pocketbase';

describe('League Ready (6/6 Participants)', () => {
	let ownerPB: PocketBase;
	let ownerId: string;
	let seasonId: string;
	let leagueId: string;
	const createdLeagueIds: string[] = [];
	const participantIds: string[] = [];

	beforeAll(async () => {
		ownerPB = await loginAs('admin1@fligolf.com');
		ownerId = ownerPB.authStore.record?.id as string;

		const season = await getSeason2027(ownerPB);
		seasonId = season.id;

		// Create a league
		const league = await ownerPB.collection('fantasy_leagues').create({
			name: uniqueLeagueName(),
			season_id: seasonId,
			owner_id: ownerId,
			status: 'pending_players',
			max_participants: 6,
			current_participants: 1,
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

		// Add owner as first participant
		const ownerParticipant = await ownerPB.collection('fantasy_participants').create({
			league_id: leagueId,
			user_id: ownerId,
			display_name: 'admin1',
			is_owner: true,
			paid: true,
			joined_at: new Date().toISOString()
		});
		participantIds.push(ownerParticipant.id);
	});

	afterAll(async () => {
		await cleanupTestLeagues(ownerPB, createdLeagueIds);
	});

	describe('Filling the League', () => {
		it('should add 5 more participants to reach 6/6', async () => {
			// Get user IDs from user_profiles
			const profiles = await ownerPB.collection('user_profiles').getFullList({
				filter: 'display_name ~ "user"',
				sort: 'display_name'
			});

			// Add 5 participants (user1-user5)
			for (let i = 0; i < 5; i++) {
				const profile = profiles[i];
				const participant = await ownerPB.collection('fantasy_participants').create({
					league_id: leagueId,
					user_id: profile.user_id,
					display_name: profile.display_name,
					is_owner: false,
					paid: true,
					joined_at: new Date().toISOString()
				});
				participantIds.push(participant.id);
			}

			// Update league participant count
			await ownerPB.collection('fantasy_leagues').update(leagueId, {
				current_participants: 6
			});

			// Verify
			const participants = await ownerPB.collection('fantasy_participants').getFullList({
				filter: `league_id="${leagueId}"`
			});

			expect(participants).toHaveLength(6);
		});

		it('should transition to ready status when 6/6', async () => {
			const updated = await ownerPB.collection('fantasy_leagues').update(leagueId, {
				status: 'ready'
			});

			expect(updated.status).toBe('ready');
			expect(updated.current_participants).toBe(6);
		});
	});

	describe('Random Draft Order', () => {
		it('should assign random draft positions to all participants', async () => {
			const participants = await ownerPB.collection('fantasy_participants').getFullList({
				filter: `league_id="${leagueId}"`
			});

			// Shuffle and assign positions
			const shuffled = [...participants].sort(() => Math.random() - 0.5);

			for (let i = 0; i < shuffled.length; i++) {
				await ownerPB.collection('fantasy_participants').update(shuffled[i].id, {
					draft_position: i + 1
				});
			}

			// Verify all have unique positions 1-6
			const updated = await ownerPB.collection('fantasy_participants').getFullList({
				filter: `league_id="${leagueId}"`,
				sort: 'draft_position'
			});

			const positions = updated.map((p) => p.draft_position);
			expect(positions).toEqual([1, 2, 3, 4, 5, 6]);
		});

		it('should have exactly one participant per draft position', async () => {
			const participants = await ownerPB.collection('fantasy_participants').getFullList({
				filter: `league_id="${leagueId}"`
			});

			const positions = participants.map((p) => p.draft_position);
			const uniquePositions = new Set(positions);

			expect(uniquePositions.size).toBe(6);
		});
	});

	describe('Fantasy Tournaments Creation', () => {
		it('should create fantasy_tournaments for all season tournaments', async () => {
			// The PocketBase hook automatically creates fantasy_tournaments when 6/6 is reached
			// So we just verify they were created correctly

			// Get all tournaments in the season
			const tournaments = await ownerPB.collection('tournaments').getFullList({
				filter: `season_id="${seasonId}"`,
				sort: 'start_date'
			});

			expect(tournaments.length).toBeGreaterThan(0);

			// Verify fantasy_tournaments were created by the hook
			const fantasyTournaments = await ownerPB.collection('fantasy_tournaments').getFullList({
				filter: `league_id="${leagueId}"`,
				sort: 'tournament_number'
			});

			expect(fantasyTournaments).toHaveLength(tournaments.length);
			expect(fantasyTournaments[0].tournament_number).toBe(1);
			expect(fantasyTournaments[fantasyTournaments.length - 1].tournament_number).toBe(
				tournaments.length
			);
		});

		it('should link fantasy_tournaments to real tournaments', async () => {
			const fantasyTournaments = await ownerPB.collection('fantasy_tournaments').getFullList({
				filter: `league_id="${leagueId}"`
			});

			for (const ft of fantasyTournaments) {
				// Verify tournament_id is valid
				const realTournament = await ownerPB.collection('tournaments').getOne(ft.tournament_id);
				expect(realTournament).toBeDefined();
				expect(ft.tournament_name).toBe(realTournament.name);
			}
		});

		it('should set all fantasy_tournaments to upcoming status', async () => {
			const fantasyTournaments = await ownerPB.collection('fantasy_tournaments').getFullList({
				filter: `league_id="${leagueId}"`
			});

			for (const ft of fantasyTournaments) {
				expect(ft.status).toBe('upcoming');
				expect(ft.points_calculated).toBe(false);
			}
		});
	});
});
