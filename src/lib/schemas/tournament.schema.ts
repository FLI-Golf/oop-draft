import { z } from 'zod';

/**
 * Tournament status enum.
 * scheduled -> live -> halftime -> final
 */
export const TournamentStatusEnum = z.enum(['scheduled', 'live', 'halftime', 'final']);
export type TournamentStatus = z.infer<typeof TournamentStatusEnum>;

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
	start_type: TournamentStartTypeEnum.default('standard'),
	start_date: z.string().datetime().optional(),
	end_date: z.string().datetime().optional(),
	current_round: z.number().int().min(0).default(0),
	total_rounds: z.number().int().min(1).max(4).default(2),
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

/**
 * Schema for a Tournament Round.
 */
export const TournamentRoundSchema = z.object({
	id: z.string(),
	tournament_id: z.string(),
	round_number: z.number().int().min(1),
	status: z.enum(['pending', 'in_progress', 'complete']).default('pending'),
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type TournamentRound = z.infer<typeof TournamentRoundSchema>;

/**
 * Schema for creating a Tournament Round.
 */
export const TournamentRoundCreateSchema = TournamentRoundSchema.omit({
	id: true,
	created: true,
	updated: true,
	status: true
});
export type TournamentRoundCreate = z.infer<typeof TournamentRoundCreateSchema>;
