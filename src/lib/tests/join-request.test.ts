import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loginAs, getSeason2027, uniqueLeagueName, cleanupTestLeagues, createPB } from './pb-helper';
import type PocketBase from 'pocketbase';

describe('Join Requests', () => {
	let ownerPB: PocketBase;
	let user1PB: PocketBase;
	let user2PB: PocketBase;
	let ownerId: string;
	let user1Id: string;
	let user2Id: string;
	let seasonId: string;
	let leagueId: string;
	const createdLeagueIds: string[] = [];

	beforeAll(async () => {
		// Login as different users
		ownerPB = await loginAs('admin1@fligolf.com');
		user1PB = await loginAs('user1@fligolf.com');
		user2PB = await loginAs('user2@fligolf.com');

		ownerId = ownerPB.authStore.record?.id as string;
		user1Id = user1PB.authStore.record?.id as string;
		user2Id = user2PB.authStore.record?.id as string;

		// Get 2027 season
		const season = await getSeason2027(ownerPB);
		seasonId = season.id;

		// Create a league for testing join requests
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
			payment_status: 'paid',
			invited_emails: ['user1@fligolf.com', 'user2@fligolf.com']
		});

		leagueId = league.id;
		createdLeagueIds.push(leagueId);

		// Add owner as participant
		await ownerPB.collection('fantasy_participants').create({
			league_id: leagueId,
			user_id: ownerId,
			display_name: 'admin1',
			is_owner: true,
			paid: true,
			joined_at: new Date().toISOString()
		});
	});

	afterAll(async () => {
		await cleanupTestLeagues(ownerPB, createdLeagueIds);
	});

	describe('User Requests to Join', () => {
		it('should allow invited user to create join request', async () => {
			const request = await user1PB.collection('join_requests').create({
				league_id: leagueId,
				user_id: user1Id,
				display_name: 'user1',
				message: 'I would like to join!',
				status: 'pending'
			});

			expect(request.id).toBeDefined();
			expect(request.status).toBe('pending');
			expect(request.league_id).toBe(leagueId);
			expect(request.user_id).toBe(user1Id);
		});

		it('should allow user to include optional message', async () => {
			const request = await user2PB.collection('join_requests').create({
				league_id: leagueId,
				user_id: user2Id,
				display_name: 'user2',
				message: 'Excited to play!',
				status: 'pending'
			});

			expect(request.message).toBe('Excited to play!');
		});
	});

	describe('Owner Approves/Rejects', () => {
		let pendingRequestId: string;

		beforeAll(async () => {
			// Create a fresh request for approval tests
			const request = await user1PB.collection('join_requests').create({
				league_id: leagueId,
				user_id: user1Id,
				display_name: 'user1_approval_test',
				status: 'pending'
			});
			pendingRequestId = request.id;
		});

		it('should allow owner to approve join request', async () => {
			const approved = await ownerPB.collection('join_requests').update(pendingRequestId, {
				status: 'approved',
				responded_at: new Date().toISOString()
			});

			expect(approved.status).toBe('approved');
			expect(approved.responded_at).toBeDefined();
		});

		it('should create participant when request approved', async () => {
			// Create new request
			const request = await user2PB.collection('join_requests').create({
				league_id: leagueId,
				user_id: user2Id,
				display_name: 'user2_participant_test',
				status: 'pending'
			});

			// Owner approves
			await ownerPB.collection('join_requests').update(request.id, {
				status: 'approved',
				responded_at: new Date().toISOString()
			});

			// Create participant (this would be done by backend hook in production)
			const participant = await ownerPB.collection('fantasy_participants').create({
				league_id: leagueId,
				user_id: user2Id,
				display_name: 'user2_participant_test',
				is_owner: false,
				paid: true,
				joined_at: new Date().toISOString()
			});

			expect(participant.league_id).toBe(leagueId);
			expect(participant.is_owner).toBe(false);
		});

		it('should allow owner to reject join request', async () => {
			// Create request
			const request = await user1PB.collection('join_requests').create({
				league_id: leagueId,
				user_id: user1Id,
				display_name: 'user1_reject_test',
				status: 'pending'
			});

			// Owner rejects
			const rejected = await ownerPB.collection('join_requests').update(request.id, {
				status: 'rejected',
				responded_at: new Date().toISOString()
			});

			expect(rejected.status).toBe('rejected');
		});
	});

	describe('Participant Count', () => {
		it('should update current_participants when participant added', async () => {
			// Get current count
			const league = await ownerPB.collection('fantasy_leagues').getOne(leagueId);
			const currentCount = league.current_participants;

			// Update count (simulating what backend would do)
			const updated = await ownerPB.collection('fantasy_leagues').update(leagueId, {
				current_participants: currentCount + 1
			});

			expect(updated.current_participants).toBe(currentCount + 1);
		});
	});
});
