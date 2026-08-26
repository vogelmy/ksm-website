/**
 * The KSM Profile Score self-assessment.
 *
 * A link KSM sends to a prospect. Twelve questions — two per profile component
 * — each answerable from memory in a few seconds. Nothing sensitive is asked:
 * no balances, no account numbers, no identifiers. Every option carries a
 * weight, the two answers in a component are averaged, and the six component
 * values produce the same 0–10 Profile Score used across the site.
 */

export interface Option {
  label: string;
  value: number;
}

export interface Question {
  id: string;
  /** Which profile component this question feeds. */
  component: string;
  prompt: string;
  help?: string;
  options: Option[];
}

export interface Section {
  key: string;
  title: string;
  lede: string;
  questions: Question[];
}

export const SECTIONS: Section[] = [
  {
    key: 'cash-flow',
    title: 'Cash flow',
    lede: 'How much of the month is already spoken for before you decide anything.',
    questions: [
      {
        id: 'cf1',
        component: 'cash-flow',
        prompt: 'In a typical month, what is left after every required payment is made?',
        options: [
          { label: 'Nothing — or I come up short', value: 12 },
          { label: 'A small amount, and it varies', value: 40 },
          { label: 'A consistent amount', value: 72 },
          { label: 'A comfortable amount, every month', value: 92 },
        ],
      },
      {
        id: 'cf2',
        component: 'cash-flow',
        prompt: 'Roughly how much of your income is committed before you make any choices?',
        help: 'Housing, debt payments, insurance, payroll — anything contractual.',
        options: [
          { label: 'Almost all of it', value: 12 },
          { label: 'About three quarters', value: 40 },
          { label: 'About half', value: 72 },
          { label: 'Less than half', value: 92 },
        ],
      },
    ],
  },
  {
    key: 'debt',
    title: 'Debt structure',
    lede: 'Not the balance — the shape of the obligations behind it.',
    questions: [
      {
        id: 'db1',
        component: 'debt',
        prompt: 'How would you describe your obligations right now?',
        options: [
          { label: 'Several, added quickly, hard to track', value: 15 },
          { label: 'A few, and I know most of the terms', value: 45 },
          { label: 'Manageable and well understood', value: 74 },
          { label: 'Little or no debt', value: 94 },
        ],
      },
      {
        id: 'db2',
        component: 'debt',
        prompt: 'Does any obligation collect daily or weekly?',
        help: 'Merchant advances and some short-term facilities collect this way.',
        options: [
          { label: 'Yes — more than one', value: 10 },
          { label: 'Yes — one', value: 35 },
          { label: 'No, everything is monthly', value: 80 },
          { label: 'I have no debt to collect on', value: 95 },
        ],
      },
    ],
  },
  {
    key: 'credit',
    title: 'Credit exposure',
    lede: 'How much of your available credit is in use, and how recently you have applied.',
    questions: [
      {
        id: 'cr1',
        component: 'credit',
        prompt: 'Across your credit lines, roughly how much of the available limit is in use?',
        options: [
          { label: 'Most of it', value: 15 },
          { label: 'Around half', value: 45 },
          { label: 'Under a third', value: 78 },
          { label: 'Very little', value: 95 },
        ],
      },
      {
        id: 'cr2',
        component: 'credit',
        prompt: 'How many credit applications have you made in the last six months?',
        options: [
          { label: 'Several', value: 20 },
          { label: 'Two or three', value: 45 },
          { label: 'One', value: 72 },
          { label: 'None', value: 92 },
        ],
      },
    ],
  },
  {
    key: 'liquidity',
    title: 'Liquidity',
    lede: 'The room between what you can reach today and what you owe.',
    questions: [
      {
        id: 'lq1',
        component: 'liquidity',
        prompt: 'If an unexpected expense landed tomorrow, how would you cover it?',
        options: [
          { label: 'Borrow, or put it on credit', value: 12 },
          { label: 'It would be tight, but possible', value: 42 },
          { label: 'From savings, without much strain', value: 76 },
          { label: 'Easily, from reserves', value: 95 },
        ],
      },
      {
        id: 'lq2',
        component: 'liquidity',
        prompt: 'How many months of required payments could your reserves cover?',
        options: [
          { label: 'Less than one', value: 12 },
          { label: 'One to three', value: 45 },
          { label: 'Three to six', value: 76 },
          { label: 'More than six', value: 95 },
        ],
      },
    ],
  },
  {
    key: 'income',
    title: 'Income',
    lede: 'How steady it is, and how easily it can be shown on paper.',
    questions: [
      {
        id: 'in1',
        component: 'income',
        prompt: 'How steady is your income?',
        options: [
          { label: 'It varies a lot month to month', value: 25 },
          { label: 'Seasonal, but predictable', value: 55 },
          { label: 'Mostly steady', value: 80 },
          { label: 'Very steady', value: 95 },
        ],
      },
      {
        id: 'in2',
        component: 'income',
        prompt: 'How easily could you document the last two years of income?',
        help: 'Consistency across periods matters more than the amount.',
        options: [
          { label: 'It would be difficult', value: 20 },
          { label: 'Possible, with some work', value: 50 },
          { label: 'Straightforward', value: 80 },
          { label: 'Already documented and current', value: 95 },
        ],
      },
    ],
  },
  {
    key: 'capital',
    title: 'Capital readiness',
    lede: 'What you are working toward, and how much runway there is before you need it.',
    questions: [
      {
        id: 'cp1',
        component: 'capital',
        prompt: 'When do you expect to need financing?',
        help: 'Most of what strengthens a position needs months to register, so timing matters.',
        options: [
          { label: 'Within three months', value: 28 },
          { label: 'Three to six months', value: 52 },
          { label: 'Six to twelve months', value: 78 },
          { label: 'No fixed timeline', value: 90 },
        ],
      },
      {
        id: 'cp2',
        component: 'capital',
        prompt: 'How prepared is the documentation and plan behind that request?',
        options: [
          { label: 'Not started', value: 15 },
          { label: 'Some of it is together', value: 45 },
          { label: 'Mostly ready', value: 76 },
          { label: 'Fully prepared', value: 94 },
        ],
      },
    ],
  },
];

export const TOTAL_QUESTIONS = SECTIONS.reduce((n, s) => n + s.questions.length, 0);
