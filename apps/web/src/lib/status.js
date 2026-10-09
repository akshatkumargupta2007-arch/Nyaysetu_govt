// Chip colour per citizen ticket state, and the order officials expect in dropdowns.
export const STATUS_ORDER = [
  'SUBMITTED', 'VERIFIED', 'NEEDS_TRIAGE', 'ASSIGNED', 'TRANSFERRED', 'DISPATCHED',
  'WORK_DONE_PENDING_CONFIRMATION', 'CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REOPENED', 'REJECTED_NOT_CIVIC',
];

export const STATUS_TONE = {
  SUBMITTED: 'grey', VERIFIED: 'blue', NEEDS_TRIAGE: 'amber', ASSIGNED: 'blue', TRANSFERRED: 'amber', DISPATCHED: 'blue',
  WORK_DONE_PENDING_CONFIRMATION: 'amber', CLOSED_CONFIRMED: 'green', CLOSED_UNCONFIRMED: 'grey', REOPENED: 'red', REJECTED_NOT_CIVIC: 'grey',
};

export const VERIFY_TONE = { requested: 'amber', confirmed: 'green', reopened: 'red', unconfirmed: 'grey' };
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const VERIFY_STATES = ['requested', 'confirmed', 'reopened', 'unconfirmed', 'none'];
