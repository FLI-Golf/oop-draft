<script lang="ts">
	import { createAuthState } from '$lib/stores/auth.store.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const auth = createAuthState();

	let { children } = $props();

	onMount(async () => {
		await auth.init();
		if (!auth.isAuthenticated) {
			goto('/');
		}
	});
</script>

{#if auth.isAuthenticated}
	<div class="user-layout">
		<header>
			<a href="/" class="logo">FLI Golf</a>
			<nav>
				<a href="/user/dashboard" class="nav-link">Dashboard</a>
				<span class="user-name">{auth.profile?.display_name ?? 'Player'}</span>
				<button class="nav-btn" onclick={() => { auth.logout(); goto('/'); }}>Sign Out</button>
			</nav>
		</header>
		<main>
			{@render children()}
		</main>
	</div>
{:else}
	<div class="loading">Loading...</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, sans-serif;
		background: #0f172a;
		color: #e2e8f0;
	}

	.user-layout {
		min-height: 100vh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: #1e293b;
		border-bottom: 1px solid #334155;
	}

	.logo {
		font-size: 1.5rem;
		font-weight: 700;
		color: #22c55e;
		text-decoration: none;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.nav-link {
		color: #94a3b8;
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s;
	}

	.nav-link:hover {
		color: #f8fafc;
	}

	.user-name {
		color: #e2e8f0;
		font-weight: 500;
	}

	.nav-btn {
		background: transparent;
		color: #94a3b8;
		border: 1px solid #334155;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		cursor: pointer;
		border-radius: 0.375rem;
		transition: all 0.2s;
	}

	.nav-btn:hover {
		background: #334155;
		color: #f8fafc;
	}

	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		color: #94a3b8;
	}
</style>
