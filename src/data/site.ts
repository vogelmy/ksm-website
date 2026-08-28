export const SITE = {
  name: 'Kallus Strategic Management',
  short: 'KSM',
  tagline: 'Business finance, clarified.',
  description:
    'KSM helps individuals and business owners understand their complete financial position — cash flow, debt structure, credit exposure, liquidity, income and timing — and build a prioritized strategy before the next financial move.',
  email: 'motti@kallusstrategicmanagement.com',
  phone: '+19549108336',
  phoneDisplay: '(954) 910-8336',
  /**
   * Scheduling link (Calendly, Cal.com, Google appointment schedule...).
   * Set this and /book embeds the calendar automatically; leave it empty and
   * /book shows call-and-email instructions instead.
   */
  bookingUrl:
    'https://calendly.com/mottiksm/15minutes?hide_gdpr_banner=1&hide_event_type_details=1&primary_color=2b57f0',
  locale: 'en_US',
};

export const NAV = [
  { label: 'Financial Profile', href: '/financial-profile' },
  { label: 'Individuals', href: '/individuals' },
  { label: 'Business', href: '/business' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Insights', href: '/insights' },
];

export const FOOTER_NAV = [
  {
    title: 'Strategy',
    links: [
      { label: 'The KSM Financial Profile', href: '/financial-profile' },
      { label: 'Cash Flow Optimization', href: '/cash-flow-optimization' },
      { label: 'Debt Strategy', href: '/debt-strategy' },
      { label: 'Financing Readiness', href: '/financing-readiness' },
    ],
  },
  {
    title: 'Who We Help',
    links: [
      { label: 'Individuals & Families', href: '/individuals' },
      { label: 'Business Owners', href: '/business' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'About KSM', href: '/about' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Insights', href: '/insights' },
      { label: 'Free Profile Score assessment', href: '/assessment' },
      { label: 'Book a call', href: '/book' },
      { label: 'Frequently Asked Questions', href: '/how-it-works#faq' },
      { label: 'Start Your Profile', href: '/start' },
      { label: 'Disclosures', href: '/disclosures' },
    ],
  },
];

/* The six components of the KSM Financial Profile */
export const PILLARS = [
  {
    num: '01',
    key: 'cash-flow',
    title: 'Cash Flow',
    short: 'What is coming in, what is going out, what is fixed and what is flexible.',
    detail:
      'Two people with identical incomes can be in completely different positions. What matters is how much of each month is already committed before a single discretionary decision gets made.',
    points: [
      'Committed versus flexible outflow',
      'Timing of inflows against obligations',
      'Monthly margin under stress',
      'Seasonality and volatility',
    ],
    href: '/cash-flow-optimization',
  },
  {
    num: '02',
    key: 'debt',
    title: 'Debt Structure',
    short: 'Balances, payment structure, cost, concentration and timing.',
    detail:
      'The balance is rarely the real problem. The structure is — how the payments are shaped, what they actually cost, when they mature, and how much of the position sits with a single lender.',
    points: [
      'Payment shape and amortization',
      'True cost by obligation',
      'Concentration and cross-collateral',
      'Maturity and renewal timing',
    ],
    href: '/debt-strategy',
  },
  {
    num: '03',
    key: 'credit',
    title: 'Credit Exposure',
    short: 'Utilization, exposure, history and overall profile positioning.',
    detail:
      'Credit is not one number. It is a set of relationships between limits, balances, age, mix and recent activity — and the business and personal sides are usually more connected than owners realize.',
    points: [
      'Utilization by line and in aggregate',
      'Personal guarantees on business debt',
      'Inquiry and application patterns',
      'Profile depth and history',
    ],
    href: '/financing-readiness',
  },
  {
    num: '04',
    key: 'liquidity',
    title: 'Liquidity',
    short: 'The room between available cash and financial obligations.',
    detail:
      'Liquidity is the shock absorber. Without it, every unexpected expense becomes a financing decision — usually an expensive one, made under time pressure.',
    points: [
      'Accessible reserves',
      'Months of coverage',
      'Undrawn capacity',
      'Reserve targets by profile',
    ],
    href: '/cash-flow-optimization',
  },
  {
    num: '05',
    key: 'income',
    title: 'Income',
    short: 'Income level, stability and structure.',
    detail:
      'How income is earned and documented can matter as much as the amount. Two identical incomes are read very differently depending on structure and consistency.',
    points: [
      'Stability and documentation',
      'Concentration of sources',
      'Owner compensation structure',
      'Trend and trajectory',
    ],
    href: '/business',
  },
  {
    num: '06',
    key: 'capital',
    title: 'Capital Needs',
    short: 'What you are trying to accomplish next — and when.',
    detail:
      'Everything above is only meaningful in relation to the objective. A profile that is well positioned for a five-year plan can be poorly positioned for a purchase ninety days from now.',
    points: [
      'Objective and amount',
      'Time horizon',
      'Sequence of moves',
      'Readiness gap',
    ],
    href: '/financing-readiness',
  },
];

export const PROCESS = [
  {
    num: '01',
    title: 'Connect',
    summary: 'Tell us what you are trying to accomplish.',
    detail:
      'We start with the objective, not the paperwork. A short intake establishes what you are working toward, the timeline you have in mind, and what is creating pressure right now.',
  },
  {
    num: '02',
    title: 'Map',
    summary: 'We organize the complete financial picture.',
    detail:
      'Accounts, obligations, income, credit and liquidity get assembled into a single view. Most clients have never seen their position laid out in one place before this step.',
  },
  {
    num: '03',
    title: 'Diagnose',
    summary: 'We identify pressure points, opportunities and conflicts.',
    detail:
      'This is where the relationships between the numbers become visible — where the position is stronger than it feels, where it is weaker than it looks, and where two goals are quietly working against each other.',
  },
  {
    num: '04',
    title: 'Strategize',
    summary: 'We build the recommended sequence.',
    detail:
      'Not a list of everything that could be improved. A prioritized order of operations: what to address first, what to leave alone for now, and what has to happen before the next financing conversation.',
  },
  {
    num: '05',
    title: 'Execute',
    summary: 'You know exactly what to do next.',
    detail:
      'You leave with a written profile and a roadmap covering the next ninety days — specific enough to act on without needing us in the room.',
  },
];

export const FAQ = [
  {
    q: 'Is KSM a lender?',
    a: 'No. KSM does not lend money and plays no part in any lender’s underwriting decision. That independence is deliberate: it means the analysis is not shaped by whether a particular product gets sold.',
  },
  {
    q: 'Is KSM a credit repair company?',
    a: 'No. KSM does not dispute items on credit reports and does not offer credit repair services. We analyze how credit exposure interacts with the rest of your financial position and what that means for your strategy.',
  },
  {
    q: 'Is KSM a debt settlement or debt relief company?',
    a: 'No. KSM does not negotiate settlements with creditors and does not enroll clients in debt relief programs. We analyze debt structure — cost, timing, concentration and payment shape — as one component of a broader picture.',
  },
  {
    q: 'Will KSM apply for financing on my behalf?',
    a: 'No. KSM does not submit applications, broker loans, or accept compensation from lenders. Any financing decision remains entirely yours, made with whichever institution you choose.',
  },
  {
    q: 'What information do I need to provide?',
    a: 'The initial profile request asks only who you are, what you are trying to accomplish, and how to reach you. Financial detail is gathered later in the engagement through a structured process — never through the website form.',
  },
  {
    q: 'How long does a Financial Profile Review take?',
    a: 'Timelines depend on the complexity of the position and how quickly information becomes available. You will get a specific expectation before an engagement begins, not after.',
  },
  {
    q: 'How much does it cost?',
    a: 'Engagements are scoped to the complexity of the financial profile. Scope and cost are discussed directly before any work starts, and there is no cost to determine whether KSM is the right fit.',
  },
  {
    q: 'Who is KSM best suited for?',
    a: 'Individuals and business owners with more than one moving part — multiple obligations, a business and personal position that interact, or a significant financial objective on the horizon. If your finances fit comfortably on one page, you probably do not need us.',
  },
  {
    q: 'Do you work with businesses?',
    a: 'Yes. Business owners are a core part of the practice, particularly where personal guarantees, owner compensation and business obligations are entangled with the personal position.',
  },
  {
    q: 'Is my information confidential?',
    a: 'Yes. Financial information is handled with discretion and used solely to build and discuss your profile. It is not sold, and it is not shared with lenders or third parties for marketing.',
  },
  {
    q: 'Can KSM guarantee financing, rates or approvals?',
    a: 'No — and you should be cautious of anyone who does. Approvals, rates, limits and terms are decided by lenders against their own criteria. KSM helps you understand and strengthen the position you bring to that conversation.',
  },
  {
    q: 'What happens after the review?',
    a: 'You receive a written Financial Profile and a prioritized ninety-day roadmap. From there, some clients execute independently and some continue working with us. Either outcome is a legitimate one.',
  },
];

export const DASHBOARD_METRICS = [
  { label: 'Cash Flow', value: 62, status: 'Needs attention', tone: 'warn' },
  { label: 'Debt Structure', value: 84, status: 'Strong', tone: 'good' },
  { label: 'Credit Exposure', value: 71, status: 'Optimize', tone: 'warn' },
  { label: 'Liquidity', value: 48, status: 'Building', tone: 'warn' },
  { label: 'Income', value: 89, status: 'Strong', tone: 'good' },
  { label: 'Capital Readiness', value: 66, status: 'Developing', tone: 'warn' },
];

export const INSIGHTS = [
  {
    slug: 'income-vs-financing-readiness',
    title: 'Why a High Income Does Not Always Mean You Are Financing-Ready',
    excerpt:
      'Income tells a lender what you earn. It says very little about what is already committed before the money reaches you — and that gap is where most surprises live.',
    category: 'Financing Readiness',
    readTime: '7 min read',
    date: '2026-08-04',
  },
  {
    slug: 'cash-flow-vs-liquidity',
    title: 'The Difference Between Cash Flow and Liquidity',
    excerpt:
      'The two terms get used interchangeably in conversation and they behave completely differently under stress. Confusing them is one of the more expensive mistakes in personal and business finance.',
    category: 'Cash Flow',
    readTime: '6 min read',
    date: '2026-07-22',
  },
  {
    slug: 'debt-structure-vs-balance',
    title: 'How Debt Structure Affects Your Financial Profile',
    excerpt:
      'Two businesses can carry identical debt balances and be in entirely different positions. The balance is the headline; the structure is the story.',
    category: 'Debt Strategy',
    readTime: '8 min read',
    date: '2026-07-09',
  },
  {
    slug: 'pay-down-debt-or-preserve-cash',
    title: 'Should You Pay Down Debt or Preserve Cash?',
    excerpt:
      'The math answer and the strategy answer are frequently different. Here is the framework we use when a client has one pool of money and two reasonable uses for it.',
    category: 'Cash Flow',
    readTime: '7 min read',
    date: '2026-06-18',
  },
  {
    slug: 'what-lenders-actually-see',
    title: 'What Lenders Actually See When They Review Your Profile',
    excerpt:
      'The version of you a lender evaluates is assembled from documents, ratios and history — not from context or intent. Understanding that view changes how you prepare for it.',
    category: 'Financing Readiness',
    readTime: '9 min read',
    date: '2026-05-27',
  },
  {
    slug: 'business-debt-personal-flexibility',
    title: 'How Business Debt Can Quietly Limit Personal Flexibility',
    excerpt:
      'Personal guarantees, owner draws and blended credit lines mean the wall between business and personal finance is thinner than most owners assume.',
    category: 'Business',
    readTime: '7 min read',
    date: '2026-05-06',
  },
];
