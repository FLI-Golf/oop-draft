import { z } from 'zod';

/**
 * Tournament status enum.
 * scheduled -> live -> halftime -> final
 */
export const TournamentStatusEnum = z.enum(['scheduled', 'live', 'halftime', 'final']);
export type TournamentStatus = z.infer<typeof TournamentStatusEnum>;

/**
 * Tournament half enum.
 * front -> back -> complete
 * Each tournament has 2 halves playing the same 9 holes with adjusted baskets at halftime.
 */
export const TournamentHalfEnum = z.enum(['front', 'back', 'complete']);
export type TournamentHalf = z.infer<typeof TournamentHalfEnum>;

/**
 * Tournament start type enum.
 * - standard: Groups start at hole 1 with staggered tee times (10-min intervals)
 * - shotgun: All groups start simultaneously on different holes
 * - playoff: Special start for tiebreakers
 */
export const TournamentStartTypeEnum = z.enum(['standard', 'shotgun', 'playoff']);
export type TournamentStartType = z.infer<typeof TournamentStartTypeEnum>;

/**
 * Schema for a Tournament.
 */
export const TournamentSchema = z.object({
	id: z.string(),
	name: z.string().min(1, 'Name is required'),
	season_id: z.string(),
	course_id: z.string(),
	status: TournamentStatusEnum.default('scheduled'),
	current_half: TournamentHalfEnum.optional(),
	start_type: TournamentStartTypeEnum.default('standard'),
	start_date: z.string().datetime().optional(),
	end_date: z.string().datetime().optional(),
	prize_pool: z.number().min(0).default(0),
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type Tournament = z.infer<typeof TournamentSchema>;

/**
 * Schema for creating a new Tournament.
 */
export const TournamentCreateSchema = TournamentSchema.omit({
	id: true,
	created: true,
	updated: true,
	status: true,
	current_round: true
});
export type TournamentCreate = z.infer<typeof TournamentCreateSchema>;

/**
 * Schema for updating a Tournament.
 */
export const TournamentUpdateSchema = z.object({
	name: z.string().min(1).optional(),
	start_date: z.string().datetime().optional(),
	end_date: z.string().datetime().optional()
});
export type TournamentUpdate = z.infer<typeof TournamentUpdateSchema>;

// Tournament rounds removed - using front/back halves instead
