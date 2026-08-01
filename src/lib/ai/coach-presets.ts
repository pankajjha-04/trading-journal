export const PRESETS = [
  {
    id: 'chart',
    label: 'Analyse a chart screenshot',
    blurb: 'Upload a chart and get structure, levels and what the entry was risking.',
    needs: 'image' as const,
    question:
      'Read this chart. Describe the market structure, the obvious liquidity and support/resistance levels, and where a reasonable entry, stop and target would sit. If an entry is already marked, say what it was risking and what was wrong with it.',
  },
  {
    id: 'statement',
    label: 'Analyse a statement or sheet',
    blurb: 'PDF, Excel or CSV — a broker report, or your own tracking sheet.',
    needs: 'document' as const,
    question:
      'Read this statement or spreadsheet. Summarise what it shows about how this account was traded — position sizing, frequency, costs, and anything that looks inconsistent or mistyped. Do not repeat every number back.',
  },
  {
    id: 'account',
    label: 'Review my whole account',
    blurb: 'Everything logged so far, read as one book.',
    needs: 'none' as const,
    question:
      'Review this account as a whole. What is working, what is quietly losing money, and what would you look at first?',
  },
  {
    id: 'habit',
    label: 'What is my worst habit?',
    blurb: 'The one pattern costing the most, with the evidence.',
    needs: 'none' as const,
    question:
      'Looking only at the data below, what single habit is costing this trader the most money? Name it, show the numbers behind it, and say what would change if it stopped.',
  },
  {
    id: 'drop',
    label: 'Which setup should I drop?',
    blurb: 'Which patterns are being funded by the others.',
    needs: 'none' as const,
    question:
      'Which setups should this trader stop taking, and which deserve more size? Flag any where the sample is too small to decide.',
  },
  {
    id: 'risk',
    label: 'Is my risk under control?',
    blurb: 'Sizing, stops, and how bad the drawdowns get.',
    needs: 'none' as const,
    question:
      'Assess risk management: stop discipline, consistency of sizing, and how the drawdowns compare to the average win. Say plainly whether this account is one bad run from serious damage.',
  },
] as const;

export type PresetId = (typeof PRESETS)[number]['id'];