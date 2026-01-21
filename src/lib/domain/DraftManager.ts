import { InvalidStateError, ValidationError } from '$lib/core/errors';
import type { FantasyLeague } from '$lib/schemas/fantasy-league.schema';
import type { FantasyParticipant } from '$lib/schemas/fantasy-league.schema';
import type { DraftPick, DraftState } from '$lib/schemas/fantasy-team.schema';
import { Pro } from '$lib/domain/Pro';

/**
 * DraftManager - Orchestrates the fantasy draft process.
 *
 * Responsibilities:
 * - Track draft state (current pick, round, participant on clock)
 * - Enforce snake draft order
 * - Filter available pros based on roster composition rules
 * - Provide recommendations for auto-pick
 * - Validate picks before execution
 */
export class DraftManager {
	private league: FantasyLeague;
	private participants: FantasyParticipant[];
	private picks: DraftPick[];
	private availablePros: Pro[];

	constructor(
		league: FantasyLeague,
		participants: FantasyParticipant[],
		picks: DraftPick[],
		availablePros: Pro[]
	) {
		this.league = league;
		this.participants = participants;
		this.picks = picks;
		this.availablePros = availablePros;
	}

	/**
	 * Get current draft state.
	 */
	getState(): DraftState {
		const totalPicks = this.participants.length * this.league.draft_rounds;
		const currentPick = this.picks.length + 1;
		const isComplete = currentPick > totalPicks;

		if (isComplete) {
			return {
				league_id: this.league.id,
				current_round: this.league.draft_rounds,
				current_pick: totalPicks,
				current_participant_id: '',
				is_complete: true
			};
		}

		const { round, draftPosition } = SnakeDraftOrder.getPositionForPick(
			currentPick,
			this.participants.length
		);

		const onClock = this.participants.find((p) => p.draft_position === draftPosition);

		return {
			league_id: this.league.id,
			current_round: round,
			current_pick: currentPick,
			current_participant_id: onClock?.id ?? '',
			is_complete: false
		};
	}

	/**
	 * Check if draft is complete.
	 */
	get isComplete(): boolean {
		return this.getState().is_complete;
	}

	/**
	 * Get participant currently on the clock.
	 */
	getParticipantOnClock(): FantasyParticipant | undefined {
		const state = this.getState();
		return this.participants.find((p) => p.id === state.current_participant_id);
	}

	/**
	 * Get roster for a participant (pros they've drafted).
	 */
	getParticipantRoster(participantId: string): Pro[] {
		const participantPicks = this.picks.filter((p) => p.participant_id === participantId);
		const proIds = new Set(participantPicks.map((p) => p.pro_id));
		return this.availablePros.filter((p) => proIds.has(p.id));
	}

	/**
	 * Get pros still available (not yet drafted).
	 */
	getAvailablePros(): Pro[] {
		const draftedProIds = new Set(this.picks.map((p) => p.pro_id));
		return this.availablePros.filter((p) => !draftedProIds.has(p.id));
	}

	/**
	 * Get filtered pros for a participant based on draft rules.
	 */
	getFilteredProsForParticipant(participantId: string): Pro[] {
		const available = this.getAvailablePros();
		const roster = this.getParticipantRoster(participantId);
		const state = this.getState();

		return DraftRules.filterAvailablePros(available, roster, state.current_round);
	}

	/**
	 * Get recommended pick for a participant.
	 */
	getRecommendation(participantId: string): Pro | null {
		const filtered = this.getFilteredProsForParticipant(participantId);
		if (filtered.length === 0) return null;

		// Sort by rating (highest first)
		const sorted = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
		return sorted[0];
	}

	/**
	 * Validate a pick before execution.
	 */
	validatePick(participantId: string, proId: string): string | null {
		const state = this.getState();

		if (state.is_complete) {
			return 'Draft is complete';
		}

		if (state.current_participant_id !== participantId) {
			return 'Not your turn to pick';
		}

		const available = this.getAvailablePros();
		const pro = available.find((p) => p.id === proId);

		if (!pro) {
			return 'Pro is not available';
		}

		const filtered = this.getFilteredProsForParticipant(participantId);
		if (!filtered.some((p) => p.id === proId)) {
			return 'Pro does not meet roster composition requirements';
		}

		return null;
	}

	/**
	 * Get draft summary for display.
	 */
	getSummary(): {
		totalPicks: number;
		completedPicks: number;
		currentRound: number;
		participantOnClock: string | null;
		isComplete: boolean;
	} {
		const state = this.getState();
		const onClock = this.getParticipantOnClock();

		return {
			totalPicks: this.participants.length * this.league.draft_rounds,
			completedPicks: this.picks.length,
			currentRound: state.current_round,
			participantOnClock: onClock?.display_name ?? null,
			isComplete: state.is_complete
		};
	}

