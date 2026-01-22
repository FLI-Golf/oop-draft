import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

/**
 * Create a new PocketBase client for testing.
 */
export function createPB(): PocketBase {
	return new PocketBase(PB_URL);
}

/**
 * Login as a test user and return authenticated PB client.
 */
export async function loginAs(email: string, password: string = 'MADcap(123)'): Promise<PocketBase> {
	const pb = createPB();
	await pb.collection('users').authWithPassword(email, password);
	return pb;
}

/**
 * Get user profile by user ID.
 */
export async function getUserProfile(pb: PocketBase, userId: string) {
	return pb.collection('user_profiles').getFirstListItem(`user_id="${userId}"`);
}

/**
 * Get the 2027 season.
 */
export async function getSeason2027(pb: PocketBase) {
	return pb.collection('seasons').getFirstListItem('year=2027');
}

/**
 * Generate a unique league name for testing.
 */
export function uniqueLeagueName(): string {
	return `Test League ${Date.now()}`;
}

/**
 * Clean up test data (fantasy leagues created during tests).
 */
export async function cleanupTestLeagues(pb: PocketBase, leagueIds: string[]): Promise<void> {
	for (const id of leagueIds) {
		try {
			// Delete participants first (cascade should handle this, but be safe)
			const participants = await pb.collection('fantasy_participants').getFullList({
				filter: `league_id="${id}"`
			});
			for (const p of participants) {
				await pb.collection('fantasy_participants').delete(p.id);
			}
			// Delete fantasy tournaments
			const tournaments = await pb.collection('fantasy_tournaments').getFullList({
				filter: `league_id="${id}"`
			});
			for (const t of tournaments) {
				await pb.collection('fantasy_tournaments').delete(t.id);
			}
			// Delete the league
			await pb.collection('fantasy_leagues').delete(id);
		} catch {
			// Ignore cleanup errors
		}
	}
}
