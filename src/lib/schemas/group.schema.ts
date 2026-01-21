import { z } from 'zod';

/**
 * Schema for a Group (pairing of teams for a round).
 * 
 * Start types:
 * - standard: Groups start at hole 1 with staggered tee times (10-min intervals)
 * - shotgun: All groups start simultaneously on different holes
 * - playoff: Special start for tiebreakers
 */
export const GroupSchema = z.object({
	id: z.string(),
	tournament_id: z.string(),
	round_id: z.string(),
	name: z.string().min(1, 'Group name is required'),
	team_ids: z.array(z.string()).min(1).max(4),
	scorekeeper_id: z.string().optional(),
	tee_time: z.string().datetime().optional(),
	starting_hole: z.number().int().min(1).max(18).default(1), // For shotgun starts
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type Group = z.infer<typeof GroupSchema>;

/**
 * Schema for creating a Group.
 */
export const GroupCreateSchema = GroupSchema.omit({ id: true, created: true, updated: true });
export type GroupCreate = z.infer<typeof GroupCreateSchema>;

/**
 * Schema for updating a Group.
 */
export const GroupUpdateSchema = z.object({
	name: z.string().min(1).optional(),
	scorekeeper_id: z.string().optional(),
	tee_time: z.string().datetime().optional()
});
export type GroupUpdate = z.infer<typeof GroupUpdateSchema>;
