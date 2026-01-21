<script lang="ts">
	import { createAuthState } from '$lib/stores/auth.store.svelte';
	import { pb } from '$lib/data/pb/pb.client';
	import { onMount } from 'svelte';

	const auth = createAuthState();

	// League data
	let ownedLeagues = $state<any[]>([]);
	let joinedLeagues = $state<any[]>([]);
	let pendingRequests = $state<any[]>([]);
	let loading = $state(true);

	// Create league modal
	let showCreateModal = $state(false);
	let createForm = $state({
		name: '',
		seconds_per_pick: 7
	});
	let createError = $state('');
	let creating = $state(false);
	
	const pickTimeOptions = [7, 15, 30, 45];

	function getDefaultLeagueName(): string {
		const displayName = auth.profile?.display_name ?? 'League';
		const idSuffix = auth.userId?.slice(-4) ?? '0000';
		return `${displayName}-${idSuffix}`;
	}

	function openCreateModal() {
		createForm.name = getDefaultLeagueName();
		createForm.seconds_per_pick = 7;
		showCreateModal = true;
	}

	onMount(async () => {
		await auth.init();
		if (auth.userId) {
			await loadData();
		}
	});

	async function loadData() {
		loading = true;
		try {
			const userId = auth.userId;
			
			// Get leagues I own
			ownedLeagues = await pb.collection('fantasy_leagues').getFullList({
				filter: `owner_id = '${userId}'`
			});

			// Get leagues I'm a participant in (but don't own)
			const myParticipations = await pb.collection('fantasy_participants').getFullList({
				filter: `user_id = '${userId}' && is_owner = false`,
				expand: 'league_id'
			});
			joinedLeagues = myParticipations
				.filter(p => p.expand?.league_id)
				.map(p => p.expand!.league_id);

			// Get pending join requests for leagues I own
			if (ownedLeagues.length > 0) {
				const leagueIds = ownedLeagues.map(l => `league_id = '${l.id}'`).join(' || ');
				pendingRequests = await pb.collection('join_requests').getFullList({
					filter: `(${leagueIds}) && status = 'pending'`,
					expand: 'league_id'
				});
			}
		} catch (err) {
			console.error('Failed to load data:', err);
		} finally {
			loading = false;
		}
	}

	async function createLeague() {
		createError = '';
		creating = true;

		try {
			// Get current season
			const seasons = await pb.collection('seasons').getFullList({
				filter: 'year = 2027',
				limit: 1
			});
			
			if (seasons.length === 0) {
				throw new Error('No active season found');
			}

			const league = await pb.collection('fantasy_leagues').create({
				name: createForm.name,
				season_id: seasons[0].id,
				owner_id: auth.userId,
				status: 'pending_players',
				max_participants: 6,
				current_participants: 1,
				draft_rounds: 4,
				seconds_per_pick: createForm.seconds_per_pick,
				entry_fee: 0,
				prize_pool: 0,
				auto_pick_enabled: true,
				payment_method: 'other',
				payment_status: 'paid'
			});

			// Add owner as first participant
			await pb.collection('fantasy_participants').create({
				league_id: league.id,
				user_id: auth.userId,
				display_name: auth.profile?.display_name ?? 'Owner',
				is_owner: true,
				paid: true,
				joined_at: new Date().toISOString()
			});

			showCreateModal = false;
			createForm = { name: '', seconds_per_pick: 7 };
			await loadData();
		} catch (err) {
			createError = err instanceof Error ? err.message : 'Failed to create league';
		} finally {
			creating = false;
		}
	}

	async function approveRequest(request: any) {
		try {
			// Update request status
			await pb.collection('join_requests').update(request.id, { status: 'approved' });

			// Add as participant
			await pb.collection('fantasy_participants').create({
				league_id: request.league_id,
				user_id: request.user_id,
				display_name: request.display_name,
				is_owner: false,
				paid: false,
				joined_at: new Date().toISOString()
			});

			// Update league participant count
			const league = await pb.collection('fantasy_leagues').getOne(request.league_id);
			await pb.collection('fantasy_leagues').update(request.league_id, {
				current_participants: league.current_participants + 1
			});

			await loadData();
		} catch (err) {
			console.error('Failed to approve request:', err);
		}
	}

	async function rejectRequest(request: any) {
		try {
			await pb.collection('join_requests').update(request.id, { status: 'rejected' });
			await loadData();
		} catch (err) {
			console.error('Failed to reject request:', err);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending_players': return 'status-pending';
			case 'ready': return 'status-ready';
			case 'drafting': return 'status-drafting';
			case 'active': return 'status-active';
			case 'completed': return 'status-completed';
			default: return '';
		}
	}
</script>

