<script lang="ts">
	import { createAuthState } from '$lib/stores/auth.store.svelte';
	import { pb } from '$lib/data/pb/pb.client';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const auth = createAuthState();

	// Multi-step form state (1: group, 2: half, 3: hole, 4: scores, 5: review)
	let step = $state<1 | 2 | 3 | 4 | 5>(1);
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let success = $state('');

	// Data
	let myGroups = $state<any[]>([]);
	let selectedGroup = $state<any | null>(null);
	let selectedHalf = $state<'front' | 'back'>('front');
	let groupTeams = $state<any[]>([]);
	let groupPros = $state<any[]>([]);
	let courseHoles = $state<any[]>([]);
	let existingScores = $state<any[]>([]);

	// Form inputs
	let selectedHoleNumber = $state<number>(1);
	let proScores = $state<Record<string, number>>({});

	onMount(async () => {
		await auth.init();
		if (!auth.isAuthenticated) {
			goto('/');
			return;
		}
		await loadMyGroups();
	});

	async function loadMyGroups() {
		loading = true;
		error = '';
		try {
			// Get groups where current user is scorekeeper
			const groups = await pb.collection('groups').getFullList({
				filter: `scorekeeper_id = '${auth.userId}'`,
				expand: 'tournament_id,team_ids'
			});
			myGroups = groups;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load groups';
		} finally {
			loading = false;
		}
	}

	async function selectGroup(group: any) {
		selectedGroup = group;
		loading = true;
		error = '';

		try {
			// Load teams in this group
			const teamIds = group.team_ids || [];
			if (teamIds.length > 0) {
				const teamFilter = teamIds.map((id: string) => `id = '${id}'`).join(' || ');
				groupTeams = await pb.collection('pro_teams').getFullList({
					filter: teamFilter,
					expand: 'male_pro_id,female_pro_id'
				});

				// Extract pros from teams
				groupPros = [];
				for (const team of groupTeams) {
					if (team.expand?.male_pro_id) {
						groupPros.push({
							...team.expand.male_pro_id,
							teamName: team.name
						});
					}
					if (team.expand?.female_pro_id) {
						groupPros.push({
							...team.expand.female_pro_id,
							teamName: team.name
						});
					}
				}
			}

			// Load course holes for this tournament (9 holes, used for both front and back)
			const tournament = group.expand?.tournament_id;
			if (tournament?.course_id) {
				courseHoles = await pb.collection('holes').getFullList({
					filter: `course_id = '${tournament.course_id}'`,
					sort: 'number'
				});
			}

			// Load existing scores for this group
			existingScores = await pb.collection('hole_score_events').getFullList({
				filter: `group_id = '${group.id}'`,
				sort: '-entered_at'
			});

			// Initialize pro scores
			proScores = {};
			for (const pro of groupPros) {
				proScores[pro.id] = 3; // Default to par-ish
			}

			step = 2;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load group data';
		} finally {
			loading = false;
		}
	}

	function selectHalfAndContinue(half: 'front' | 'back') {
		selectedHalf = half;
		step = 3;
	}

	function selectHole(holeNumber: number) {
		selectedHoleNumber = holeNumber;

		// Pre-fill with existing scores if any (filter by half)
		for (const pro of groupPros) {
			const existing = existingScores.find(
				s => s.pro_id === pro.id && s.hole_number === holeNumber && s.half === selectedHalf
			);
			proScores[pro.id] = existing?.throws ?? 3;
		}

		step = 4;
	}

	function updateProScore(proId: string, delta: number) {
		const current = proScores[proId] ?? 3;
		const newValue = Math.max(1, Math.min(15, current + delta));
		proScores[proId] = newValue;
	}

	function goToReview() {
		step = 5;
	}

	async function submitScores() {
		submitting = true;
		error = '';
		success = '';

		try {
			const now = new Date().toISOString();

			for (const pro of groupPros) {
				await pb.collection('hole_score_events').create({
					tournament_id: selectedGroup.tournament_id,
					half: selectedHalf,
					group_id: selectedGroup.id,
					pro_id: pro.id,
					hole_number: selectedHoleNumber,
					throws: proScores[pro.id],
					entered_by_id: auth.userId,
					entered_at: now
				});
			}

			const displayHole = selectedHalf === 'back' ? selectedHoleNumber + 9 : selectedHoleNumber;
			success = `Scores saved for hole ${displayHole}!`;

			// Reload existing scores
			existingScores = await pb.collection('hole_score_events').getFullList({
				filter: `group_id = '${selectedGroup.id}'`,
				sort: '-entered_at'
			});

			// Go back to hole selection
			setTimeout(() => {
				success = '';
				step = 3;
			}, 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save scores';
		} finally {
			submitting = false;
		}
	}

	function goBack() {
		if (step === 2) {
			selectedGroup = null;
			step = 1;
		} else if (step === 3) {
			step = 2;
		} else if (step === 4) {
			step = 3;
		} else if (step === 5) {
			step = 4;
		}
	}

	function getHoleStatus(holeNumber: number): 'complete' | 'partial' | 'empty' {
		const scoresForHole = existingScores.filter(s => s.hole_number === holeNumber && s.half === selectedHalf);
		if (scoresForHole.length === 0) return 'empty';
		if (scoresForHole.length >= groupPros.length) return 'complete';
		return 'partial';
	}

	function getHalfProgress(half: 'front' | 'back'): { scored: number; total: number } {
		const holesInHalf = courseHoles.length;
		const totalScoresNeeded = holesInHalf * groupPros.length;
		const scoresForHalf = existingScores.filter(s => s.half === half);
		// Count unique hole+pro combinations
		const uniqueScores = new Set(scoresForHalf.map(s => `${s.hole_number}-${s.pro_id}`));
		return { scored: uniqueScores.size, total: totalScoresNeeded };
	}

	function getHolePar(holeNumber: number): number {
		const hole = courseHoles.find(h => h.number === holeNumber);
		return hole?.par ?? 3;
	}

	function formatScoreToPar(throws: number, par: number): string {
		const diff = throws - par;
		if (diff === 0) return 'E';
		if (diff > 0) return `+${diff}`;
		return diff.toString();
	}

	// Display hole number (1-9 for front, 10-18 for back)
	function getDisplayHoleNumber(physicalHole: number): number {
		return selectedHalf === 'back' ? physicalHole + 9 : physicalHole;
	}

	// Format as "9/18" style
	function formatHoleNumber(physicalHole: number): string {
		const display = getDisplayHoleNumber(physicalHole);
		return `${physicalHole}/${display}`;
	}
</script>

<svelte:head>
	<title>Scorekeeper | FLI Golf</title>
</svelte:head>

<main>
	<header>
		<div class="header-content">
			<a href="/" class="logo">FLI Golf</a>
			<h1>Scorekeeper</h1>
		</div>
		{#if step > 1}
			<button class="back-btn" onclick={goBack}>← Back</button>
		{/if}
	</header>

	{#if loading}
		<div class="loading">Loading...</div>
	{:else if error}
		<div class="error-banner">{error}</div>
	{/if}

	{#if success}
		<div class="success-banner">{success}</div>
	{/if}

	<!-- Step 1: Select Group -->
	{#if step === 1}
		<section class="step-section">
			<h2>Select Your Group</h2>
			<p class="step-description">Choose the group you're scoring for today.</p>

			{#if myGroups.length === 0 && !loading}
				<div class="empty-state">
					<p>You're not assigned as a scorekeeper for any groups.</p>
					<p class="hint">Contact the tournament organizer to be assigned.</p>
				</div>
			{:else}
				<div class="group-list">
					{#each myGroups as group}
						<button class="group-card" onclick={() => selectGroup(group)}>
							<div class="group-name">{group.name}</div>
							<div class="group-meta">
								{#if group.tee_time}
									<span class="tee-time">Tee: {new Date(group.tee_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
								{/if}
							</div>
							{#if group.expand?.tournament_id}
								<div class="tournament-name">{group.expand.tournament_id.name}</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Step 2: Select Half -->
	{#if step === 2 && selectedGroup}
		<section class="step-section">
			<h2>Select Half</h2>
			<p class="step-description">
				Scoring <strong>{selectedGroup.name}</strong>
			</p>

			<div class="half-selection">
				{@const frontProgress = getHalfProgress('front')}
				{@const backProgress = getHalfProgress('back')}
				
				<button class="half-card" onclick={() => selectHalfAndContinue('front')}>
					<div class="half-name">Front 9</div>
					<div class="half-progress">
						{frontProgress.scored} / {frontProgress.total} scores
					</div>
					{#if frontProgress.scored === frontProgress.total && frontProgress.total > 0}
						<div class="half-complete">✓ Complete</div>
					{/if}
				</button>

				<button class="half-card" onclick={() => selectHalfAndContinue('back')}>
					<div class="half-name">Back 9</div>
					<div class="half-progress">
						{backProgress.scored} / {backProgress.total} scores
					</div>
					{#if backProgress.scored === backProgress.total && backProgress.total > 0}
						<div class="half-complete">✓ Complete</div>
					{/if}
				</button>
			</div>
		</section>
	{/if}

	<!-- Step 3: Select Hole -->
	{#if step === 3 && selectedGroup}
		<section class="step-section">
			<h2>Select Hole</h2>
			<p class="step-description">
				<strong>{selectedGroup.name}</strong> - <span class="half-label {selectedHalf}">{selectedHalf === 'front' ? 'Holes 1-9' : 'Holes 10-18'}</span>
			</p>

			<div class="hole-grid">
				{#each courseHoles as hole}
					{@const status = getHoleStatus(hole.number)}
					{@const displayNum = selectedHalf === 'back' ? hole.number + 9 : hole.number}
					<button
						class="hole-card {status}"
						onclick={() => selectHole(hole.number)}
					>
						<div class="hole-number">{displayNum}</div>
						<div class="hole-par">Par {hole.par}</div>
						{#if hole.distance}
							<div class="hole-distance">{hole.distance}ft</div>
						{/if}
						{#if status === 'complete'}
							<div class="status-icon">✓</div>
						{:else if status === 'partial'}
							<div class="status-icon partial">◐</div>
						{/if}
					</button>
				{/each}
			</div>

			<div class="legend">
				<span class="legend-item"><span class="dot empty"></span> Not scored</span>
				<span class="legend-item"><span class="dot partial"></span> Partial</span>
				<span class="legend-item"><span class="dot complete"></span> Complete</span>
			</div>
		</section>
	{/if}

	<!-- Step 4: Enter Scores -->
	{#if step === 4 && selectedGroup}
		{@const displayHole = selectedHalf === 'back' ? selectedHoleNumber + 9 : selectedHoleNumber}
		<section class="step-section">
			<h2>Hole {displayHole}</h2>
			<p class="step-description">
				Par {getHolePar(selectedHoleNumber)} • Enter throws for each player
			</p>

			<div class="score-entry-list">
				{#each groupPros as pro}
					{@const throws = proScores[pro.id] ?? 3}
					{@const par = getHolePar(selectedHoleNumber)}
					<div class="score-entry-card">
						<div class="pro-info">
							<div class="pro-name">{pro.first_name} {pro.last_name}</div>
							<div class="team-name">{pro.teamName}</div>
						</div>
						<div class="score-controls">
							<button
								class="score-btn minus"
								onclick={() => updateProScore(pro.id, -1)}
								disabled={throws <= 1}
							>
								−
							</button>
							<div class="score-display">
								<div class="throws">{throws}</div>
								<div class="to-par {throws < par ? 'under' : throws > par ? 'over' : 'even'}">
									{formatScoreToPar(throws, par)}
								</div>
							</div>
							<button
								class="score-btn plus"
								onclick={() => updateProScore(pro.id, 1)}
								disabled={throws >= 15}
							>
								+
							</button>
						</div>
					</div>
				{/each}
			</div>

			<button class="primary-btn" onclick={goToReview}>
				Review Scores
			</button>
		</section>
	{/if}

	<!-- Step 5: Review & Submit -->
	{#if step === 5 && selectedGroup}
		{@const displayHole = selectedHalf === 'back' ? selectedHoleNumber + 9 : selectedHoleNumber}
		<section class="step-section">
			<h2>Review & Submit</h2>
			<p class="step-description">
				Hole {displayHole} • Par {getHolePar(selectedHoleNumber)}
			</p>

			<div class="review-list">
				{#each groupPros as pro}
					{@const throws = proScores[pro.id] ?? 3}
					{@const par = getHolePar(selectedHoleNumber)}
					<div class="review-row">
						<div class="pro-name">{pro.first_name} {pro.last_name}</div>
						<div class="review-score">
							<span class="throws">{throws}</span>
							<span class="to-par {throws < par ? 'under' : throws > par ? 'over' : 'even'}">
								({formatScoreToPar(throws, par)})
							</span>
						</div>
					</div>
				{/each}
			</div>

			<div class="action-buttons">
				<button class="secondary-btn" onclick={() => step = 4}>
					Edit Scores
				</button>
				<button class="primary-btn" onclick={submitScores} disabled={submitting}>
					{submitting ? 'Saving...' : 'Submit Scores'}
				</button>
			</div>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
		background: #0f172a;
		color: #e2e8f0;
	}

	main {
		max-width: 600px;
		margin: 0 auto;
		padding: 0 1rem 2rem;
		min-height: 100vh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 0;
		border-bottom: 1px solid #1e293b;
		margin-bottom: 1.5rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo {
		font-size: 1.25rem;
		font-weight: 700;
		color: #22c55e;
		text-decoration: none;
	}

	header h1 {
		font-size: 1.25rem;
		margin: 0;
		color: #94a3b8;
		font-weight: 400;
	}

	.back-btn {
		background: transparent;
		border: 1px solid #334155;
		color: #94a3b8;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.back-btn:hover {
		background: #1e293b;
		color: #e2e8f0;
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #94a3b8;
	}

	.error-banner {
		background: #7f1d1d;
		color: #fecaca;
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
	}

	.success-banner {
		background: #14532d;
		color: #bbf7d0;
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
	}

	.step-section {
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	h2 {
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
		color: #f8fafc;
	}

	.step-description {
		color: #94a3b8;
		margin: 0 0 1.5rem;
	}

	.step-description strong {
		color: #22c55e;
	}

	/* Step 1: Group Selection */
	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		background: #1e293b;
		border-radius: 1rem;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.hint {
		color: #64748b;
		font-size: 0.875rem;
	}

	.group-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.group-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 1rem;
		padding: 1.25rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s;
		width: 100%;
	}

	.group-card:hover {
		border-color: #22c55e;
		transform: translateY(-2px);
	}

	.group-name {
		font-size: 1.25rem;
		font-weight: 600;
		color: #f8fafc;
		margin-bottom: 0.5rem;
	}

	.group-meta {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.tee-time {
		color: #94a3b8;
		font-size: 0.875rem;
	}

	/* Half Selection */
	.half-selection {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.half-card {
		background: #1e293b;
		border: 2px solid #334155;
		border-radius: 1rem;
		padding: 1.5rem;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		width: 100%;
	}

	.half-card:hover {
		border-color: #22c55e;
		transform: translateY(-2px);
	}

	.half-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f8fafc;
		margin-bottom: 0.5rem;
	}

	.half-progress {
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.half-complete {
		color: #22c55e;
		font-size: 0.875rem;
		font-weight: 600;
		margin-top: 0.5rem;
	}

	.half-label {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		text-transform: uppercase;
		font-weight: 600;
	}

	.half-label.front {
		background: #3b82f6;
		color: white;
	}

	.half-label.back {
		background: #8b5cf6;
		color: white;
	}

	.tournament-name {
		color: #64748b;
		font-size: 0.875rem;
	}

	/* Step 2: Hole Selection */
	.hole-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.hole-card {
		background: #1e293b;
		border: 2px solid #334155;
		border-radius: 0.75rem;
		padding: 1rem;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		position: relative;
	}

	.hole-card:hover {
		border-color: #22c55e;
		transform: scale(1.02);
	}

	.hole-card.complete {
		border-color: #22c55e;
		background: rgba(34, 197, 94, 0.1);
	}

	.hole-card.partial {
		border-color: #fbbf24;
		background: rgba(251, 191, 36, 0.1);
	}

	.hole-number {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.hole-par {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.hole-distance {
		font-size: 0.7rem;
		color: #64748b;
	}

	.status-icon {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 0.875rem;
		color: #22c55e;
	}

	.status-icon.partial {
		color: #fbbf24;
	}

	.legend {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		font-size: 0.75rem;
		color: #64748b;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.dot {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		border: 2px solid;
	}

	.dot.empty {
		border-color: #334155;
		background: transparent;
	}

	.dot.partial {
		border-color: #fbbf24;
		background: rgba(251, 191, 36, 0.3);
	}

	.dot.complete {
		border-color: #22c55e;
		background: rgba(34, 197, 94, 0.3);
	}

	/* Step 3: Score Entry */
	.score-entry-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.score-entry-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 1rem;
		padding: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.pro-info {
		flex: 1;
	}

	.pro-name {
		font-weight: 600;
		color: #f8fafc;
	}

	.team-name {
		font-size: 0.75rem;
		color: #64748b;
	}

	.score-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.score-btn {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: none;
		font-size: 1.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.score-btn.minus {
		background: #ef4444;
		color: white;
	}

	.score-btn.plus {
		background: #22c55e;
		color: white;
	}

	.score-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.score-btn:not(:disabled):hover {
		transform: scale(1.1);
	}

	.score-display {
		width: 4rem;
		text-align: center;
	}

	.throws {
		font-size: 2rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.to-par {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.to-par.under {
		color: #22c55e;
	}

	.to-par.over {
		color: #ef4444;
	}

	.to-par.even {
		color: #94a3b8;
	}

	/* Step 4: Review */
	.review-list {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 1rem;
		overflow: hidden;
		margin-bottom: 1.5rem;
	}

	.review-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #334155;
	}

	.review-row:last-child {
		border-bottom: none;
	}

	.review-score {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.review-score .throws {
		font-size: 1.5rem;
	}

	/* Buttons */
	.primary-btn {
		width: 100%;
		padding: 1rem;
		background: #22c55e;
		color: #0f172a;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.primary-btn:hover:not(:disabled) {
		background: #16a34a;
		transform: translateY(-2px);
	}

	.primary-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.secondary-btn {
		flex: 1;
		padding: 1rem;
		background: transparent;
		color: #94a3b8;
		border: 1px solid #334155;
		border-radius: 0.75rem;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.secondary-btn:hover {
		background: #1e293b;
		color: #e2e8f0;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
	}

	.action-buttons .primary-btn {
		flex: 2;
	}
</style>
