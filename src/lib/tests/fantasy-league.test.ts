import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loginAs, getSeason2027, uniqueLeagueName, cleanupTestLeagues, createPB } from './pb-helper';
import type PocketBase from 'pocketbase';

describe('Fantasy League', () => {
	let ownerPB: PocketBase;
	let ownerId: string;
	let seasonId: string;
	const createdLeagueIds: string[] = [];

	beforeAll(async () => {
		// Login as admin1 (will be league owner)
		ownerPB = await loginAs('admin1@fligolf.com');
		ownerId = ownerPB.authStore.record?.id as string;

		// Get 2027 season
		const season = await getSeason2027(ownerPB);
		seasonId = season.id;
	});

	afterAll(async () => {
		// Cleanup test leagues
		await cleanupTestLeagues(ownerPB, createdLeagueIds);
	});

	describe('League Creation', () => {
		it('should create a fantasy league with stripe payment method', async () => {
			const leagueName = uniqueLeagueName();

			const league = await ownerPB.collection('fantasy_leagues').create({
				name: leagueName,
				season_id: seasonId,
				owner_id: ownerId,
				status: 'pending_payment',
				max_participants: 6,
				current_participants: 0,
				draft_rounds: 4,
				seconds_per_pick: 90,
				entry_fee: 100,
				prize_pool: 0,
				auto_pick_enabled: true,
				payment_method: 'stripe',
				payment_status: 'pending'
			});

			createdLeagueIds.push(league.id);

			expect(league.id).toBeDefined();
			expect(league.name).toBe(leagueName);
			expect(league.payment_method).toBe('stripe');
			expect(league.payment_status).toBe('pending');
			expect(league.status).toBe('pending_payment');
		});

		it('should create a fantasy league with other payment method', async () => {
			const leagueName = uniqueLeagueName();

			const league = await ownerPB.collection('fantasy_leagues').create({
				name: leagueName,
				season_id: seasonId,
				owner_id: ownerId,
				status: 'pending_payment',
				max_participants: 6,
				current_participants: 0,
				draft_rounds: 4,
				seconds_per_pick: 90,
				entry_fee: 100,
				prize_pool: 0,
				auto_pick_enabled: true,
				payment_method: 'other',
				payment_status: 'pending'
			});

			createdLeagueIds.push(league.id);

			expect(league.payment_method).toBe('other');
			expect(league.payment_status).toBe('pending');
		});

		it('should transition to pending_players after payment confirmed', async () => {
			const leagueName = uniqueLeagueName();

			// Create league
			const league = await ownerPB.collection('fantasy_leagues').create({
				name: leagueName,
				season_id: seasonId,
				owner_id: ownerId,
				status: 'pending_payment',
				max_participants: 6,
				current_participants: 0,
				draft_rounds: 4,
				seconds_per_pick: 90,
				entry_fee: 100,
				prize_pool: 600,
				auto_pick_enabled: true,
				payment_method: 'other',
				payment_status: 'pending'
			});

			createdLeagueIds.push(league.id);

			// Simulate payment confirmation
			const updated = await ownerPB.collection('fantasy_leagues').update(league.id, {
				payment_status: 'paid',
				status: 'pending_players',
				current_participants: 1 // Owner counts as first participant
			});

			expect(updated.payment_status).toBe('paid');
			expect(updated.status).toBe('pending_players');
			expect(updated.current_participants).toBe(1);
		});

		it('should add owner as first participant after payment', async () => {
			const leagueName = uniqueLeagueName();

			// Create and pay for league
			const league = await ownerPB.collection('fantasy_leagues').create({
				name: leagueName,
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

			createdLeagueIds.push(league.id);

			// Add owner as participant
			const participant = await ownerPB.collection('fantasy_participants').create({
				league_id: league.id,
				user_id: ownerId,
				display_name: 'admin1',
				is_owner: true,
				paid: true,
				joined_at: new Date().toISOString()
			});

			expect(participant.is_owner).toBe(true);
			expect(participant.league_id).toBe(league.id);
			expect(participant.user_id).toBe(ownerId);
		});
	});

	describe('Invite Emails', () => {
		it('should store invited emails on league', async () => {
			const leagueName = uniqueLeagueName();
			const invitedEmails = ['user1@fligolf.com', 'user2@fligolf.com', 'user3@fligolf.com'];

			const league = await ownerPB.collection('fantasy_leagues').create({
				name: leagueName,
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
				payment_status: 'paid',
				invited_emails: invitedEmails
			});

			createdLeagueIds.push(league.id);

			expect(league.invited_emails).toEqual(invitedEmails);
		});

		it('should update invited emails when owner adds more', async () => {
			const leagueName = uniqueLeagueName();

			const league = await ownerPB.collection('fantasy_leagues').create({
				name: leagueName,
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
				payment_status: 'paid',
				invited_emails: ['user1@fligolf.com']
			});

			createdLeagueIds.push(league.id);

			// Add more invites
			const updated = await ownerPB.collection('fantasy_leagues').update(league.id, {
				invited_emails: ['user1@fligolf.com', 'user2@fligolf.com', 'user3@fligolf.com']
			});

			expect(updated.invited_emails).toHaveLength(3);
		});
	});
});
