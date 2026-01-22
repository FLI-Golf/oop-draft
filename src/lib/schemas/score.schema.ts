import { z } from 'zod';

/**
 * Half enum for scores.
 */
export const ScoreHalfEnum = z.enum(['front', 'back']);
export type ScoreHalf = z.infer<typeof ScoreHalfEnum>;

/**
 * Schema for a HoleScoreEvent.
 * This is an append-only event recording a score entry.
 */
export const HoleScoreEventSchema = z.object({
	id: z.string(),
	tournament_id: z.string(),
	half: ScoreHalfEnum,
	group_id: z.string(),
	pro_id: z.string(),
	hole_number: z.number().int().min(1).max(9), // 9 holes per half
	throws: z.number().int().min(1).max(15), // reasonable bounds
	entered_by_id: z.string(),
	entered_at: z.string().datetime(),
	created: z.string().datetime().optional()
});

export type HoleScoreEvent = z.infer<typeof HoleScoreEventSchema>;

/**
 * Schema for creating a HoleScoreEvent.
 */
export const HoleScoreEventCreateSchema = HoleScoreEventSchema.omit({
	id: true,
	created: true,
	entered_at: true
});
export type HoleScoreEventCreate = z.infer<typeof HoleScoreEventCreateSchema>;

/**
 * Derived scorecard entry (computed from events).
 */
export const ScorecardEntrySchema = z.object({
	pro_id: z.string(),
	hole_number: z.number().int(),
	throws: z.number().int(),
	par: z.number().int(),
	score_to_par: z.number().int() // throws - par
});

export type ScorecardEntry = z.infer<typeof ScorecardEntrySchema>;

/**
 * Pro's scorecard for a half.
 */
export const ProScorecardSchema = z.object({
	pro_id: z.string(),
	half: ScoreHalfEnum,
	entries: z.array(ScorecardEntrySchema),
	total_throws: z.number().int(),
	total_par: z.number().int(),
	score_to_par: z.number().int()
});

export type ProScorecard = z.infer<typeof ProScorecardSchema>;

/**
 * Pro's full tournament scorecard (both halves).
 */
export const ProTournamentScorecardSchema = z.object({
	pro_id: z.string(),
	front: ProScorecardSchema.optional(),
	back: ProScorecardSchema.optional(),
	total_throws: z.number().int(),
	total_par: z.number().int(),
	score_to_par: z.number().int()
});

export type ProTournamentScorecard = z.infer<typeof ProTournamentScorecardSchema>;
