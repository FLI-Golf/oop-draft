import { InvalidStateError, ValidationError, UnauthorizedError } from '$lib/core/errors';
import type { FantasyLeague, FantasyLeagueStatus, FantasyParticipant } from '$lib/schemas/fantasy-league.schema';
import type { FantasyTournament } from '$lib/schemas/fantasy-tournament.schema';
import type { FantasyTeam } from '$lib/schemas/fantasy-team.schema';
import type { FantasyPoints, ParticipantPointsSummary } from '$lib/schemas/fantasy-points.schema';

/**
 * FantasyManager - Orchestrates fantasy league operations.
 *
 * Responsibilities:
 * - Manage league lifecycle (setup -> drafting -> active -> complete)
 * - Track participant standings and points
 * - Coordinate tournament scoring
 * - Enforce league rules and permissions
 */
export class FantasyManager {
	private league: FantasyLeague;
	private participants: FantasyParticipant[];
	private tournaments: FantasyTournament[];
	private teams: FantasyTeam[];
	private points: FantasyPoints[];

	constructor(
		league: FantasyLeague,
		participants: FantasyParticipant[] = [],
		tournaments: FantasyTournament[] = [],
		teams: FantasyTeam[] = [],
		points: FantasyPoints[] = []
	) {
		this.league = league;
		this.participants = participants;
		this.tournaments = tournaments;
		this.teams = teams;
		this.points = points;
	}

	// --- League State ---

	get id(): string {
		return this.league.id;
	}

	get name(): string {
		return this.league.name;
	}

	get status(): FantasyLeagueStatus {
		return this.league.status;
	}

	get ownerId(): string {
		return this.league.owner_id;
	}

	get maxParticipants(): number {
		return this.league.max_participants;
	}

	get currentParticipantCount(): number {
		return this.participants.length;
	}

	get spotsRemaining(): number {
		return this.maxParticipants - this.currentParticipantCount;
	}

	get isFull(): boolean {
		return this.currentParticipantCount >= this.maxParticipants;
	}

	get prizePool(): number {
		return this.league.prize_pool;
	}

	get entryFee(): number {
		return this.league.entry_fee;
	}

	// --- Status Checks ---

	get isPendingPlayers(): boolean {
		return this.league.status === 'pending_players';
	}

	get isReady(): boolean {
		return this.league.status === 'ready';
	}

	get isDrafting(): boolean {
		return this.league.status === 'drafting';
	}

	get isActive(): boolean {
		return this.league.status === 'active';
	}

	get isComplete(): boolean {
		return this.league.status === 'complete';
	}

	// --- Permission Checks ---

	isOwner(userId: string): boolean {
		return this.league.owner_id === userId;
	}

	isParticipant(userId: string): boolean {
		return this.participants.some((p) => p.user_id === userId);
	}

	assertOwner(userId: string): void {
		if (!this.isOwner(userId)) {
			throw new UnauthorizedError('Only the league owner can perform this action');
		}
	}

	assertParticipant(userId: string): void {
		if (!this.isParticipant(userId)) {
			throw new UnauthorizedError('You are not a participant in this league');
		}
	}

	// --- Participant Management ---

	getParticipant(userId: string): FantasyParticipant | undefined {
		return this.participants.find((p) => p.user_id === userId);
	}

	getParticipantById(participantId: string): FantasyParticipant | undefined {
		return this.participants.find((p) => p.id === participantId);
	}

	getOwnerParticipant(): FantasyParticipant | undefined {
		return this.participants.find((p) => p.is_owner);
	}

	/**
	 * Check if league can accept new participants.
	 */
	canAcceptParticipants(): boolean {
		return this.isPendingPlayers && !this.isFull;
	}

	/**
	 * Validate adding a new participant.
	 */
	validateJoin(userId: string): string | null {
		if (!this.isPendingPlayers) {
			return 'League is not accepting new participants';
		}
		if (this.isFull) {
			return 'League is full';
		}
		if (this.isParticipant(userId)) {
			return 'Already a participant in this league';
		}
		return null;
	}

	// --- Standings ---

	/**
	 * Get participants sorted by rank/points.
	 */
	getStandings(): FantasyParticipant[] {
		return [...this.participants].sort((a, b) => {
			// Sort by rank if available, otherwise by points
			if (a.rank && b.rank) {
				return a.rank - b.rank;
			}
			return b.total_points - a.total_points;
		});
	}

	/**
	 * Get participant's current rank.
	 */
	getParticipantRank(participantId: string): number {
		const standings = this.getStandings();
		const index = standings.findIndex((p) => p.id === participantId);
		return index >= 0 ? index + 1 : 0;
	}

