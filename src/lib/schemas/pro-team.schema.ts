import { z } from 'zod';

/**
 * Schema for a Pro Team (actual disc golf team that pros belong to).
 * Not to be confused with fantasy teams or tournament teams.
 * 
 * Regular teams have 2 pros (1 male + 1 female).
 * Reserve teams have 1 pro for injury/absence coverage.
 */
export const ProTeamSchema = z.object({
	id: z.string(),
	team_name: z.string().min(1, 'Team name is required'),
	team_size: z.number().int().min(1).max(2),
	team_earnings: z.number().default(0),
	team_points: z.number().default(0),
	is_reserve: z.boolean().default(false),
	season_id: z.string().optional(),
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type ProTeam = z.infer<typeof ProTeamSchema>;

/**
 * Schema for creating a new Pro Team.
 */
export const ProTeamCreateSchema = ProTeamSchema.omit({
	id: true,
	created: true,
	updated: true,
	team_earnings: true,
	team_points: true
});
export type ProTeamCreate = z.infer<typeof ProTeamCreateSchema>;

/**
 * Schema for updating a Pro Team.
 */
export const ProTeamUpdateSchema = z.object({
	team_name: z.string().min(1).optional(),
	team_earnings: z.number().optional(),
	team_points: z.number().optional()
});
export type ProTeamUpdate = z.infer<typeof ProTeamUpdateSchema>;

/**
 * Schema for Pro Team season history (archived at end of season).
 */
export const ProTeamHistorySchema = z.object({
	id: z.string(),
	pro_team_id: z.string(),
	season_id: z.string(),
	team_name: z.string(),
	final_earnings: z.number(),
	final_points: z.number(),
	final_rank: z.number().int().optional(),
	pro_ids: z.array(z.string()), // Snapshot of pros on team that season
	created: z.string().datetime().optional()
});

export type ProTeamHistory = z.infer<typeof ProTeamHistorySchema>;

/**
 * Reserve substitution scenario.
 */
export const ReserveScenarioEnum = z.enum(['full_round', 'mid_round']);
export type ReserveScenario = z.infer<typeof ReserveScenarioEnum>;

/**
 * Schema for a reserve override during scoring.
 * Tracks when a reserve pro plays in place of a regular pro.
 */
export const ReserveOverrideSchema = z.object({
	id: z.string(),
	tournament_id: z.string(),
	round_id: z.string(),
	original_pro_id: z.string(),
	reserve_pro_id: z.string(),
	scenario: ReserveScenarioEnum,
	starting_hole: z.number().int().min(1).max(18),
	notes: z.string().optional(),
	created_by_id: z.string(),
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type ReserveOverride = z.infer<typeof ReserveOverrideSchema>;

/**
 * Schema for creating a reserve override.
 */
export const ReserveOverrideCreateSchema = ReserveOverrideSchema.omit({
	id: true,
	created: true,
	updated: true
});
export type ReserveOverrideCreate = z.infer<typeof ReserveOverrideCreateSchema>;
