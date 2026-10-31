// Maximum entries kept in each history array; pushes keep the newest entries.
export const REVIEW_HISTORY_LIMIT = 20; // relationships.review_history
export const LIFECYCLE_HISTORY_LIMIT = 20; // source_records.workbench_lifecycle.history
export const CASE_TIMELINE_LIMIT = 100; // investigation_cases.timeline
export const CASE_MESSAGES_LIMIT = 50; // investigation_cases.messages (25 questions and answers)
export const APPROVAL_DECISIONS_LIMIT = 20; // investigation_cases.approval_decisions
export const CASE_OUTCOMES_LIMIT = 20; // investigation_cases.case_outcomes

// `$push` modifier that appends entries and trims the array to the newest `limit`.
export const pushCapped = (entries, limit) => ({ $each: Array.isArray(entries) ? entries : [entries], $slice: -limit });
