import { z } from 'zod';

/**
 * Schema for a Group (pairing of teams for a tournament).
 * 
 * Groups play both front 9 and back 9 with a halftime break.
 * Staggered tee times (10-min intervals) - e.g., 1:10pm, 1:20pm, 1:30pm...
 * All groups start on hole 1.
 */
export const GroupSchema = z.object({
	id: z.string(),
	tournament_id: z.string(),
	name: z.string().min(1, 'Group name is required'),
	team_ids: z.array(z.string()).min(1).max(4),
	scorekeeper_id: z.string().optional(),
	tee_time: z.string().datetime().optional(),
	starting_hole: z.number().int().min(1).max(18).default(1), // Usually 1, but can vary for shotgun
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
 * Schema for creating groups with default tee times.
 * Groups are spaced 10 minutes apart starting from tournament start_date.
 */
export const GroupCreateWithDefaultsSchema = GroupCreateSchema.extend({
	tee_time: z.string().datetime().optional(), // Will be auto-calculated if not provided
	starting_hole: z.number().int().min(1).max(18).default(1)
});
export type GroupCreateWithDefaults = z.infer<typeof GroupCreateWithDefaultsSchema>;

/**
 * Schema for updating a Group.
 */
export const GroupUpdateSchema = z.object({
	name: z.string().min(1).optional(),
	scorekeeper_id: z.string().optional(),
	tee_time: z.string().datetime().optional()
});
export type GroupUpdate = z.infer<typeof GroupUpdateSchema>;