<div class="dashboard">
	<h1>Dashboard</h1>

	<!-- Profile Section -->
	<section class="profile-section">
		<h2>My Profile</h2>
		<div class="profile-card">
			<div class="profile-avatar">
				{auth.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
			</div>
			<div class="profile-info">
				<h3>{auth.profile?.display_name ?? 'Player'}</h3>
				<p class="email">{auth.email}</p>
				<span class="role-badge">{auth.profile?.role ?? 'user'}</span>
			</div>
			<div class="profile-stats">
				<div class="stat">
					<span class="stat-value">{auth.profile?.leagues_joined ?? 0}</span>
					<span class="stat-label">Leagues Joined</span>
				</div>
				<div class="stat">
					<span class="stat-value">{auth.profile?.leagues_won ?? 0}</span>
					<span class="stat-label">Leagues Won</span>
				</div>
				<div class="stat">
					<span class="stat-value">${auth.profile?.total_winnings ?? 0}</span>
					<span class="stat-label">Total Winnings</span>
				</div>
			</div>
		</div>
	</section>

	<!-- My Leagues Section -->
	<section class="leagues-section">
		<div class="section-header">
			<h2>My Leagues</h2>
			<button class="create-btn" onclick={openCreateModal}>+ Create League</button>
		</div>

		{#if loading}
			<div class="loading-state">Loading leagues...</div>
		{:else}
			<!-- Owned Leagues -->
			{#if ownedLeagues.length > 0}
				<h3 class="subsection-title">Leagues I Own</h3>
				<div class="league-grid">
					{#each ownedLeagues as league}
						<div class="league-card">
							<div class="league-header">
								<h4>{league.name}</h4>
								<span class="status-badge {getStatusColor(league.status)}">
									{league.status.replace('_', ' ')}
								</span>
							</div>
							<div class="league-details">
								<p><strong>Participants:</strong> {league.current_participants}/{league.max_participants}</p>
							</div>
							<a href="/user/league/{league.id}" class="league-link">Manage League →</a>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Joined Leagues -->
			{#if joinedLeagues.length > 0}
				<h3 class="subsection-title">Leagues I've Joined</h3>
				<div class="league-grid">
					{#each joinedLeagues as league}
						<div class="league-card">
							<div class="league-header">
								<h4>{league.name}</h4>
								<span class="status-badge {getStatusColor(league.status)}">
									{league.status.replace('_', ' ')}
								</span>
							</div>
							<div class="league-details">
								<p><strong>Participants:</strong> {league.current_participants}/{league.max_participants}</p>
							</div>
							<a href="/user/league/{league.id}" class="league-link">View League →</a>
						</div>
					{/each}
				</div>
			{/if}

			{#if ownedLeagues.length === 0 && joinedLeagues.length === 0}
				<div class="empty-state">
					<p>You haven't joined any leagues yet.</p>
					<button class="create-btn" onclick={openCreateModal}>Create Your First League</button>
				</div>
			{/if}
		{/if}
	</section>

	<!-- Pending Requests Section -->
	{#if pendingRequests.length > 0}
		<section class="requests-section">
			<h2>Pending Join Requests</h2>
			<div class="requests-list">
				{#each pendingRequests as request}
					<div class="request-card">
						<div class="request-info">
							<strong>{request.display_name}</strong> wants to join 
							<em>{request.expand?.league_id?.name ?? 'your league'}</em>
							{#if request.message}
								<p class="request-message">"{request.message}"</p>
							{/if}
						</div>
						<div class="request-actions">
							<button class="approve-btn" onclick={() => approveRequest(request)}>Approve</button>
							<button class="reject-btn" onclick={() => rejectRequest(request)}>Reject</button>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<!-- Create League Modal -->
{#if showCreateModal}
	<div class="modal-overlay" onclick={() => showCreateModal = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (showCreateModal = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
			<button class="modal-close" onclick={() => showCreateModal = false}>&times;</button>
			<h2>Create a League</h2>
			
			<form onsubmit={(e) => { e.preventDefault(); createLeague(); }}>
				<div class="form-field">
					<label for="name">League Name</label>
					<input id="name" type="text" bind:value={createForm.name} placeholder="My Fantasy League" required />
				</div>

				<div class="form-field">
					<label>Seconds per Pick</label>
					<div class="radio-list">
						{#each pickTimeOptions as seconds}
							<label class="radio-item">
								<input 
									type="radio" 
									name="seconds_per_pick" 
									value={seconds} 
									bind:group={createForm.seconds_per_pick}
								/>
								<span class="radio-circle"></span>
								<span class="radio-text">{seconds} seconds</span>
							</label>
						{/each}
					</div>
				</div>

				{#if createError}
					<div class="form-error">{createError}</div>
				{/if}

				<button type="submit" class="submit-btn" disabled={creating}>
					{creating ? 'Creating...' : 'Create League'}
				</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.dashboard {
		max-width: 1000px;
		margin: 0 auto;
	}

	h1 {
		font-size: 2rem;
		margin: 0 0 2rem;
		color: #f8fafc;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0;
		color: #f8fafc;
	}

	section {
		margin-bottom: 2.5rem;
	}

	/* Profile Section */
	.profile-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		background: #1e293b;
		padding: 1.5rem;
		border-radius: 1rem;
		border: 1px solid #334155;
		margin-top: 1rem;
	}

	.profile-avatar {
		width: 4rem;
		height: 4rem;
		background: linear-gradient(135deg, #22c55e, #10b981);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: 700;
		color: #0f172a;
	}

	.profile-info {
		flex: 1;
	}

	.profile-info h3 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.profile-info .email {
		margin: 0.25rem 0 0.5rem;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.role-badge {
		display: inline-block;
		background: #334155;
		color: #94a3b8;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.profile-stats {
		display: flex;
		gap: 2rem;
	}

	.stat {
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: #22c55e;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	/* Leagues Section */
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.create-btn {
		background: #22c55e;
		color: #0f172a;
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.create-btn:hover {
		background: #16a34a;
	}

	.subsection-title {
		font-size: 0.875rem;
		color: #94a3b8;
		margin: 1.5rem 0 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.league-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.league-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.75rem;
		padding: 1.25rem;
		transition: border-color 0.2s;
	}

	.league-card:hover {
		border-color: #22c55e;
	}

	.league-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.league-header h4 {
		margin: 0;
		color: #f8fafc;
		font-size: 1rem;
	}

	.status-badge {
		font-size: 0.65rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		text-transform: uppercase;
		font-weight: 600;
	}

	.status-pending { background: #fbbf24; color: #0f172a; }
	.status-ready { background: #3b82f6; color: white; }
	.status-drafting { background: #8b5cf6; color: white; }
	.status-active { background: #22c55e; color: #0f172a; }
	.status-completed { background: #64748b; color: white; }

	.league-details {
		font-size: 0.875rem;
		color: #94a3b8;
	}

	.league-details p {
		margin: 0.25rem 0;
	}

	.league-link {
		display: inline-block;
		margin-top: 0.75rem;
		color: #22c55e;
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.league-link:hover {
		text-decoration: underline;
	}

	.empty-state, .loading-state {
		text-align: center;
		padding: 3rem;
		background: #1e293b;
		border-radius: 0.75rem;
		border: 1px dashed #334155;
		color: #94a3b8;
	}

	.empty-state .create-btn {
		margin-top: 1rem;
	}

	/* Requests Section */
	.requests-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.request-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.request-info {
		color: #e2e8f0;
		font-size: 0.9rem;
	}

	.request-info em {
		color: #22c55e;
	}

	.request-message {
		margin: 0.5rem 0 0;
		color: #94a3b8;
		font-style: italic;
		font-size: 0.85rem;
	}

	.request-actions {
		display: flex;
		gap: 0.5rem;
	}

	.approve-btn, .reject-btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
	}

	.approve-btn {
		background: #22c55e;
		color: #0f172a;
	}

	.reject-btn {
		background: #334155;
		color: #94a3b8;
	}

	.approve-btn:hover { background: #16a34a; }
	.reject-btn:hover { background: #475569; color: #f8fafc; }

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem;
	}

	.modal {
		background: #1e293b;
		border-radius: 1rem;
		padding: 2rem;
		width: 100%;
		max-width: 450px;
		position: relative;
		border: 1px solid #334155;
	}

	.modal h2 {
		margin: 0 0 1.5rem;
		text-align: center;
	}

	.modal-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}

	.form-field {
		margin-bottom: 1rem;
	}

	.form-field label {
		display: block;
		margin-bottom: 0.375rem;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.form-field input {
		width: 100%;
		padding: 0.75rem;
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 0.5rem;
		color: #f8fafc;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.form-field input:focus {
		outline: none;
		border-color: #22c55e;
	}

	.radio-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.radio-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: border-color 0.2s;
	}

	.radio-item:hover {
		border-color: #22c55e;
	}

	.radio-item input {
		display: none;
	}

	.radio-circle {
		width: 1.125rem;
		height: 1.125rem;
		border: 2px solid #334155;
		border-radius: 50%;
		position: relative;
		flex-shrink: 0;
	}

	.radio-item input:checked ~ .radio-circle {
		border-color: #22c55e;
	}

	.radio-item input:checked ~ .radio-circle::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 0.5rem;
		height: 0.5rem;
		background: #22c55e;
		border-radius: 50%;
	}

	.radio-text {
		color: #e2e8f0;
		font-size: 0.875rem;
	}

	.radio-item input:checked ~ .radio-text {
		color: #22c55e;
		font-weight: 500;
	}

	.form-error {
		background: #7f1d1d;
		color: #fecaca;
		padding: 0.75rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.submit-btn {
		width: 100%;
		padding: 0.875rem;
		background: #22c55e;
		color: #0f172a;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.submit-btn:hover:not(:disabled) {
		background: #16a34a;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.profile-card {
			flex-direction: column;
			text-align: center;
		}

		.profile-stats {
			width: 100%;
			justify-content: space-around;
		}

		.request-card {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}

	}
</style>
