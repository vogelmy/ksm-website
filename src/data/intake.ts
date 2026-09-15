/**
 * Client intake questionnaire — single source of truth for /intake, the
 * /api/intake handler and the admin view. Organised by the six components
 * so answers map straight onto the Profile Score.
 *
 * `fork: true` marks questions whose answer changes the strategy; the page
 * asks for them even when a client skips everything else.
 */

export type IntakeType = 'text' | 'number' | 'money' | 'textarea' | 'select' | 'yesno';

export interface IntakeQuestion {
  id: string;
  label: string;
  help?: string;
  type: IntakeType;
  options?: string[];
  required?: boolean;
  fork?: boolean;
  placeholder?: string;
}

export interface IntakeSection {
  key: string;
  title: string;
  why: string;
  questions: IntakeQuestion[];
}

export const DEBT_COLUMNS = [
  { id: 'account', label: 'Account', placeholder: 'e.g. Business loan, Amex, Student loan' },
  { id: 'lender', label: 'Lender / servicer', placeholder: '' },
  { id: 'scope', label: 'Business or personal', placeholder: 'business / personal / both' },
  { id: 'balance', label: 'Balance ($)', placeholder: '' },
  { id: 'original', label: 'Original amount or limit ($)', placeholder: '' },
  { id: 'rate', label: 'Rate or factor', placeholder: 'e.g. 24% APR, 1.32 factor' },
  { id: 'payment', label: 'Payment ($)', placeholder: '' },
  { id: 'frequency', label: 'Frequency', placeholder: 'daily / weekly / bi-weekly / monthly' },
  { id: 'ends', label: 'Ends (month/year)', placeholder: '' },
  { id: 'guaranteed', label: 'Personally guaranteed?', placeholder: 'yes / no / not sure' },
] as const;

