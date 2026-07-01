<script lang="ts">
	import { createAuthState } from '$lib/stores/auth.store.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const auth = createAuthState();

	// Auth modal state
	let showAuthModal = $state(false);
	let authMode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let displayName = $state('');
	let formError = $state('');
	let formLoading = $state(false);

	onMount(() => {
		auth.init();
	});

	function openLogin() {
		authMode = 'login';
		showAuthModal = true;
		clearForm();
	}

	function openRegister() {
		authMode = 'register';
		showAuthModal = true;
		clearForm();
	}

	function closeModal() {
		showAuthModal = false;
		clearForm();
	}

	function clearForm() {
		email = '';
		password = '';
		passwordConfirm = '';
		displayName = '';
		formError = '';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		formError = '';
		formLoading = true;

		try {
			if (authMode === 'login') {
				await auth.login(email, password);
			} else {
				await auth.register(email, password, passwordConfirm, displayName);
			}
			closeModal();
			goto('/user/dashboard');
		} catch (err) {
			formError = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			formLoading = false;
		}
	}

	const features = [
		{
			title: 'Create Your League',
			description: 'Purchase a fantasy league and become the owner. Set entry fees and invite friends.',
			icon: '🏆'
		},
		{
			title: 'Live Scoring',
			description: 'Watch your points accumulate as real tournaments unfold throughout the season.',
			icon: '⛳'
		},
		{
			title: 'Win Prizes',
			description: 'Compete for the prize pool. Multiple payout structures available.',
			icon: '💰'
		}
	];

	const workflow = [
		{ step: 1, title: 'Owner Creates League', status: 'pending_players' },
		{ step: 2, title: 'Players Request to Join', status: 'pending_players' },
		{ step: 3, title: 'Owner Approves Players', status: 'pending_players' },
		{ step: 4, title: 'League Fills (6/6)', status: 'ready' },
		{ step: 5, title: 'Draft Your Team', status: 'drafting' },
		{ step: 6, title: 'Season Begins', status: 'active' }
	];
</script>

