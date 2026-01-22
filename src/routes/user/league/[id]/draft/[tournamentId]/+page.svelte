<script lang="ts">
	import { page } from '$app/stores';
	import { createAuthState } from '$lib/stores/auth.store.svelte';
	import { pb } from '$lib/data/pb/pb.client';
	import { onMount, onDestroy } from 'svelte';

	const auth = createAuthState();

	let league = $state<any>(null);
	let tournament = $state<any>(null);
	let draftMgmt = $state<any>(null);
	let draftResults = $state<any>(null);
	let loading = $state(true);
	let error = $state('');

	let isOwner = $derived(league && auth.userId && league.owner_id === auth.userId);
	let isMyTurn = $derived(draftMgmt && auth.userId === draftMgmt.current_drafter_id);
	let draftStatus = $derived(draftMgmt?.status || 'waiting');

	// Timer
	let timeRemaining = $state<number | null>(null);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Realtime subscription
	let unsubscribe: (() => void) | null = null;

	onMount(async () => {
		await auth.init();
		await loadData();
		subscribeToUpdates();
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
		if (unsubscribe) unsubscribe();
	});

	async function loadData() {
		loading = true;
		error = '';
		try {
			const leagueId = $page.params.id;
			const tournamentId = $page.params.tournamentId;

			league = await pb.collection('fantasy_leagues').getOne(leagueId);
			tournament = await pb.collection('fantasy_tournaments').getOne(tournamentId);

			parseDraftData();
		} catch (err) {
			error = 'Failed to load draft';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function parseDraftData() {
		if (tournament) {
			draftMgmt = typeof tournament.draft_management === 'string' 
				? JSON.parse(tournament.draft_management) 
				: tournament.draft_management;
			draftResults = typeof tournament.draft_results === 'string'
				? JSON.parse(tournament.draft_results)
				: tournament.draft_results;

			// Update timer if draft is in progress
			if (draftMgmt?.status === 'in_progress' && draftMgmt?.pick_deadline) {
				startTimer();
			}
		}
	}

	function subscribeToUpdates() {
		const tournamentId = $page.params.tournamentId;
		pb.collection('fantasy_tournaments').subscribe(tournamentId, (e) => {
			if (e.action === 'update') {
				tournament = e.record;
				parseDraftData();
			}
		}).then(unsub => {
			unsubscribe = unsub;
		});
	}

	function startTimer() {
		if (timerInterval) clearInterval(timerInterval);
		
		const updateTimer = () => {
			if (draftMgmt?.pick_deadline) {
				const deadline = new Date(draftMgmt.pick_deadline).getTime();
				const now = Date.now();
				timeRemaining = Math.max(0, Math.floor((deadline - now) / 1000));
			}
		};

		updateTimer();
		timerInterval = setInterval(updateTimer, 1000);
	}

	async function updateSecondsPerPick(seconds: number) {
		if (!isOwner) return;

		try {
			const updatedMgmt = {
				...draftMgmt,
				settings: {
					...draftMgmt.settings,
					seconds_per_pick: seconds
				}
			};

			await pb.collection('fantasy_tournaments').update(tournament.id, {
				draft_management: JSON.stringify(updatedMgmt)
			});
		} catch (err) {
			console.error('Failed to update settings:', err);
		}
	}

	async function startDraft() {
		if (!isOwner) return;

		try {
			const now = new Date();
			const deadline = new Date(now.getTime() + (draftMgmt.settings.seconds_per_pick * 1000));

			const updatedMgmt = {
				...draftMgmt,
				status: 'in_progress',
				pick_deadline: deadline.toISOString()
			};

			await pb.collection('fantasy_tournaments').update(tournament.id, {
				draft_management: JSON.stringify(updatedMgmt)
			});
		} catch (err) {
			console.error('Failed to start draft:', err);
		}
	}

	async function pauseDraft() {
		if (!isOwner) return;

		try {
			const updatedMgmt = {
				...draftMgmt,
				status: 'paused',
				pick_deadline: null
			};

			await pb.collection('fantasy_tournaments').update(tournament.id, {
				draft_management: JSON.stringify(updatedMgmt)
			});

			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
			timeRemaining = null;
		} catch (err) {
			console.error('Failed to pause draft:', err);
		}
	}

	async function resumeDraft() {
		if (!isOwner) return;

		try {
			const now = new Date();
			const deadline = new Date(now.getTime() + (draftMgmt.settings.seconds_per_pick * 1000));

			const updatedMgmt = {
				...draftMgmt,
				status: 'in_progress',
				pick_deadline: deadline.toISOString()
			};

			await pb.collection('fantasy_tournaments').update(tournament.id, {
				draft_management: JSON.stringify(updatedMgmt)
			});
		} catch (err) {
			console.error('Failed to resume draft:', err);
		}
	}

	async function makePick(pro: any) {
		if (!isMyTurn || draftStatus !== 'in_progress') return;

		try {
			const now = new Date().toISOString();
			const userId = auth.userId!;

			// Add pro to user's team
			const updatedTeams = { ...draftResults.teams };
			updatedTeams[userId].pros.push({
				id: pro.id,
				name: pro.name,
				rating: pro.rating,
				gender: pro.gender,
				pick_number: draftMgmt.current_pick,
				round: draftMgmt.current_round
			});

			// Add to picks history
			const updatedPicks = [...draftResults.picks, {
				pick_number: draftMgmt.current_pick,
				round: draftMgmt.current_round,
				user_id: userId,
				user_name: draftMgmt.participants[userId].display_name,
				pro_id: pro.id,
				pro_name: pro.name,
				timestamp: now
			}];

			// Remove pro from available pool
			const updatedAvailablePros = draftMgmt.available_pros.filter((p: any) => p.id !== pro.id);

			// Calculate next pick
			const { nextRound, nextPick, nextDrafterId, isComplete, newDirection } = calculateNextPick();

			// Update draft management
			const updatedMgmt = {
				...draftMgmt,
				available_pros: updatedAvailablePros,
				current_round: nextRound,
				current_pick: nextPick,
				current_drafter_id: nextDrafterId,
				current_drafter_name: nextDrafterId ? draftMgmt.participants[nextDrafterId]?.display_name : null,
				snake_direction: newDirection,
				status: isComplete ? 'complete' : 'in_progress',
				pick_deadline: isComplete ? null : new Date(Date.now() + (draftMgmt.settings.seconds_per_pick * 1000)).toISOString()
			};

			const updatedResults = {
				...draftResults,
				teams: updatedTeams,
				picks: updatedPicks,
				completed_at: isComplete ? now : null
			};

			await pb.collection('fantasy_tournaments').update(tournament.id, {
				draft_management: JSON.stringify(updatedMgmt),
				draft_results: JSON.stringify(updatedResults)
			});
		} catch (err) {
			console.error('Failed to make pick:', err);
		}
	}

	function calculateNextPick(): { nextRound: number; nextPick: number; nextDrafterId: string | null; isComplete: boolean; newDirection: number } {
		const totalParticipants = draftMgmt.settings.total_participants;
		const totalRounds = draftMgmt.settings.total_rounds;
		const currentPick = draftMgmt.current_pick;
		const currentRound = draftMgmt.current_round;
		const draftOrder = getDraftOrder();
		let direction = draftMgmt.snake_direction;

		const nextPick = currentPick + 1;
		const pickInRound = ((currentPick - 1) % totalParticipants) + 1;

		// Check if round is complete
		if (pickInRound === totalParticipants) {
			// End of round - reverse direction for snake draft
			const nextRound = currentRound + 1;
			
			if (nextRound > totalRounds) {
				// Draft complete
				return { nextRound: currentRound, nextPick: currentPick, nextDrafterId: null, isComplete: true, newDirection: direction };
			}

			// Reverse direction
			direction = direction * -1;
			const nextDrafterIndex = direction === 1 ? 0 : totalParticipants - 1;
			return { 
				nextRound, 
				nextPick, 
				nextDrafterId: draftOrder[nextDrafterIndex], 
				isComplete: false, 
				newDirection: direction 
			};
		}

		// Same round, next picker
		const currentIndex = draftOrder.indexOf(draftMgmt.current_drafter_id);
		const nextIndex = currentIndex + direction;
		return { 
			nextRound: currentRound, 
			nextPick, 
			nextDrafterId: draftOrder[nextIndex], 
			isComplete: false, 
			newDirection: direction 
		};
	}

	function getDraftOrder(): string[] {
		if (draftMgmt?.draft_order && Array.isArray(draftMgmt.draft_order)) {
			return draftMgmt.draft_order;
		}
		if (tournament?.draft_order) {
			if (Array.isArray(tournament.draft_order)) {
				return tournament.draft_order;
			}
			if (typeof tournament.draft_order === 'string') {
				try {
					return JSON.parse(tournament.draft_order);
				} catch {
					return [];
				}
			}
		}
		return [];
	}

	function getParticipantByPosition(position: number): any {
		if (!draftMgmt?.participants) return null;
		const draftOrder = getDraftOrder();
		const userId = draftOrder[position - 1];
		return userId ? { ...draftMgmt.participants[userId], id: userId } : null;
	}
</script>

<div class="draft-page">
	{#if loading}
		<div class="loading">Loading draft...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if tournament && draftMgmt}
		<!-- Header -->
		<header class="draft-header">
			<div class="header-left">
				<a href="/user/league/{league.id}" class="back-link">← {league.name}</a>
				<h1>{tournament.tournament_name}</h1>
				<span class="draft-status-badge status-{draftStatus}">{draftStatus.replace('_', ' ')}</span>
			</div>
			<div class="header-right">
				{#if draftStatus === 'in_progress' && timeRemaining !== null}
					<div class="timer" class:urgent={timeRemaining <= 10}>
						{timeRemaining}s
					</div>
				{/if}
			</div>
		</header>

		<!-- Draft Info Bar -->
		<div class="draft-info-bar">
			<div class="info-item">
				<span class="label">Round</span>
				<span class="value">{draftMgmt.current_round} / {draftMgmt.settings.total_rounds}</span>
			</div>
			<div class="info-item">
				<span class="label">Pick</span>
				<span class="value">{draftMgmt.current_pick} / {draftMgmt.settings.total_picks}</span>
			</div>
			<div class="info-item current-picker">
				<span class="label">Now Picking</span>
				<span class="value">{draftMgmt.current_drafter_name || '-'}</span>
			</div>
			<div class="info-item">
				<span class="label">Direction</span>
				<span class="value">{draftMgmt.snake_direction === 1 ? '→' : '←'}</span>
			</div>
		</div>

		{#if draftStatus === 'waiting'}
			<!-- Waiting to Start -->
			<div class="waiting-layout">
				<div class="waiting-left">
					<div class="draft-setup-card">
						<h3>Draft Ready</h3>
						<p class="settings-desc">All participants are set. The draft order has been randomized.</p>
						
						<div class="time-label">Time per Pick</div>
						<div class="time-options">
							{#each [7, 15, 30, 45] as seconds}
								<button 
									class="time-option" 
									class:selected={draftMgmt.settings.seconds_per_pick === seconds}
									onclick={() => updateSecondsPerPick(seconds)}
									disabled={!isOwner}
								>
									{seconds}s
								</button>
							{/each}
						</div>
						<p class="settings-note">
							{draftMgmt.settings.total_rounds} rounds • {draftMgmt.settings.total_participants} players • {draftMgmt.settings.total_picks} picks
						</p>

						{#if isOwner}
							<button class="start-btn" onclick={startDraft}>Start Draft</button>
						{:else}
							<p class="waiting-text">Waiting for the league owner to start the draft...</p>
						{/if}

						<div class="recommended-section">
							<div class="rec-label">Recommended Pro</div>
							{#if draftMgmt.available_pros?.[0]}
								{@const topPro = draftMgmt.available_pros[0]}
								<div class="rec-pro-display">
									<div class="rec-pro-info">
										<span class="rec-pro-name">{topPro.name}</span>
										<span class="rec-pro-meta">{topPro.rating} • {topPro.gender === 'male' ? 'M' : 'F'}</span>
									</div>
									<button class="rec-pick-btn" disabled>Pick</button>
								</div>
							{/if}
						</div>

						<div class="draft-order-section">
							<div class="order-label">Draft Order</div>
							<div class="order-list">
								{#each Array(draftMgmt.settings.total_participants) as _, i}
									{@const participant = getParticipantByPosition(i + 1)}
									{#if participant}
										<div class="order-item" class:is-you={participant.id === auth.userId} class:first-pick={i === 0}>
											<span class="position">{i + 1}</span>
											<span class="name">{participant.display_name}</span>
											{#if participant.id === auth.userId}<span class="you-tag">You</span>{/if}
											{#if participant.is_owner}<span class="owner-tag">Owner</span>{/if}
											{#if i === 0}<span class="first-tag">1st</span>{/if}
										</div>
									{/if}
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div class="waiting-right">
					<div class="available-pros-preview">
						<h3>Available Pros ({draftMgmt.available_pros?.length || 0})</h3>
						<div class="pros-grid-preview">
							{#each draftMgmt.available_pros || [] as pro, idx}
								<div class="pro-card-preview" class:recommended={idx === 0}>
									<div class="pro-card-header">
										<span class="pro-rank">#{idx + 1}</span>
										{#if idx === 0}<span class="best-badge">Best</span>{/if}
									</div>
									<span class="pro-name">{pro.name}</span>
									<span class="pro-meta">{pro.rating} • {pro.gender === 'male' ? 'M' : 'F'}</span>
									<button class="pick-btn-preview" disabled>Pick</button>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

		{:else if draftStatus === 'in_progress' || draftStatus === 'paused'}
			<!-- Draft In Progress -->
			{@const recommendedPro = draftMgmt.available_pros?.[0]}
			
			<!-- On The Clock Banner -->
			<div class="on-the-clock" class:is-you={isMyTurn} class:is-paused={draftStatus === 'paused'}>
				<div class="clock-info">
					<span class="clock-label">{draftStatus === 'paused' ? 'Draft Paused' : 'On The Clock'}</span>
					<span class="clock-name">{draftMgmt.current_drafter_name}</span>
					{#if isMyTurn && draftStatus !== 'paused'}<span class="clock-you">That's You!</span>{/if}
				</div>
				<div class="clock-controls">
					{#if draftStatus === 'paused'}
						<div class="paused-indicator">PAUSED</div>
						{#if isOwner}
							<button class="resume-btn" onclick={resumeDraft}>Resume Draft</button>
						{/if}
					{:else}
						<div class="clock-timer" class:urgent={timeRemaining !== null && timeRemaining <= 10}>
							{#if timeRemaining !== null}
								<span class="timer-value">{timeRemaining}</span>
								<span class="timer-label">seconds</span>
							{/if}
						</div>
						{#if isOwner}
							<button class="pause-btn" onclick={pauseDraft}>Pause</button>
						{/if}
					{/if}
				</div>
			</div>

			<div class="draft-main">
				<!-- Left: Teams -->
				<div class="teams-column">
					<h2>Teams</h2>
					{#each getDraftOrder() as oderId, idx}
						{@const teamData = draftResults.teams[oderId]}
						{#if teamData}
							<div class="team-card" class:is-picking={oderId === draftMgmt.current_drafter_id} class:is-you={oderId === auth.userId}>
								<div class="team-header">
									<span class="draft-pos">#{idx + 1}</span>
									<span class="team-name">{teamData.display_name}</span>
									{#if oderId === auth.userId}<span class="you-badge">You</span>{/if}
									{#if oderId === draftMgmt.current_drafter_id}<span class="picking-badge">Picking</span>{/if}
								</div>
								<ul class="team-pros">
									{#each teamData.pros as pro, proIdx}
										<li>
											<span class="round-num">R{pro.round}</span>
											<span class="pro-name">{pro.name}</span>
											<span class="pro-rating">{pro.rating}</span>
										</li>
									{:else}
										<li class="empty">No picks yet</li>
									{/each}
								</ul>
							</div>
						{/if}
					{/each}
				</div>

				<!-- Center: Available Pros -->
				<div class="pros-column">
					<div class="pros-header">
						<h2>Available Pros ({draftMgmt.available_pros?.length || 0})</h2>
						{#if isMyTurn && draftStatus === 'in_progress'}
							<span class="your-pick-badge">Your Pick!</span>
						{:else if draftStatus === 'paused'}
							<span class="paused-badge">Paused</span>
						{/if}
					</div>

					<div class="pros-list">
						{#each draftMgmt.available_pros || [] as pro, idx}
							{@const isRecommended = idx === 0}
							<div class="pro-row" class:recommended={isRecommended} class:selectable={isMyTurn && draftStatus === 'in_progress'}>
								<span class="pro-rank">#{idx + 1}</span>
								<div class="pro-info">
									<span class="pro-name">{pro.name}</span>
									<span class="pro-meta">
										<span class="pro-rating">{pro.rating}</span>
										<span class="pro-gender">{pro.gender === 'male' ? 'M' : 'F'}</span>
									</span>
								</div>
								{#if isRecommended}
									<span class="rec-badge">Best Available</span>
								{/if}
								<button 
									class="pick-btn"
									class:recommended={isRecommended}
									onclick={() => makePick(pro)}
									disabled={!isMyTurn || draftStatus !== 'in_progress'}
								>
									{isMyTurn && draftStatus === 'in_progress' ? 'Pick' : '-'}
								</button>
							</div>
						{/each}
					</div>
				</div>

				<!-- Right: Pick History -->
				<div class="history-column">
					<h2>Pick History</h2>
					<div class="picks-history">
						{#each [...(draftResults.picks || [])].reverse() as pick}
							<div class="history-item" class:is-you={pick.user_id === auth.userId}>
								<div class="history-pick-info">
									<span class="history-round">R{pick.round}</span>
									<span class="history-pick">P{pick.pick_number}</span>
								</div>
								<div class="history-details">
									<span class="history-user">{pick.user_name}</span>
									<span class="history-pro">{pick.pro_name}</span>
								</div>
							</div>
						{:else}
							<p class="no-picks">No picks yet</p>
						{/each}
					</div>
				</div>
			</div>

		{:else if draftStatus === 'complete'}
			<!-- Draft Complete -->
			<div class="complete-section">
				<h2>Draft Complete!</h2>
				<div class="final-teams">
					{#each Object.entries(draftResults.teams) as [userId, team]}
						{@const teamData = team as any}
						<div class="final-team-card" class:is-you={userId === auth.userId}>
							<h3>{teamData.display_name}'s Team</h3>
							<ul>
								{#each teamData.pros as pro}
									<li>
										<span class="pro-name">{pro.name}</span>
										<span class="pro-meta">R{pro.round} P{pro.pick_number} • {pro.rating}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.draft-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
	}

	.loading, .error {
		text-align: center;
		padding: 3rem;
		color: #94a3b8;
	}

	/* Header */
	.draft-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.back-link {
		color: #94a3b8;
		text-decoration: none;
		font-size: 0.85rem;
	}

	.back-link:hover {
		color: #22c55e;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		color: #f8fafc;
	}

	.draft-status-badge {
		display: inline-block;
		font-size: 0.7rem;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		text-transform: uppercase;
		font-weight: 600;
		width: fit-content;
	}

	.status-waiting { background: #334155; color: #94a3b8; }
	.status-in_progress { background: #f59e0b; color: #0f172a; }
	.status-paused { background: #f59e0b; color: #0f172a; }
	.status-complete { background: #22c55e; color: #0f172a; }

	.timer {
		font-size: 2rem;
		font-weight: 700;
		color: #22c55e;
		font-variant-numeric: tabular-nums;
	}

	.timer.urgent {
		color: #ef4444;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	/* Info Bar */
	.draft-info-bar {
		display: flex;
		gap: 1.5rem;
		background: #1e293b;
		padding: 1rem 1.5rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-item .label {
		font-size: 0.7rem;
		color: #64748b;
		text-transform: uppercase;
	}

	.info-item .value {
		font-size: 1.1rem;
		font-weight: 600;
		color: #f8fafc;
	}

	.current-picker .value {
		color: #f59e0b;
	}

	/* Waiting Layout */
	.waiting-layout {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 1.5rem;
	}

	.waiting-left {
		display: flex;
		flex-direction: column;
	}

	.waiting-right {
		display: flex;
		flex-direction: column;
	}

	.draft-setup-card {
		background: #1e293b;
		padding: 1.5rem;
		border-radius: 0.75rem;
	}

	.draft-setup-card h3 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.recommended-section {
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid #334155;
	}

	.rec-label, .order-label {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.draft-order-section {
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid #334155;
	}

	.start-btn {
		background: #22c55e;
		color: #0f172a;
		border: none;
		padding: 0.875rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 0.5rem;
		cursor: pointer;
		width: 100%;
		margin-top: 1rem;
	}

	.start-btn:hover {
		background: #16a34a;
	}

	.waiting-text {
		font-style: italic;
		color: #64748b !important;
		margin: 1rem 0 0 !important;
		text-align: center;
		font-size: 0.85rem;
	}

	.order-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.order-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #0f172a;
		border-radius: 0.375rem;
		border: 1px solid #334155;
	}

	.order-item.is-you {
		border-color: #22c55e;
		background: #0f2918;
	}

	.order-item.first-pick {
		border-color: #f59e0b;
	}

	.order-item .position {
		width: 1.5rem;
		height: 1.5rem;
		background: #334155;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.order-item.first-pick .position {
		background: #f59e0b;
		color: #0f172a;
	}

	.order-item .name {
		flex: 1;
		color: #f8fafc;
		font-weight: 500;
		font-size: 0.85rem;
	}

	.you-tag, .owner-tag, .first-tag {
		font-size: 0.6rem;
		padding: 0.15rem 0.375rem;
		border-radius: 0.25rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.you-tag { background: #22c55e; color: #0f172a; }
	.owner-tag { background: #334155; color: #94a3b8; }
	.first-tag { background: #f59e0b; color: #0f172a; }

	.settings-desc {
		color: #94a3b8;
		font-size: 0.85rem;
		margin: 0 0 1.25rem;
	}

	.time-label {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.time-options {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.time-option {
		flex: 1;
		padding: 0.625rem;
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 0.375rem;
		color: #94a3b8;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.time-option:hover:not(:disabled) {
		border-color: #22c55e;
		color: #f8fafc;
	}

	.time-option.selected {
		background: #22c55e;
		border-color: #22c55e;
		color: #0f172a;
	}

	.time-option:disabled {
		cursor: default;
	}

	.settings-note {
		margin: 0;
		font-size: 0.75rem;
		color: #64748b;
		text-align: center;
	}

	.rec-pro-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #0f172a;
		padding: 0.75rem;
		border-radius: 0.5rem;
	}

	.rec-pro-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.rec-pro-name {
		font-weight: 600;
		color: #f8fafc;
		font-size: 1rem;
	}

	.rec-pro-meta {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.rec-pick-btn {
		padding: 0.5rem 1rem;
		background: #334155;
		border: none;
		border-radius: 0.375rem;
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: not-allowed;
	}

	.rec-pick-btn:not(:disabled) {
		background: #22c55e;
		color: #0f172a;
		cursor: pointer;
	}



	/* Available Pros Preview Grid */
	.available-pros-preview {
		background: #1e293b;
		padding: 1.25rem;
		border-radius: 0.75rem;
	}

	.available-pros-preview h3 {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.pros-grid-preview {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.pro-card-preview {
		display: flex;
		flex-direction: column;
		padding: 0.625rem;
		background: #0f172a;
		border: 1px solid #334155;
		border-radius: 0.5rem;
		text-align: center;
	}

	.pro-card-preview.recommended {
		border-color: #22c55e;
		background: linear-gradient(135deg, #0f2918 0%, #0f172a 100%);
	}

	.pro-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
	}

	.pro-card-preview .pro-rank {
		font-size: 0.7rem;
		color: #64748b;
	}

	.pro-card-preview.recommended .pro-rank {
		color: #22c55e;
		font-weight: 600;
	}

	.best-badge {
		background: #22c55e;
		color: #0f172a;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.pro-card-preview .pro-name {
		font-weight: 600;
		color: #f8fafc;
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
	}

	.pro-card-preview .pro-meta {
		font-size: 0.7rem;
		color: #64748b;
		margin-bottom: 0.5rem;
	}

	.pick-btn-preview {
		padding: 0.375rem 0.5rem;
		background: #334155;
		border: none;
		border-radius: 0.25rem;
		color: #64748b;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: not-allowed;
		width: 100%;
	}

	/* On The Clock Banner */
	.on-the-clock {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #1e293b;
		border: 2px solid #334155;
		border-radius: 0.75rem;
		padding: 1rem 1.5rem;
		margin-bottom: 1.5rem;
	}

	.on-the-clock.is-you {
		background: linear-gradient(135deg, #0f2918 0%, #1e293b 100%);
		border-color: #22c55e;
	}

	.on-the-clock.is-paused {
		background: linear-gradient(135deg, #1e293b 0%, #2d2006 100%);
		border-color: #f59e0b;
	}

	.clock-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.clock-label {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.clock-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.clock-you {
		color: #22c55e;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.clock-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.clock-timer {
		text-align: right;
	}

	.clock-timer .timer-value {
		font-size: 3rem;
		font-weight: 700;
		color: #22c55e;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.clock-timer.urgent .timer-value {
		color: #ef4444;
		animation: pulse 1s infinite;
	}

	.clock-timer .timer-label {
		display: block;
		font-size: 0.75rem;
		color: #64748b;
	}

	.pause-btn, .resume-btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.pause-btn {
		background: #f59e0b;
		color: #0f172a;
	}

	.pause-btn:hover {
		background: #d97706;
	}

	.resume-btn {
		background: #22c55e;
		color: #0f172a;
	}

	.resume-btn:hover {
		background: #16a34a;
	}

	.paused-indicator {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f59e0b;
		letter-spacing: 0.1em;
	}

	/* Draft Main */
	.draft-main {
		display: grid;
		grid-template-columns: 260px 1fr 280px;
		gap: 1rem;
	}

	/* Teams Column */
	.teams-column h2, .pros-column h2, .history-column h2 {
		font-size: 0.85rem;
		color: #94a3b8;
		margin: 0 0 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.team-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.5rem;
		padding: 0.625rem;
		margin-bottom: 0.5rem;
	}

	.team-card.is-picking {
		border-color: #f59e0b;
		background: linear-gradient(135deg, #1e293b 0%, #2d2006 100%);
	}

	.team-card.is-you {
		border-color: #22c55e;
	}

	.team-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.draft-pos {
		font-size: 0.7rem;
		color: #64748b;
	}

	.team-name {
		flex: 1;
		font-weight: 600;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.you-badge, .picking-badge {
		font-size: 0.6rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-weight: 600;
	}

	.you-badge {
		background: #22c55e;
		color: #0f172a;
	}

	.picking-badge {
		background: #f59e0b;
		color: #0f172a;
	}

	.team-pros {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.team-pros li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.2rem 0;
		font-size: 0.75rem;
		color: #e2e8f0;
	}

	.team-pros .round-num {
		font-size: 0.65rem;
		color: #64748b;
		width: 1.25rem;
	}

	.team-pros .pro-name {
		flex: 1;
	}

	.team-pros .pro-rating {
		color: #64748b;
		font-size: 0.7rem;
	}

	.team-pros li.empty {
		color: #475569;
		font-style: italic;
	}

	/* Pros Column */
	.pros-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.your-pick-badge {
		background: #22c55e;
		color: #0f172a;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		animation: pulse 2s infinite;
	}

	.paused-badge {
		background: #f59e0b;
		color: #0f172a;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.pros-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 500px;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.pro-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.375rem;
		transition: all 0.2s;
	}

	.pro-row.recommended {
		background: linear-gradient(135deg, #0f2918 0%, #1e293b 100%);
		border-color: #22c55e;
	}

	.pro-row.selectable:hover {
		border-color: #22c55e;
		background: #1e3a2f;
	}

	.pro-row .pro-rank {
		font-size: 0.75rem;
		color: #64748b;
		min-width: 2rem;
	}

	.pro-row.recommended .pro-rank {
		color: #22c55e;
		font-weight: 600;
	}

	.pro-row .pro-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.pro-row .pro-name {
		font-weight: 500;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.pro-row .pro-meta {
		display: flex;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.pro-row .pro-gender {
		background: #334155;
		padding: 0 0.25rem;
		border-radius: 0.125rem;
	}

	.rec-badge {
		background: #22c55e;
		color: #0f172a;
		padding: 0.2rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.pick-btn {
		padding: 0.375rem 0.75rem;
		background: #334155;
		border: none;
		border-radius: 0.25rem;
		color: #64748b;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: default;
		min-width: 3.5rem;
	}

	.pick-btn:not(:disabled) {
		background: #22c55e;
		color: #0f172a;
		cursor: pointer;
	}

	.pick-btn:not(:disabled):hover {
		background: #16a34a;
	}

	.pick-btn.recommended:not(:disabled) {
		background: #16a34a;
		animation: pulse 2s infinite;
	}

	/* History Column */
	.history-column {
		background: #1e293b;
		border-radius: 0.75rem;
		padding: 1rem;
	}

	.picks-history {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 500px;
		overflow-y: auto;
	}

	.history-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem;
		background: #0f172a;
		border-radius: 0.375rem;
		border-left: 3px solid #334155;
	}

	.history-item.is-you {
		border-left-color: #22c55e;
	}

	.history-pick-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 2.5rem;
	}

	.history-round {
		font-size: 0.65rem;
		color: #64748b;
	}

	.history-pick {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.history-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.history-user {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.history-pro {
		font-size: 0.85rem;
		color: #22c55e;
		font-weight: 500;
	}

	.no-picks {
		color: #475569;
		font-style: italic;
		text-align: center;
		padding: 2rem;
		font-size: 0.85rem;
	}

	/* Complete Section */
	.complete-section {
		text-align: center;
	}

	.complete-section h2 {
		color: #22c55e;
		margin-bottom: 2rem;
	}

	.final-teams {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.final-team-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 0.5rem;
		padding: 1rem;
		text-align: left;
	}

	.final-team-card.is-you {
		border-color: #22c55e;
	}

	.final-team-card h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		color: #f8fafc;
	}

	.final-team-card ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.final-team-card li {
		display: flex;
		justify-content: space-between;
		padding: 0.375rem 0;
		border-bottom: 1px solid #334155;
		font-size: 0.85rem;
	}

	.final-team-card li:last-child {
		border-bottom: none;
	}

	.pro-meta {
		color: #64748b;
		font-size: 0.75rem;
	}

	@media (max-width: 1024px) {
		.draft-main {
			grid-template-columns: 1fr 1fr;
		}

		.history-column {
			grid-column: span 2;
		}
	}

	@media (max-width: 900px) {
		.waiting-layout {
			grid-template-columns: 1fr;
		}

		.waiting-left {
			order: 1;
		}

		.waiting-right {
			order: 2;
		}
	}

	@media (max-width: 768px) {
		.draft-main {
			grid-template-columns: 1fr;
		}

		.history-column {
			grid-column: span 1;
		}

		.on-the-clock {
			flex-direction: column;
			text-align: center;
			gap: 1rem;
		}

		.clock-timer {
			text-align: center;
		}
	}
</style>
