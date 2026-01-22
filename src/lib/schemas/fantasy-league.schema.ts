import { z } from 'zod';

/**
 * Fantasy League status enum.
 * pending_payment -> pending_players -> ready -> drafting -> active -> complete
 */
export const FantasyLeagueStatusEnum = z.enum([
	'pending_payment', // Waiting for payment confirmation
	'pending_players', // Paid, waiting for participants to join
	'ready', // All spots filled (6/6), ready to configure/draft
	'drafting', // Draft in progress
	'active', // Season in progress
	'complete' // Season finished
]);
export type FantasyLeagueStatus = z.infer<typeof FantasyLeagueStatusEnum>;

/**
 * Payment method enum.
 */
export const PaymentMethodEnum = z.enum(['stripe', 'other']);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

/**
 * Payment status enum.
 */
export const PaymentStatusEnum = z.enum(['pending', 'paid']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

/**
 * Schema for a Fantasy League.
 * 
 * Flow:
 * 1. User purchases league (stripe/other) -> pending_payment
 * 2. Payment confirmed -> pending_players (owner is participant 1/6)
 * 3. Owner invites via email -> participants request to join
 * 4. Owner approves 5 requests -> ready (6/6)
 * 5. System creates fantasy_tournaments with random draft orders
 * 6. Draft begins -> drafting
 * 7. Season starts -> active
 * 8. Season ends -> complete
 */
export const FantasyLeagueSchema = z.object({
	id: z.string(),
	name: z.string().min(1, 'Name is required'),
	season_id: z.string(),
	owner_id: z.string(), // User who purchased/created the league
	status: FantasyLeagueStatusEnum.default('pending_payment'),
	max_participants: z.number().int().min(2).max(20).default(6),
	current_participants: z.number().int().default(1), // Owner counts as 1
	draft_rounds: z.number().int().min(1).max(10).default(4),
	seconds_per_pick: z.number().int().min(30).max(300).default(90),
	entry_fee: z.number().min(0).default(0),
	prize_pool: z.number().min(0).default(0),
	draft_start_time: z.string().datetime().optional(),
	auto_pick_enabled: z.boolean().default(true),
	// Payment fields
	payment_method: PaymentMethodEnum.optional(),
	payment_status: PaymentStatusEnum.default('pending'),
	stripe_payment_id: z.string().optional(),
	// Invite tracking
	invited_emails: z.array(z.string().email()).default([]),
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type FantasyLeague = z.infer<typeof FantasyLeagueSchema>;

/**
 * Schema for creating a Fantasy League (when owner purchases).
 */
export const FantasyLeagueCreateSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	season_id: z.string(),
	owner_id: z.string(),
	max_participants: z.number().int().min(2).max(20).default(6),
	entry_fee: z.number().min(0).default(0),
	payment_method: PaymentMethodEnum
});
export type FantasyLeagueCreate = z.infer<typeof FantasyLeagueCreateSchema>;

/**
 * Schema for inviting participants to a league.
 */
export const FantasyLeagueInviteSchema = z.object({
	emails: z.array(z.string().email()).min(1).max(10)
});
export type FantasyLeagueInvite = z.infer<typeof FantasyLeagueInviteSchema>;

/**
 * Schema for league settings (owner can adjust).
 */
export const FantasyLeagueSettingsSchema = z.object({
	name: z.string().min(1).optional(),
	draft_rounds: z.number().int().min(1).max(10).optional(),
	seconds_per_pick: z.number().int().min(30).max(300).optional(),
	auto_pick_enabled: z.boolean().optional(),
	draft_start_time: z.string().datetime().optional()
});
export type FantasyLeagueSettings = z.infer<typeof FantasyLeagueSettingsSchema>;

/**
 * Join request status.
 */
export const JoinRequestStatusEnum = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export type JoinRequestStatus = z.infer<typeof JoinRequestStatusEnum>;

/**
 * Schema for a Join Request.
 */
export const JoinRequestSchema = z.object({
	id: z.string(),
	league_id: z.string(),
	user_id: z.string(),
	display_name: z.string().min(1),
	message: z.string().optional(), // Optional message to owner
	status: JoinRequestStatusEnum.default('pending'),
	responded_at: z.string().datetime().optional(),
	created: z.string().datetime().optional()
});

export type JoinRequest = z.infer<typeof JoinRequestSchema>;

/**
 * Schema for creating a Join Request.
 */
export const JoinRequestCreateSchema = JoinRequestSchema.omit({
	id: true,
	created: true,
	status: true,
	responded_at: true
});
export type JoinRequestCreate = z.infer<typeof JoinRequestCreateSchema>;

/**
 * Schema for a Fantasy Participant (approved member of a league).
 */
export const FantasyParticipantSchema = z.object({
	id: z.string(),
	league_id: z.string(),
	user_id: z.string(),
	display_name: z.string().min(1),
	is_owner: z.boolean().default(false),
	draft_position: z.number().int().min(1).optional(),
	total_points: z.number().default(0),
	rank: z.number().int().min(1).optional(),
	paid: z.boolean().default(false),
	joined_at: z.string().datetime().optional(),
	created: z.string().datetime().optional(),
	updated: z.string().datetime().optional()
});

export type FantasyParticipant = z.infer<typeof FantasyParticipantSchema>;

/**
 * Schema for creating a Fantasy Participant.
 */
export const FantasyParticipantCreateSchema = z.object({
	league_id: z.string(),
	user_id: z.string(),
	display_name: z.string().min(1),
	is_owner: z.boolean().default(false),
	paid: z.boolean().default(false)
});
export type FantasyParticipantCreate = z.infer<typeof FantasyParticipantCreateSchema>;