export const SECTIONS: IntakeSection[] = [
  {
    key: 'household',
    title: 'You and your household',
    why: 'Who earns, who owes, and how the business and the household are legally connected.',
    questions: [
      { id: 'business_name', label: 'Legal name of the business', type: 'text', required: true },
      {
        id: 'entity',
        label: 'Business entity type',
        type: 'select',
        options: ['Sole proprietor', 'LLC', 'PLLC', 'S-corp', 'C-corp', 'Partnership', 'Not sure'],
        required: true,
        fork: true,
      },
      { id: 'formed', label: 'Year the business was formed', type: 'number', required: true, fork: true, placeholder: 'e.g. 2018' },
      {
        id: 'pay_self',
        label: 'How you pay yourself',
        help: 'W-2 salary, owner distributions, 1099, or a mix — and roughly the split.',
        type: 'textarea',
      },
      {
        id: 'spouse',
        label: 'Spouse or partner: name, employer, and how they are paid',
        help: 'W-2, 1099, business owner. Leave blank if not applicable.',
        type: 'textarea',
      },
      {
        id: 'filing',
        label: 'How you file taxes',
        type: 'select',
        options: ['Married filing jointly', 'Married filing separately', 'Single', 'Head of household', 'Not sure'],
      },
      {
        id: 'spenders',
        label: 'Who else can spend from the business?',
        help: 'Partners, signers on the account, cards issued to staff.',
        type: 'text',
      },
    ],
  },
  {
    key: 'income',
    title: 'Income',
    why: 'Income sets capacity. What matters to a reviewer is how much is documentable and whether the trend is up or down.',
    questions: [
      { id: 'rev_2024', label: 'Business gross revenue — 2024 full year', type: 'money', required: true },
      { id: 'rev_2025', label: 'Business gross revenue — 2025 year to date', type: 'money', required: true },
      { id: 'dist_2024', label: 'Owner distributions or salary taken — 2024', type: 'money' },
      { id: 'dist_2025', label: 'Owner distributions or salary taken — 2025 year to date', type: 'money' },
      {
        id: 'trend',
        label: 'If 2025 is tracking differently from 2024, what changed?',
        help: 'Fewer matters, slower collections, reinvestment, a deliberate tax choice, a one-off in 2024. A reviewer will see the change and assume the worst unless it is explained.',
        type: 'textarea',
        fork: true,
      },
      { id: 'spouse_income', label: "Spouse's annual income, and whether it is stable, variable or commission-based", type: 'text' },
      { id: 'other_income', label: 'Any other household income', help: 'Rental, investment, a second business, support payments.', type: 'text' },
    ],
  },
  {
    key: 'cashflow',
    title: 'Cash flow',
    why: 'Lenders read cash flow from bank statements, not the P&L — so these questions are about timing and the account itself.',
    questions: [
      {
        id: 'billing',
        label: 'How you bill',
        help: 'Hourly, retainer, flat fee, contingency — and roughly what share of revenue each is.',
        type: 'textarea',
        required: true,
        fork: true,
      },
      {
        id: 'collection_days',
        label: 'Average days from work performed to money collected',
        type: 'number',
        placeholder: 'e.g. 45',
      },
      { id: 'receivables', label: 'Total unpaid invoices or unsettled matters right now', type: 'money' },
      {
        id: 'trust_mix',
        label: 'Do client funds (trust, retainer, settlement money) ever pass through the operating account?',
        help: 'If yes, roughly how much and how often. This distorts what an underwriter sees.',
        type: 'textarea',
      },
      {
        id: 'biz_fixed',
        label: 'Fixed monthly business outgoings',
        help: 'Rent, payroll, insurance, software, loan payments — the committed share.',
        type: 'money',
      },
      {
        id: 'negative_days',
        label: 'In the last six months, roughly how many days did the business account go negative or a payment bounce?',
        type: 'number',
        placeholder: '0 if none',
      },
      {
        id: 'home_fixed',
        label: 'Fixed monthly household outgoings',
        help: 'Mortgage or rent, cars, student loans, minimum card payments, insurance, childcare, support.',
        type: 'money',
      },
    ],
  },
  {
    key: 'debt',
    title: 'Debt structure',
    why: 'The shape of the debt — rate, term, payment frequency, who is liable — matters more than the total. One row per account.',
    questions: [
      {
        id: 'student_type',
        label: 'Student loans: federal or private?',
        type: 'select',
        options: ['Federal', 'Private', 'Both', 'None', 'Not sure'],
        required: true,
        fork: true,
      },
      {
        id: 'student_status',
        label: 'Student loan status right now',
        type: 'select',
        options: ['Current', 'In a repayment plan', 'Deferred or forbearance', 'In default', 'In collections', 'None', 'Not sure'],
        required: true,
        fork: true,
      },
      { id: 'student_servicer', label: 'Student loan servicer(s)', type: 'text' },
      {
        id: 'card_dates',
        label: 'For each credit card: statement closing date and payment due date',
        help: 'Utilisation is reported on the closing date, not the due date. Timing a payment by a few days changes what gets reported.',
        type: 'textarea',
      },
      { id: 'settled', label: 'Any debt settled, charged off or modified in the last seven years?', type: 'yesno' },
      { id: 'settled_detail', label: 'If yes, which and when', type: 'text' },
      { id: 'cosign', label: "Any personal guarantee or co-signature on someone else's debt?", type: 'yesno' },
    ],
  },
  {
    key: 'credit',
    title: 'Credit exposure',
    why: 'The score is the summary. The file underneath it is what is actually fixable.',
    questions: [
      {
        id: 'score',
        label: 'Most recent credit score you have seen, and where from',
        type: 'text',
        placeholder: 'e.g. 612, Experian app, Aug 2026',
      },
      {
        id: 'lates',
        label: 'Any late payments in the last 24 months?',
        help: 'Which account, how late, and whether there was a reason.',
        type: 'textarea',
      },
      { id: 'derogs', label: 'Any collections, judgments, liens or bankruptcies — ever?', type: 'yesno' },
      { id: 'derogs_detail', label: 'If yes, what and when', type: 'text' },
      { id: 'inquiries', label: 'Hard inquiries in the last 12 months', help: 'Every funding application counts, including ones that did not close.', type: 'number', placeholder: '0 if none' },
      { id: 'disputes', label: 'Anything currently in dispute with a bureau or a creditor?', type: 'yesno' },
    ],
  },
  {
    key: 'liquidity',
    title: 'Liquidity',
    why: 'Liquidity is a level, not a rate. It never appears on a P&L and it is what makes the rest of a position durable.',
    questions: [
      { id: 'biz_cash', label: 'Cash in business accounts today', type: 'money' },
      { id: 'biz_low', label: 'Typical low point of the business balance in a month', type: 'money' },
      { id: 'personal_cash', label: 'Personal savings and checking balances', type: 'money' },
      { id: 'retirement', label: 'Retirement and investment accounts, roughly', help: 'Not to spend — reserves change how a position is read.', type: 'money' },
      { id: 'available_credit', label: 'Unused credit available across all lines and cards', type: 'money' },
    ],
  },
  {
    key: 'capital',
    title: 'Capital readiness',
    why: 'Strategy is built backwards from a date and a purpose.',
    questions: [
      { id: 'need', label: 'Will you need capital in the next 12 months?', type: 'yesno', required: true, fork: true },
      { id: 'need_amount', label: 'How much, for what, and by when?', type: 'textarea', fork: true },
      {
        id: 'better',
        label: 'When you say a "better" outcome — what matters most?',
        type: 'select',
        options: ['A larger amount', 'A lower cost', 'A longer term', 'A smaller payment', 'A specific product (e.g. HELOC, SBA)', 'Not sure'],
      },
      {
        id: 'deed',
        label: 'Home: who is on the deed, and who is on the mortgage note?',
        help: 'They can differ. Whether a HELOC is even available depends on the deed.',
        type: 'textarea',
        fork: true,
      },
      { id: 'home_value', label: 'Home: purchase year, estimated value, mortgage balance, rate and monthly payment', type: 'textarea' },
      { id: 'offers', label: 'Funding offered or declined in the last two years, and the terms', help: 'Including what you asked for versus what came back.', type: 'textarea' },
    ],
  },
  {
    key: 'protection',
    title: 'Protection and obligations',
    why: 'These rarely come up in a first conversation and routinely decide the outcome.',
    questions: [
      { id: 'tax', label: 'Any balance owed to the IRS or the state, or a payment plan in place?', type: 'yesno', required: true, fork: true },
      { id: 'tax_detail', label: 'If yes, amount and arrangement', type: 'text' },
      {
        id: 'insurance',
        label: 'Insurance in place',
        help: 'Professional liability / malpractice, general liability, life, disability — carrier and rough coverage.',
        type: 'textarea',
      },
      { id: 'litigation', label: 'Any pending litigation, bar complaints or regulatory matters?', type: 'yesno' },
      { id: 'support', label: 'Any child support, alimony or other court-ordered payments?', type: 'yesno' },
    ],
  },
];

export const DOCUMENTS = [
  ['Last 6 months of business bank statements', 'Every operating account. The single most important item.'],
  ['Last 3 months of personal bank statements', ''],
  ['Credit reports from all three bureaus', 'Pull them yourself at annualcreditreport.com — free. We do not pull credit.'],
  ['Most recent statement for every loan and credit card', ''],
  ['Student loan account summary', "From the servicer's portal, showing loan type and status."],
  ['2024 and 2023 tax returns — business and personal', ''],
  ['2025 year-to-date profit & loss and balance sheet', 'From your bookkeeper or accounting software.'],
  ['Mortgage statement and the deed', 'The deed shows who is on title; the statement shows who is on the note.'],
  ['Any funding offers or approvals from the last two years', ''],
] as const;

export const ALL_QUESTIONS = new Map(
  SECTIONS.flatMap((s) => s.questions.map((q) => [q.id, { section: s.title, ...q }] as const))
);