	/**
	 * Calculate points summary for a participant.
	 */
	getParticipantPointsSummary(participantId: string): ParticipantPointsSummary {
		const participantPoints = this.points.filter((p) => p.participant_id === participantId);

		const bySource = {
			tournament_finish: 0,
			round_score: 0,
			bonus: 0,
			penalty: 0,
			adjustment: 0
		};

		const byPro = new Map<string, number>();

		for (const p of participantPoints) {
			bySource[p.source] = (bySource[p.source] || 0) + p.points;

			const proPoints = byPro.get(p.pro_id) ?? 0;
			byPro.set(p.pro_id, proPoints + p.points);
		}

		const totalPoints = participantPoints.reduce((sum, p) => sum + p.points, 0);

		return {
			participant_id: participantId,
			total_points: totalPoints,
			tournament_points: bySource.tournament_finish,
			round_points: bySource.round_score,
			bonus_points: bySource.bonus,
			penalty_points: bySource.penalty,
			points_by_pro: Array.from(byPro.entries()).map(([pro_id, points]) => ({
				pro_id,
				points
			}))
		};
	}

	// --- Tournament Management ---

	/**
	 * Get all fantasy tournaments.
	 */
	getTournaments(): FantasyTournament[] {
		return [...this.tournaments].sort((a, b) => a.tournament_number - b.tournament_number);
	}

	/**
	 * Get upcoming tournaments.
	 */
	getUpcomingTournaments(): FantasyTournament[] {
		return this.tournaments.filter((t) => t.status === 'upcoming');
	}

	/**
	 * Get completed tournaments.
	 */
	getCompletedTournaments(): FantasyTournament[] {
		return this.tournaments.filter((t) => t.status === 'complete');
	}

	/**
	 * Get current/live tournament.
	 */
	getLiveTournament(): FantasyTournament | undefined {
		return this.tournaments.find((t) => t.status === 'live');
	}

	/**
	 * Get tournament by ID.
	 */
	getTournament(tournamentId: string): FantasyTournament | undefined {
		return this.tournaments.find((t) => t.id === tournamentId);
	}

	// --- Team Management ---

	/**
	 * Get team for a participant.
	 */
	getTeam(participantId: string): FantasyTeam | undefined {
		return this.teams.find((t) => t.participant_id === participantId);
	}

	/**
	 * Get all teams.
	 */
	getAllTeams(): FantasyTeam[] {
		return [...this.teams];
	}

	// --- Lifecycle Validation ---

	/**
	 * Validate transition to ready state.
	 */
	validateReadyTransition(): string | null {
		if (!this.isPendingPlayers) {
			return 'League must be in pending_players status';
		}
		if (!this.isFull) {
			return `League needs ${this.spotsRemaining} more participants`;
		}
		return null;
	}

	/**
	 * Validate starting the draft.
	 */
	validateDraftStart(): string | null {
		if (!this.isReady) {
			return 'League must be in ready status to start draft';
		}
		return null;
	}

	/**
	 * Validate completing the draft.
	 */
	validateDraftComplete(): string | null {
		if (!this.isDrafting) {
			return 'League must be in drafting status';
		}
		// Could add check that all picks are made
		return null;
	}

	/**
	 * Validate completing the league.
	 */
	validateLeagueComplete(): string | null {
		if (!this.isActive) {
			return 'League must be active to complete';
		}
		// Could add check that all tournaments are complete
		return null;
	}

	// --- Prize Pool ---

	/**
	 * Calculate prize pool from paid participants.
	 */
	calculatePrizePool(): number {
		const paidCount = this.participants.filter((p) => p.paid).length;
		return paidCount * this.entryFee;
	}

	/**
	 * Get unpaid participants.
	 */
	getUnpaidParticipants(): FantasyParticipant[] {
		return this.participants.filter((p) => !p.paid);
	}

	// --- Summary ---

	/**
	 * Get league summary for display.
	 */
	getSummary(): {
		id: string;
		name: string;
		status: FantasyLeagueStatus;
		participantCount: number;
		maxParticipants: number;
		prizePool: number;
		tournamentsTotal: number;
		tournamentsCompleted: number;
		currentLeader: string | null;
	} {
		const standings = this.getStandings();
		const leader = standings.length > 0 ? standings[0] : null;

		return {
			id: this.id,
			name: this.name,
			status: this.status,
			participantCount: this.currentParticipantCount,
			maxParticipants: this.maxParticipants,
			prizePool: this.prizePool,
			tournamentsTotal: this.tournaments.length,
			tournamentsCompleted: this.getCompletedTournaments().length,
			currentLeader: leader?.display_name ?? null
		};
	}
}
