/**
 * The KSM Position Index.
 *
 * Deliberately NOT a 0–100 score presented as a headline number — that reads as
 * a credit score and invites exactly the comparison the practice spends the
 * rest of the site rejecting. The overall result is a lettered band with a
 * plain-language descriptor. Component values stay numeric because they are
 * inputs the visitor can move, not a rating of them.
 */

export interface Band {
  min: number;
  letter: string;
  label: string;
  /** One line describing what this band means in practice. */
  note: string;
}

export const BANDS: Band[] = [
  {
    min: 85,
    letter: 'A',
    label: 'Well positioned',
    note: 'The position supports the objective. The work is protecting it and sequencing the next move.',
  },
  {
    min: 70,
    letter: 'B',
    label: 'Solid',
    note: 'Broadly sound, with one or two components doing more damage than their size suggests.',
  },
  {
    min: 55,
    letter: 'C',
    label: 'Developing',
    note: 'Workable, but the objective is ahead of the position. Sequence matters more than effort here.',
  },
  {
    min: 40,
    letter: 'D',
    label: 'Constrained',
    note: 'Several components are pulling against each other. Order of operations is the whole strategy.',
  },
  {
    min: 0,
    letter: 'E',
    label: 'Under pressure',
    note: 'The month is deciding the strategy. Stabilising comes before anything else is worth planning.',
  },
];

export function bandFor(value: number): Band {
  return BANDS.find((b) => value >= b.min) ?? BANDS[BANDS.length - 1];
}

export interface StatusStep {
  min: number;
  label: string;
  tone: 'good' | 'warn' | 'bad';
}

export const COMPONENT_STATUS: StatusStep[] = [
  { min: 85, label: 'Strong', tone: 'good' },
  { min: 70, label: 'Solid', tone: 'good' },
  { min: 55, label: 'Developing', tone: 'warn' },
  { min: 40, label: 'Needs attention', tone: 'warn' },
  { min: 0, label: 'Under pressure', tone: 'bad' },
];

export function statusFor(value: number): StatusStep {
  return COMPONENT_STATUS.find((s) => value >= s.min) ?? COMPONENT_STATUS[COMPONENT_STATUS.length - 1];
}

export interface Component {
  key: string;
  label: string;
  value: number;
  /** Shown when this component is the weakest in the position. */
  insight: string;
}

export const COMPONENTS: Component[] = [
  {
    key: 'cash-flow',
    label: 'Cash Flow',
    value: 62,
    insight:
      'Your constraint is monthly margin. Additional capital would add an obligation to a month that is already committed — flexibility has to come first.',
  },
  {
    key: 'debt',
    label: 'Debt Structure',
    value: 84,
    insight:
      'The balance is not the problem here; the shape is. Payment structure, cost and maturity timing should be addressed before anything new is taken on.',
  },
  {
    key: 'credit',
    label: 'Credit Exposure',
    value: 71,
    insight:
      'Utilization is carrying the most weight in this position. It is also one of the slowest inputs to correct, so it belongs at the front of the sequence.',
  },
  {
    key: 'liquidity',
    label: 'Liquidity',
    value: 48,
    insight:
      'There is no shock absorber. Until a reserve floor exists, every unexpected expense becomes a financing decision made under time pressure.',
  },
  {
    key: 'income',
    label: 'Income',
    value: 89,
    insight:
      'Income structure and documentation are the limiting factor, not the amount. That is a lead-time problem, so it has to start early.',
  },
  {
    key: 'capital',
    label: 'Capital Readiness',
    value: 66,
    insight:
      'The objective is ahead of the position. That makes this a timing question before it is a financing question.',
  },
];

/** Simple mean — explainable beats clever when a client asks how it was derived. */
export function indexOf(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export const STRONG_INSIGHT =
  'No single component is holding this position back. The remaining work is sequencing — making the next move without undoing the ones already in place.';