	/**
	 * Get picks for a specific round.
	 */
	getPicksForRound(roundNumber: number): DraftPick[] {
		return this.picks.filter((p) => p.round_number === roundNumber);
	}

	/**
	 * Get all picks for a participant.
	 */
	getPicksForParticipant(participantId: string): DraftPick[] {
		return this.picks.filter((p) => p.participant_id === participantId);
	}

	/**
	 * Get upcoming picks for a participant.
	 */
	getUpcomingPicksForParticipant(participantId: string): number[] {
		const participant = this.participants.find((p) => p.id === participantId);
		if (!participant?.draft_position) return [];

		const state = this.getState();
		const upcoming: number[] = [];

		const order = SnakeDraftOrder.getPickOrder(
			this.participants.length,
			this.league.draft_rounds
		);

		for (const slot of order) {
			if (slot.pick >= state.current_pick && slot.position === participant.draft_position) {
				upcoming.push(slot.pick);
			}
		}

		return upcoming;
	}
}

/**
 * Snake draft order calculator.
 */
export class SnakeDraftOrder {
	/**
	 * Calculate pick order for snake draft.
	 *
	 * Round 1: 1, 2, 3, 4, 5, 6
	 * Round 2: 6, 5, 4, 3, 2, 1
	 * Round 3: 1, 2, 3, 4, 5, 6
	 * etc.
	 */
	static getPickOrder(
		participantCount: number,
		totalRounds: number
	): Array<{ round: number; pick: number; position: number }> {
		const order: Array<{ round: number; pick: number; position: number }> = [];
		let overallPick = 1;

		for (let round = 1; round <= totalRounds; round++) {
			const isEvenRound = round % 2 === 0;

			for (let i = 0; i < participantCount; i++) {
				const position = isEvenRound ? participantCount - i : i + 1;

				order.push({
					round,
					pick: overallPick,
					position
				});

				overallPick++;
			}
		}

		return order;
	}

	/**
	 * Get the participant position for a specific pick.
	 */
	static getPositionForPick(
		pickNumber: number,
		participantCount: number
	): { round: number; positionInRound: number; draftPosition: number } {
		const round = Math.ceil(pickNumber / participantCount);
		const positionInRound = ((pickNumber - 1) % participantCount) + 1;
		const isEvenRound = round % 2 === 0;

		const draftPosition = isEvenRound
			? participantCount - positionInRound + 1
			: positionInRound;

		return { round, positionInRound, draftPosition };
	}

	/**
	 * Get next pick number for a participant.
	 */
	static getNextPickForPosition(
		draftPosition: number,
		participantCount: number,
		currentPick: number,
		totalRounds: number
	): number | null {
		const totalPicks = participantCount * totalRounds;

		for (let pick = currentPick; pick <= totalPicks; pick++) {
			const { draftPosition: pos } = SnakeDraftOrder.getPositionForPick(pick, participantCount);
			if (pos === draftPosition) {
				return pick;
			}
		}

		return null;
	}
}

/**
 * Draft filtering rules.
 */
export class DraftRules {
	/**
	 * Filter available pros based on roster composition and round.
	 *
	 * Rounds 1-2: All available pros
	 * Rounds 3-4: Filter by roster composition
	 *   - If 2 males already: only show females
	 *   - If 2 females already: only show males
	 *   - Otherwise: show all
	 */
	static filterAvailablePros(
		availablePros: Pro[],
		currentRoster: Pro[],
		roundNumber: number,
		maxMales: number = 2,
		maxFemales: number = 2
	): Pro[] {
		// Rounds 1-2: no filtering
		if (roundNumber <= 2) {
			return availablePros;
		}

		// Count current roster composition
		const maleCount = currentRoster.filter((p) => p.isMale).length;
		const femaleCount = currentRoster.filter((p) => p.isFemale).length;

		// If at max males, only show females
		if (maleCount >= maxMales) {
			return availablePros.filter((p) => p.isFemale);
		}

		// If at max females, only show males
		if (femaleCount >= maxFemales) {
			return availablePros.filter((p) => p.isMale);
		}

		// Otherwise show all
		return availablePros;
	}

	/**
	 * Validate a draft pick.
	 */
	static validatePick(
		proId: string,
		availablePros: Pro[],
		currentRoster: Pro[],
		roundNumber: number
	): string | null {
		// Check pro is available
		const pro = availablePros.find((p) => p.id === proId);
		if (!pro) {
			return 'Pro is not available';
		}

		// Check pro passes filter
		const filtered = DraftRules.filterAvailablePros(availablePros, currentRoster, roundNumber);
		if (!filtered.some((p) => p.id === proId)) {
			return 'Pro does not meet roster composition requirements';
		}

		return null;
	}
}
