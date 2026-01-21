import type { Pro } from '$lib/schemas/pro.schema';
import type { ProTeam } from '$lib/schemas/pro-team.schema';

/**
 * Reserve substitution scenarios.
 */
export type ReserveScenario = 'full_round' | 'mid_round';

/**
 * Reserve override state for scoring UI.
 */
export interface ReserveOverride {
	originalProId: string;
	originalProName: string;
	reserveProId: string;
	reserveProName: string;
	scenario: ReserveScenario;
	startingHole: number; // 1 for full_round, >1 for mid_round
	notes?: string;
}

/**
 * Client-side message for scorekeeper guidance.
 */
export interface ScorekeeperMessage {
	type: 'info' | 'warning' | 'action';
	title: string;
	body: string;
	dismissible: boolean;
}

/**
 * ReserveManager - Handles reserve pro substitutions.
 *
 * Reserve teams (is_reserve: true) are not real teams for scoring.
 * When a reserve plays, they replace a regular pro in display only.
 * Points stay with the original pro's team - manual distribution handles edge cases.
 *
 * This keeps the system simple since reserves rarely play.
 */
export class ReserveManager {
	/**
	 * Check if a team is a reserve team.
	 */
	static isReserveTeam(team: ProTeam): boolean {
		return team.is_reserve === true;
	}

	/**
	 * Get reserve teams from a list.
	 */
	static getReserveTeams(teams: ProTeam[]): ProTeam[] {
		return teams.filter((t) => t.is_reserve);
	}

	/**
	 * Get regular (non-reserve) teams from a list.
	 */
	static getRegularTeams(teams: ProTeam[]): ProTeam[] {
		return teams.filter((t) => !t.is_reserve);
	}

	/**
	 * Create a reserve override for full round substitution.
	 * Use when reserve starts from hole 1.
	 */
	static createFullRoundOverride(
		originalPro: Pro,
		reservePro: Pro,
		notes?: string
	): ReserveOverride {
		return {
			originalProId: originalPro.id,
			originalProName: originalPro.name,
			reserveProId: reservePro.id,
			reserveProName: reservePro.name,
			scenario: 'full_round',
			startingHole: 1,
			notes
		};
	}

	/**
	 * Create a reserve override for mid-round substitution.
	 * Use when reserve takes over after play has started.
	 */
	static createMidRoundOverride(
		originalPro: Pro,
		reservePro: Pro,
		startingHole: number,
		notes?: string
	): ReserveOverride {
		return {
			originalProId: originalPro.id,
			originalProName: originalPro.name,
			reserveProId: reservePro.id,
			reserveProName: reservePro.name,
			scenario: 'mid_round',
			startingHole,
			notes
		};
	}

	/**
	 * Get display name for a pro slot, accounting for reserve override.
	 */
	static getDisplayName(pro: Pro, override?: ReserveOverride): string {
		if (!override || override.originalProId !== pro.id) {
			return pro.name;
		}

		if (override.scenario === 'full_round') {
			return `${override.reserveProName} (for ${pro.name})`;
		}

		return `${override.reserveProName} (for ${pro.name} from hole ${override.startingHole})`;
	}

	// --- Client-side messaging for scorekeepers ---

	/**
	 * Message when enabling reserve override.
	 */
	static getOverrideEnabledMessage(override: ReserveOverride): ScorekeeperMessage {
		if (override.scenario === 'full_round') {
			return {
				type: 'info',
				title: 'Reserve Substitution Active',
				body: `${override.reserveProName} is playing the full round in place of ${override.originalProName}. ` +
					`All scores will be entered under ${override.originalProName}'s name for team scoring purposes.`,
				dismissible: true
			};
		}

		return {
			type: 'warning',
			title: 'Mid-Round Substitution Active',
			body: `${override.reserveProName} took over for ${override.originalProName} starting at hole ${override.startingHole}. ` +
				`Scores before hole ${override.startingHole} belong to ${override.originalProName}. ` +
				`Scores from hole ${override.startingHole} onward are played by ${override.reserveProName} but recorded under ${override.originalProName}.`,
			dismissible: false
		};
	}

	/**
	 * Message when scorekeeper needs to manually adjust points.
	 */
	static getManualAdjustmentMessage(override: ReserveOverride): ScorekeeperMessage {
		return {
			type: 'action',
			title: 'Manual Point Adjustment Required',
			body: `After the round, you may need to manually distribute fantasy points between ` +
				`${override.originalProName} and ${override.reserveProName}. ` +
				`The system records all points under ${override.originalProName}'s team. ` +
				`Use the admin panel to make adjustments if needed.`,
			dismissible: true
		};
	}

	/**
	 * Message confirming reserve override is disabled.
	 */
	static getOverrideDisabledMessage(originalProName: string): ScorekeeperMessage {
		return {
			type: 'info',
			title: 'Reserve Substitution Removed',
			body: `Scoring has returned to normal for ${originalProName}.`,
			dismissible: true
		};
	}

	/**
	 * Warning when attempting to score a hole during mid-round sub.
	 */
	static getMidRoundHoleWarning(
		holeNumber: number,
		override: ReserveOverride
	): ScorekeeperMessage | null {
		if (override.scenario !== 'mid_round') {
			return null;
		}

		if (holeNumber < override.startingHole) {
			return {
				type: 'info',
				title: 'Original Player',
				body: `Hole ${holeNumber} was played by ${override.originalProName} (before substitution).`,
				dismissible: true
			};
		}

		return {
			type: 'info',
			title: 'Reserve Player',
			body: `Hole ${holeNumber} is being played by ${override.reserveProName} (recorded under ${override.originalProName}).`,
			dismissible: true
		};
	}

	/**
	 * Get all active messages for current scoring state.
	 */
	static getActiveMessages(
		overrides: ReserveOverride[],
		currentHole?: number
	): ScorekeeperMessage[] {
		const messages: ScorekeeperMessage[] = [];

		for (const override of overrides) {
			messages.push(this.getOverrideEnabledMessage(override));

			if (currentHole !== undefined) {
				const holeWarning = this.getMidRoundHoleWarning(currentHole, override);
				if (holeWarning) {
					messages.push(holeWarning);
				}
			}

			if (override.scenario === 'mid_round') {
				messages.push(this.getManualAdjustmentMessage(override));
			}
		}

		return messages;
	}

	/**
	 * Validate reserve substitution.
	 */
	static validateSubstitution(
		originalPro: Pro,
		reservePro: Pro,
		startingHole: number
	): string | null {
		if (originalPro.id === reservePro.id) {
			return 'Cannot substitute a pro with themselves';
		}

		if (originalPro.gender !== reservePro.gender) {
			return `Reserve must be same gender. ${originalPro.name} is ${originalPro.gender}, ${reservePro.name} is ${reservePro.gender}`;
		}

		if (startingHole < 1 || startingHole > 18) {
			return 'Starting hole must be between 1 and 18';
		}

		return null;
	}
}
