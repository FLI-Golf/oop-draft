<script lang="ts">
	import { page } from '$app/stores';
	import { createAuthState } from '$lib/stores/auth.store.svelte';
	import { pb } from '$lib/data/pb/pb.client';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const auth = createAuthState();

	let league = $state<any>(null);
	let participants = $state<any[]>([]);
	let pendingRequests = $state<any[]>([]);
	let loading = $state(true);
	let error = $state('');

	let isOwner = $derived(league && auth.userId && league.owner_id === auth.userId);
	let isFull = $derived(league && league.current_participants >= league.max_participants);

	let copied = $state(false);

	function getShareText(): string {
		const url = window.location.origin + '/join/' + league?.id;
		return `Join my FLI Golf Fantasy League "${league?.name}"!\n\nSign up and request to join here: ${url}`;
	}

	async function copyShareText() {
		try {
			await navigator.clipboard.writeText(getShareText());
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	onMount(async () => {
		await auth.init();
		await loadLeague($page.params.id);
	});

	async function loadLeague(id: string) {
		loading = true;
		error = '';
		try {
			league = await pb.collection('fantasy_leagues').getOne(id, {
				expand: 'season_id'
			});

			participants = await pb.collection('fantasy_participants').getFullList({
				filter: `league_id = '${id}'`
			});

			// Check if current user is owner and load pending requests
			if (league.owner_id === auth.userId) {
				pendingRequests = await pb.collection('join_requests').getFullList({
					filter: `league_id = '${id}' && status = 'pending'`
				});
			}
		} catch (err) {
			error = 'League not found';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function approveRequest(request: any) {
		try {
			await pb.collection('join_requests').update(request.id, { status: 'approved' });

			await pb.collection('fantasy_participants').create({
				league_id: league.id,
				user_id: request.user_id,
				display_name: request.display_name,
				is_owner: false,
				paid: false,
				joined_at: new Date().toISOString()
			});

			await pb.collection('fantasy_leagues').update(league.id, {
				current_participants: league.current_participants + 1
			});

			await loadLeague(league.id);
		} catch (err) {
			console.error('Failed to approve:', err);
		}
	}

	async function rejectRequest(request: any) {
		try {
			await pb.collection('join_requests').update(request.id, { status: 'rejected' });
			await loadLeague(league.id);
		} catch (err) {
			console.error('Failed to reject:', err);
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

	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ');
	}
</script>

<div class="league-page">
	{#if loading}
		<div class="loading">Loading league...</div>
	{:else if error}
		<div class="error">
			<p>{error}</p>
			<a href="/user/dashboard">← Back to Dashboard</a>
		</div>
	{:else if league}
		<div class="league-header">
			<div class="header-left">
				<a href="/user/dashboard" class="back-link">← Dashboard</a>
				<h1>{league.name}</h1>
				<span class="status-badge {getStatusColor(league.status)}">{formatStatus(league.status)}</span>
			</div>
			{#if isOwner}
				<span class="owner-badge">Owner</span>
			{/if}
		</div>

		<div class="league-info">
			<div class="info-card">
				<h3>League Details</h3>
				<dl>
					<dt>Season</dt>
					<dd>{league.expand?.season_id?.name ?? 'Unknown'}</dd>
					<dt>Participants</dt>
					<dd>{league.current_participants} / {league.max_participants}</dd>
					<dt>Draft Rounds</dt>
					<dd>{league.draft_rounds}</dd>
					<dt>Seconds per Pick</dt>
					<dd>{league.seconds_per_pick}s</dd>
				</dl>

				{#if isOwner && league.status === 'pending_players'}
					<div class="share-section">
						<h4>Invite Friends</h4>
						<div class="share-box">
							<pre>{getShareText()}</pre>
							<button class="copy-btn" onclick={copyShareText}>
								{copied ? '✓ Copied!' : 'Copy'}
							</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="info-card">
				<h3>Participants ({participants.length}/{league.max_participants})</h3>
				<ul class="participant-list">
					{#each participants as p, i}
						<li>
							<span class="position">{i + 1}</span>
							<span class="name">{p.display_name}</span>
							{#if p.is_owner}
								<span class="owner-tag">Owner</span>
							{/if}
						</li>
					{/each}
					{#each Array(league.max_participants - participants.length) as _, i}
						<li class="empty-slot">
							<span class="position">{participants.length + i + 1}</span>
							<span class="name">Empty slot</span>
						</li>
					{/each}
				</ul>

			</div>
		</div>

		<!-- Pending Requests (Owner only) -->
		{#if isOwner && pendingRequests.length > 0}
			<div class="requests-section">
				<h3>Pending Join Requests</h3>
				<div class="requests-list">
					{#each pendingRequests as request}
						<div class="request-card">
							<div class="request-info">
								<strong>{request.display_name}</strong>
								{#if request.message}
									<p class="request-message">"{request.message}"</p>
								{/if}
							</div>
							<div class="request-actions">
								<button class="approve-btn" onclick={() => approveRequest(request)} disabled={isFull}>
									{isFull ? 'Full' : 'Approve'}
								</button>
								<button class="reject-btn" onclick={() => rejectRequest(request)}>Reject</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}



		<!-- League Actions -->
		{#if league.status === 'ready' && isOwner}
			<div class="actions-section">
				<button class="primary-btn">Start Draft</button>
			</div>
		{/if}
	{/if}
</div>



<style>
	.league-page {
		max-width: 900px;
		margin: 0 auto;
	}

	.loading, .error {
		text-align: center;
		padding: 3rem;
		color: #94a3b8;
	}

	.error a {
		color: #22c55e;
		margin-top: 1rem;
		display: inline-block;
	}

	.league-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.back-link {
		color: #94a3b8;
		text-decoration: none;
		font-size: 0.875rem;
	}

	.back-link:hover {
		color: #22c55e;
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
		color: #f8fafc;
	}

	.status-badge {
		display: inline-block;
		font-size: 0.7rem;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		text-transform: uppercase;
		font-weight: 600;
		width: fit-content;
	}

	.status-pending { background: #fbbf24; color: #0f172a; }
	.status-ready { background: #3b82f6; color: white; }
	.status-drafting { background: #8b5cf6; color: white; }
	.status-active { background: #22c55e; color: #0f172a; }
	.status-completed { background: #64748b; color: white; }

	.owner-badge {
		background: #22c55e;
		color: #0f172a;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.league-info {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.info-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.75rem;
		padding: 1.25rem;
	}

	.info-card h3 {
		margin: 0 0 1rem;
		font-size: 1rem;
		color: #f8fafc;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem 1rem;
	}

	dt {
		color: #94a3b8;
		font-size: 0.875rem;
	}

	dd {
		margin: 0;
		color: #f8fafc;
		font-size: 0.875rem;
	}

	.participant-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.participant-list li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #334155;
	}

	.participant-list li:last-child {
		border-bottom: none;
	}

	.position {
		width: 1.5rem;
		height: 1.5rem;
		background: #334155;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.name {
		flex: 1;
		color: #f8fafc;
		font-size: 0.875rem;
	}

	.empty-slot .name {
		color: #64748b;
		font-style: italic;
	}

	.owner-tag {
		background: #334155;
		color: #22c55e;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.share-section {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #334155;
	}

	.share-section h4 {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		color: #94a3b8;
	}

	.share-box {
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 0.5rem;
		padding: 0.75rem;
		position: relative;
	}

	.share-box pre {
		margin: 0;
		font-size: 0.75rem;
		color: #e2e8f0;
		white-space: pre-wrap;
		word-break: break-all;
		font-family: inherit;
	}

	.copy-btn {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: #22c55e;
		color: #0f172a;
		border: none;
		padding: 0.25rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.copy-btn:hover {
		background: #16a34a;
	}

	.requests-section {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.75rem;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.requests-section h3 {
		margin: 0 0 1rem;
		font-size: 1rem;
		color: #f8fafc;
	}

	.requests-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.request-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #0f172a;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
	}

	.request-info {
		color: #e2e8f0;
		font-size: 0.9rem;
	}

	.request-message {
		margin: 0.25rem 0 0;
		color: #94a3b8;
		font-style: italic;
		font-size: 0.8rem;
	}

	.request-actions {
		display: flex;
		gap: 0.5rem;
	}

	.approve-btn, .reject-btn {
		padding: 0.375rem 0.75rem;
		border: none;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
	}

	.approve-btn {
		background: #22c55e;
		color: #0f172a;
	}

	.approve-btn:disabled {
		background: #334155;
		color: #64748b;
		cursor: not-allowed;
	}

	.reject-btn {
		background: #334155;
		color: #94a3b8;
	}

	.actions-section {
		text-align: center;
		padding: 1.5rem;
	}

	.primary-btn {
		background: #22c55e;
		color: #0f172a;
		border: none;
		padding: 0.875rem 2rem;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.primary-btn:hover {
		background: #16a34a;
	}

	@media (max-width: 640px) {
		.league-info {
			grid-template-columns: 1fr;
		}

		.request-card {
			flex-direction: column;
			gap: 0.75rem;
			align-items: flex-start;
		}
	}
</style>
