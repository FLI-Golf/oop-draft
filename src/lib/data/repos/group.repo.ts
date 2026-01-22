import { pb } from '$lib/data/pb/pb.client';
import { NotFoundError } from '$lib/core/errors';
import { GroupSchema, type Group, type GroupCreate, type GroupUpdate, type GroupHalf } from '$lib/schemas/group.schema';

/**
 * Repository for Group persistence.
 */
export const GroupRepo = {
	/**
	 * Get all groups for a tournament half.
	 */
	async getByTournamentAndHalf(tournamentId: string, half: GroupHalf): Promise<Group[]> {
		const records = await pb.collection('groups').getFullList({
			filter: `tournament_id = "${tournamentId}" && half = "${half}"`
		});
		return records.map((r) => GroupSchema.parse(r));
	},

	/**
	 * Get all groups for a tournament.
	 */
	async getByTournamentId(tournamentId: string): Promise<Group[]> {
		const records = await pb.collection('groups').getFullList({
			filter: `tournament_id = "${tournamentId}"`
		});
		return records.map((r) => GroupSchema.parse(r));
	},

	/**
	 * Get a group by ID.
	 */
	async getById(id: string): Promise<Group> {
		try {
			const record = await pb.collection('groups').getOne(id);
			return GroupSchema.parse(record);
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
				throw new NotFoundError('Group', id);
			}
			throw err;
		}
	},

	/**
	 * Get groups assigned to a scorekeeper.
	 */
	async getByScorekeeperIdAndTournament(scorekeeperId: string, tournamentId: string): Promise<Group[]> {
		const records = await pb.collection('groups').getFullList({
			filter: `scorekeeper_id = "${scorekeeperId}" && tournament_id = "${tournamentId}"`
		});
		return records.map((r) => GroupSchema.parse(r));
	},

	/**
	 * Get all groups for a scorekeeper (across all tournaments).
	 */
	async getByScorekeeperId(scorekeeperId: string): Promise<Group[]> {
		const records = await pb.collection('groups').getFullList({
			filter: `scorekeeper_id = "${scorekeeperId}"`
		});
		return records.map((r) => GroupSchema.parse(r));
	},

	/**
	 * Create a group.
	 */
	async create(data: GroupCreate): Promise<Group> {
		const record = await pb.collection('groups').create(data);
		return GroupSchema.parse(record);
	},

	/**
	 * Update a group.
	 */
	async update(id: string, data: GroupUpdate): Promise<Group> {
		const record = await pb.collection('groups').update(id, data);
		return GroupSchema.parse(record);
	},

	/**
	 * Assign a scorekeeper to a group.
	 */
	async assignScorekeeper(id: string, scorekeeperId: string): Promise<Group> {
		const record = await pb.collection('groups').update(id, { scorekeeper_id: scorekeeperId });
		return GroupSchema.parse(record);
	},

	/**
	 * Delete a group.
	 */
	async delete(id: string): Promise<void> {
		await pb.collection('groups').delete(id);
	},

	/**
	 * Delete all groups for a tournament.
	 */
	async deleteByTournamentId(tournamentId: string): Promise<void> {
		const groups = await pb.collection('groups').getFullList({
			filter: `tournament_id = "${tournamentId}"`
		});
		for (const group of groups) {
			await pb.collection('groups').delete(group.id);
		}
	}
};
