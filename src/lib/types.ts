/** A poll as it is shown to voters (never contains the admin token). */
export interface PublicPoll {
	id: string;
	question: string;
	options: string[];
	/** `true` when voters may pick more than one option. */
	multiple: boolean;
	/** `true` when results stay hidden until the visitor has voted. */
	hideResults: boolean;
	/** `true` when the poll is listed on the landing page. */
	listed: boolean;
	/** Epoch milliseconds after which voting stops, or `null` for no deadline. */
	closesAt: number | null;
	/** Epoch milliseconds when the admin closed the poll, or `null`. */
	closedAt: number | null;
	createdAt: number;
	/** Increments on every reset, so votes cast before a reset no longer count. */
	round: number;
}

/** Vote totals for a poll. */
export interface Results {
	/** Votes per option, in option order. */
	counts: number[];
	/** Number of ballots cast (differs from the sum of counts for multiple choice). */
	voters: number;
}

/** Payload sent to browsers over the server-sent events stream. */
export interface LiveUpdate {
	/** `null` when the results are hidden from this visitor. */
	results: Results | null;
	voters: number;
	closed: boolean;
	round: number;
}
