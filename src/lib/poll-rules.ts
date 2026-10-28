import type { PublicPoll, Results } from './types';

/** Minimum and maximum number of options a poll can have. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;

/** Outcome of checking a ballot against a poll's rules. */
export type ChoiceCheck = { ok: true; choices: number[] } | { ok: false; reason: string };

/**
 * Checks a ballot against the poll's choice rules.
 *
 * Single-choice polls need exactly one option; multiple-choice polls need at
 * least one. Every index must point at an existing option and duplicates are
 * rejected. On success the choices are returned sorted.
 */
export function checkChoices(
	poll: Pick<PublicPoll, 'options' | 'multiple'>,
	choices: readonly number[]
): ChoiceCheck {
	if (choices.length === 0) return { ok: false, reason: 'Pick an option.' };
	if (!poll.multiple && choices.length > 1) {
		return { ok: false, reason: 'This poll allows only one choice.' };
	}
	const seen = new Set<number>();
	for (const choice of choices) {
		if (!Number.isInteger(choice) || choice < 0 || choice >= poll.options.length) {
			return { ok: false, reason: 'That option does not exist.' };
		}
		if (seen.has(choice)) return { ok: false, reason: 'Each option can be picked once.' };
		seen.add(choice);
	}
	return { ok: true, choices: [...seen].sort((a, b) => a - b) };
}

/** Returns `true` when the poll no longer accepts votes. */
export function isClosed(
	poll: Pick<PublicPoll, 'closesAt' | 'closedAt'>,
	now: number = Date.now()
): boolean {
	return poll.closedAt !== null || (poll.closesAt !== null && poll.closesAt <= now);
}

/**
 * Builds results from the raw Redis vote hash (`{ "0": "3", "voters": "5" }`).
 * Missing or malformed counters count as zero.
 */
export function tallyResults(optionCount: number, raw: Record<string, string>): Results {
	const toCount = (value: string | undefined): number => {
		const n = Number.parseInt(value ?? '0', 10);
		return Number.isFinite(n) && n > 0 ? n : 0;
	};
	const counts = Array.from({ length: optionCount }, (_, i) => toCount(raw[String(i)]));
	return { counts, voters: toCount(raw.voters) };
}

/**
 * Share of the poll's voters who picked each option, as whole percentages.
 * For multiple-choice polls the shares can add up to more than 100.
 */
export function percentages(results: Results): number[] {
	if (results.voters === 0) return results.counts.map(() => 0);
	return results.counts.map((count) => Math.round((count / results.voters) * 100));
}