<!-- Auth Modal -->
{#if showAuthModal}
	<div class="modal-overlay" onclick={closeModal} onkeydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0">
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" aria-modal="true" tabindex="-1">
			<button class="modal-close" onclick={closeModal}>&times;</button>
			<h2>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
			
			<form onsubmit={handleSubmit}>
				{#if authMode === 'register'}
					<div class="form-field">
						<label for="displayName">Display Name</label>
						<input 
							id="displayName" 
							type="text" 
							bind:value={displayName} 
							placeholder="Your name"
							required 
						/>
					</div>
				{/if}

				<div class="form-field">
					<label for="email">Email</label>
					<input 
						id="email" 
						type="email" 
						bind:value={email} 
						placeholder="you@example.com"
						required 
					/>
				</div>

				<div class="form-field">
					<label for="password">Password</label>
					<input 
						id="password" 
						type="password" 
						bind:value={password} 
						placeholder="••••••••"
						required 
						minlength="8"
					/>
				</div>

				{#if authMode === 'register'}
					<div class="form-field">
						<label for="passwordConfirm">Confirm Password</label>
						<input 
							id="passwordConfirm" 
							type="password" 
							bind:value={passwordConfirm} 
							placeholder="••••••••"
							required 
						/>
					</div>
				{/if}

				{#if formError}
					<div class="form-error">{formError}</div>
				{/if}

				<button type="submit" class="submit-btn" disabled={formLoading}>
					{formLoading ? 'Loading...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
				</button>
			</form>

			<p class="auth-switch">
				{#if authMode === 'login'}
					Don't have an account? <button class="link-btn" onclick={openRegister}>Sign up</button>
				{:else}
					Already have an account? <button class="link-btn" onclick={openLogin}>Sign in</button>
				{/if}
			</p>
		</div>
	</div>
{/if}

<main>
	<!-- Header with auth -->
	<header>
		<div class="logo">FLI Golf</div>
		<nav>
			{#if auth.isAuthenticated}
				<span class="user-greeting">Welcome, {auth.profile?.display_name ?? 'Player'}</span>
				<button class="nav-btn" onclick={() => auth.logout()}>Sign Out</button>
			{:else}
				<button class="nav-btn" onclick={openLogin}>Sign In</button>
				<button class="nav-btn primary-nav" onclick={openRegister}>Sign Up</button>
			{/if}
		</nav>
	</header>

	<section class="hero">
		<h1>FLI Golf Fantasy League</h1>
		<p class="tagline">Draft your pros. Compete with friends. Win big.</p>
		<div class="cta-buttons">
			{#if auth.isAuthenticated}
				<button class="primary">Create a League</button>
				<button class="secondary">Join a League</button>
			{:else}
				<button class="primary" onclick={openRegister}>Get Started</button>
				<button class="secondary" onclick={openLogin}>Sign In</button>
			{/if}
		</div>
	</section>

	<section class="features">
		<h2>How It Works</h2>
		<div class="feature-grid">
			{#each features as feature}
				<div class="feature-card">
					<span class="icon">{feature.icon}</span>
					<h3>{feature.title}</h3>
					<p>{feature.description}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="workflow">
		<h2>League Workflow</h2>
		<div class="workflow-steps">
			{#each workflow as item}
				<div class="workflow-step">
					<div class="step-number">{item.step}</div>
					<div class="step-content">
						<h4>{item.title}</h4>
						<span class="status-badge {item.status}">{item.status.replace('_', ' ')}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="scoring">
		<h2>Scoring System</h2>
		<div class="scoring-grid">
			<div class="scoring-category">
				<h3>Tournament Finish</h3>
				<ul>
					<li>1st Place: 100 pts</li>
					<li>2nd Place: 75 pts</li>
					<li>3rd Place: 60 pts</li>
					<li>Top 10: 20-50 pts</li>
				</ul>
			</div>
			<div class="scoring-category">
				<h3>Round Scoring</h3>
				<ul>
					<li>Eagle: +5 pts</li>
					<li>Birdie: +3 pts</li>
					<li>Bogey: -1 pt</li>
					<li>Double+: -2 pts</li>
				</ul>
			</div>
			<div class="scoring-category">
				<h3>Bonuses</h3>
				<ul>
					<li>Hole-in-One: +25 pts</li>
					<li>Round Leader: +5 pts</li>
					<li>Team Bonus: +10 pts</li>
				</ul>
			</div>
		</div>
	</section>

	<section class="tech-stack">
		<h2>Built With</h2>
		<div class="tech-badges">
			<span class="badge">SvelteKit 5</span>
			<span class="badge">TypeScript</span>
			<span class="badge">PocketBase</span>
			<span class="badge">Zod</span>
		</div>
	</section>

	<footer>
		<p>FLI Golf Fantasy League &copy; 2026</p>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		background: #0b1222;
		color: #e2e8f0;
	}

	:global(*) {
		box-sizing: border-box;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	/* Header */
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 57px;
		padding: 0 1rem;
	}

	.logo {
		font-size: 1.45rem;
		font-weight: 800;
		letter-spacing: 0;
		color: #2dce6f;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.user-greeting {
		color: #94a3b8;
		font-size: 0.9rem;
	}

	.nav-btn {
		background: transparent;
		color: #f8fafc;
		border: none;
		padding: 0.62rem 1.2rem;
		font-size: 0.86rem;
		cursor: pointer;
		border-radius: 0.38rem;
		transition: background 0.2s;
		font-weight: 800;
	}

	.nav-btn:hover {
		background: #17243a;
	}

	.primary-nav {
		background: #31c96b;
		color: #050a14;
	}

	.primary-nav:hover {
		background: #23b85f;
	}

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
		max-width: 400px;
		position: relative;
		border: 1px solid #334155;
	}

	.modal h2 {
		margin: 0 0 1.5rem;
		text-align: center;
		color: #f8fafc;
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

	.modal-close:hover {
		color: #f8fafc;
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

	.form-field input::placeholder {
		color: #64748b;
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
		transition: background 0.2s;
	}

	.submit-btn:hover:not(:disabled) {
		background: #16a34a;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.auth-switch {
		text-align: center;
		margin-top: 1.5rem;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: #22c55e;
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0;
		text-decoration: underline;
	}

	.link-btn:hover {
		color: #16a34a;
	}

	/* Hero */
	.hero {
		text-align: center;
		min-height: 318px;
		padding: 4.65rem 1rem 3.85rem;
		background: linear-gradient(112deg, #1f3f65 0%, #111c31 72%);
		border-radius: 0 0 1.9rem 1.9rem;
		margin-bottom: 3.35rem;
	}

	h1 {
		font-size: clamp(2.25rem, 4vw, 3rem);
		margin: 0;
		background: linear-gradient(90deg, #2bd36f, #25c58f);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 900;
		letter-spacing: 0;
		line-height: 1.12;
	}

	.tagline {
		font-size: 1.25rem;
		color: #9bb7d6;
		margin: 1.3rem 0 2rem;
	}

	.cta-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	button {
		min-width: 120px;
		padding: 0.9rem 2rem;
		font-size: 1rem;
		border-radius: 0.4rem;
		cursor: pointer;
		font-weight: 800;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	button:hover {
		transform: translateY(-2px);
	}

	.primary {
		background: #31c96b;
		color: #050a14;
		border: none;
	}

	.primary:hover {
		box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
	}

	.secondary {
		background: transparent;
		color: #31d976;
		border: 2px solid #13d779;
	}

	.secondary:hover {
		background: rgba(34, 197, 94, 0.1);
	}

	/* Sections */
	section {
		margin-bottom: 4.25rem;
	}

	h2 {
		text-align: center;
		font-size: 2rem;
		margin: 0 0 2rem;
		color: #f8fafc;
		font-weight: 900;
		letter-spacing: 0;
	}

	/* Features */
	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.feature-card {
		min-height: 192px;
		background: #1b2638;
		padding: 1.9rem 1.9rem 1.6rem;
		border-radius: 0.9rem;
		text-align: center;
		border: 1px solid #324158;
		transition: border-color 0.2s;
	}

	.feature-card:hover {
		border-color: #22c55e;
	}

	.icon {
		font-size: 2.5rem;
		display: block;
		margin-bottom: 1.05rem;
	}

	.feature-card h3 {
		margin: 0 0 0.62rem;
		color: #f8fafc;
		font-size: 1.15rem;
		font-weight: 900;
	}

	.feature-card p {
		margin: 0;
		color: #a5bfdd;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	/* Workflow */
	.workflow-steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(178px, 1fr));
		gap: 1rem;
	}

	.workflow-step {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 68px;
		background: #1b2638;
		padding: 0.9rem 1rem;
		border-radius: 0.75rem;
		border: 1px solid #324158;
	}

	.step-number {
		width: 2rem;
		height: 2rem;
		flex: 0 0 2rem;
		background: #31d36f;
		color: #06111b;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
	}

	.step-content h4 {
		margin: 0;
		font-size: 0.86rem;
		color: #f8fafc;
		font-weight: 900;
		line-height: 1.15;
	}

	.status-badge {
		font-size: 0.7rem;
		display: inline-block;
		margin-top: 0.38rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		text-transform: uppercase;
		font-weight: 800;
	}

	.status-badge.pending_players { background: #fbbf24; color: #0f172a; }
	.status-badge.ready { background: #3b82f6; color: white; }
	.status-badge.drafting { background: #8b5cf6; color: white; }
	.status-badge.active { background: #22c55e; color: #0f172a; }

	/* Scoring */
	.scoring-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	.scoring-category {
		background: #1e293b;
		padding: 1.5rem;
		border-radius: 0.75rem;
		border: 1px solid #334155;
	}

	.scoring-category h3 {
		margin: 0 0 1rem;
		color: #22c55e;
		font-size: 1.1rem;
	}

	.scoring-category ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.scoring-category li {
		padding: 0.4rem 0;
		color: #cbd5e1;
		font-size: 0.9rem;
		border-bottom: 1px solid #334155;
	}

	.scoring-category li:last-child {
		border-bottom: none;
	}

	/* Tech Stack */
	.tech-badges {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.badge {
		background: #334155;
		color: #e2e8f0;
		padding: 0.5rem 1rem;
		border-radius: 2rem;
		font-size: 0.9rem;
		font-weight: 500;
	}

	/* Footer */
	footer {
		text-align: center;
		padding: 2rem;
		color: #64748b;
		border-top: 1px solid #1e293b;
	}

	/* Responsive */
	@media (max-width: 640px) {
		h1 {
			font-size: 2rem;
		}

		.tagline {
			font-size: 1rem;
		}

		.workflow-steps {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
