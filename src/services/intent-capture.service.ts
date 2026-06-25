// =============================================================================
// La La Sweett Sales System — Intent Capture Service
// =============================================================================
//
// Detects order intent from customer conversation messages. When a customer
// provides ≥2 of the 5 order detail fields (event_date, servings, flavor,
// design_description, budget_range), captures a structured Order_Intent,
// confirms details back, and prompts for missing fields.
//
// Requirements: 6.6, 7.4, 7.5
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Captured order fields from a conversation message */
export interface CapturedOrderFields {
  eventDate?: Date;
  servings?: number;
  flavor?: string;
  designDescription?: string;
  budgetRange?: string;
}

/** Names of order fields for tracking */
export type OrderFieldName = keyof CapturedOrderFields;

/** All possible order fields */
export const ALL_ORDER_FIELDS: OrderFieldName[] = [
  'eventDate',
  'servings',
  'flavor',
  'designDescription',
  'budgetRange',
];

/** Human-readable labels for each field */
const FIELD_LABELS: Record<OrderFieldName, string> = {
  eventDate: 'Event Date',
  servings: 'Number of Servings',
  flavor: 'Flavor Preference',
  designDescription: 'Design Description',
  budgetRange: 'Budget Range',
};

// -----------------------------------------------------------------------------
// Known flavors and budget ranges for detection
// -----------------------------------------------------------------------------

const KNOWN_FLAVORS = [
  'vanilla',
  'chocolate',
  'red velvet',
  'strawberry',
  'lemon',
  'carrot',
  'funfetti',
  'marble',
  'coconut',
  'almond',
  'caramel',
  'coffee',
  'mocha',
  'peanut butter',
  'cookies and cream',
  'banana',
  'pumpkin',
  'cinnamon',
  'mint',
  'blueberry',
  'raspberry',
  'mango',
  'tres leches',
  'dulce de leche',
  'churro',
  'pistachio',
];

const BUDGET_PATTERNS = [
  // Dollar range patterns: "$50-$100", "$50 - $100", "$50 to $100"
  /\$\s*(\d+)\s*[-–—to]+\s*\$?\s*(\d+)/i,
  // Single budget mention: "budget of $200", "around $150"
  /(?:budget|spend|afford|pay|cost|price)\s*(?:of|is|around|about|up to|under|below|max)?\s*\$\s*(\d+)/i,
  // Dollar amount with "budget": "$200 budget"
  /\$\s*(\d+)\s*budget/i,
  // Predefined range keywords
  /(?:under|below|less than)\s*\$?\s*(\d+)/i,
  /(?:around|about|approximately)\s*\$?\s*(\d+)/i,
];

const PREDEFINED_BUDGET_RANGES = [
  'under $50',
  '$50 - $100',
  '$100 - $200',
  '$200 - $300',
  '$300 - $500',
  '$500+',
  'over $500',
];

// -----------------------------------------------------------------------------
// Date parsing helpers
// -----------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Parse a date from natural language text.
 * Supports formats:
 * - "March 15", "March 15th", "March 15, 2025"
 * - "3/15", "3/15/2025", "03/15/2025"
 * - "2025-03-15" (ISO)
 * - "15th of March"
 * - "next Saturday", "this Friday" (relative — simplified)
 */
export function parseDate(text: string): Date | undefined {
  const now = new Date();
  const currentYear = now.getFullYear();

  // ISO format: 2025-03-15
  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const date = new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3])
    );
    if (!isNaN(date.getTime())) return date;
  }

  // US format: 3/15/2025, 03/15/25, 3/15
  const usMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (usMatch) {
    const month = parseInt(usMatch[1]) - 1;
    const day = parseInt(usMatch[2]);
    let year = usMatch[3] ? parseInt(usMatch[3]) : currentYear;
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      // If date is in the past and no year was given, assume next year
      if (!usMatch[3] && date < now) {
        date.setFullYear(currentYear + 1);
      }
      return date;
    }
  }

  // "Month Day" or "Month Day, Year" or "Month Dayth"
  const monthDayPattern = new RegExp(
    `\\b(${Object.keys(MONTH_NAMES).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[,\\s]+(\\d{4}))?\\b`,
    'i'
  );
  const monthDayMatch = text.match(monthDayPattern);
  if (monthDayMatch) {
    const month = MONTH_NAMES[monthDayMatch[1].toLowerCase()];
    const day = parseInt(monthDayMatch[2]);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : currentYear;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      // If date is in the past and no year was given, assume next year
      if (!monthDayMatch[3] && date < now) {
        date.setFullYear(currentYear + 1);
      }
      return date;
    }
  }

  // "Day of Month" pattern: "15th of March", "1st of June"
  const dayOfMonthPattern = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+(${Object.keys(MONTH_NAMES).join('|')})(?:[,\\s]+(\\d{4}))?\\b`,
    'i'
  );
  const dayOfMonthMatch = text.match(dayOfMonthPattern);
  if (dayOfMonthMatch) {
    const day = parseInt(dayOfMonthMatch[1]);
    const month = MONTH_NAMES[dayOfMonthMatch[2].toLowerCase()];
    const year = dayOfMonthMatch[3] ? parseInt(dayOfMonthMatch[3]) : currentYear;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      if (!dayOfMonthMatch[3] && date < now) {
        date.setFullYear(currentYear + 1);
      }
      return date;
    }
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Number/servings extraction
// -----------------------------------------------------------------------------

/**
 * Extract a servings count from text.
 * Looks for patterns like: "50 servings", "for 30 people", "30 guests",
 * "serves 40", "feed 60".
 */
export function parseServings(text: string): number | undefined {
  // Direct servings mention: "50 servings", "30 servings"
  const servingsMatch = text.match(
    /\b(\d+)\s*(?:servings?|portions?|pieces?|slices?)\b/i
  );
  if (servingsMatch) {
    const num = parseInt(servingsMatch[1]);
    if (num >= 1 && num <= 500) return num;
  }

  // People/guests count: "for 30 people", "50 guests"
  const peopleMatch = text.match(
    /\b(?:for\s+)?(\d+)\s*(?:people|guests?|persons?|attendees?)\b/i
  );
  if (peopleMatch) {
    const num = parseInt(peopleMatch[1]);
    if (num >= 1 && num <= 500) return num;
  }

  // "serves 40", "feed 60"
  const servesMatch = text.match(
    /\b(?:serves?|feed|feeding)\s+(\d+)\b/i
  );
  if (servesMatch) {
    const num = parseInt(servesMatch[1]);
    if (num >= 1 && num <= 500) return num;
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Flavor extraction
// -----------------------------------------------------------------------------

/**
 * Detect flavor mentions in text.
 * Returns the first matched known flavor.
 */
export function parseFlavor(text: string): string | undefined {
  const lower = text.toLowerCase();

  for (const flavor of KNOWN_FLAVORS) {
    // Use word boundary matching for multi-word flavors
    const escaped = flavor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(lower)) {
      return flavor;
    }
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Design description extraction
// -----------------------------------------------------------------------------

/** Keywords that indicate a design description */
const DESIGN_KEYWORDS = [
  'theme',
  'themed',
  'design',
  'decoration',
  'decorated',
  'tier',
  'tiered',
  'layer',
  'layered',
  'floral',
  'flowers',
  'unicorn',
  'princess',
  'superhero',
  'rustic',
  'elegant',
  'modern',
  'minimalist',
  'fondant',
  'buttercream',
  'drip',
  'naked cake',
  'ombre',
  'gold',
  'glitter',
  'sprinkles',
  'character',
  'custom',
  'personalized',
  'photo',
  'topper',
  'figurine',
  'shape',
  'shaped',
];

/**
 * Detect if the message contains design-related description.
 * Returns the relevant portion of text that describes the design.
 */
export function parseDesignDescription(text: string): string | undefined {
  const lower = text.toLowerCase();

  // Check if any design keywords are present
  const hasDesignKeyword = DESIGN_KEYWORDS.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    return pattern.test(lower);
  });

  if (!hasDesignKeyword) {
    return undefined;
  }

  // Look for sentences containing design keywords
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 0);
  const designSentences = sentences.filter((sentence) => {
    const sentenceLower = sentence.toLowerCase();
    return DESIGN_KEYWORDS.some((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      return pattern.test(sentenceLower);
    });
  });

  if (designSentences.length > 0) {
    const description = designSentences.map((s) => s.trim()).join('. ');
    // Cap at 500 chars (WhatsApp limit)
    return description.slice(0, 500);
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Budget range extraction
// -----------------------------------------------------------------------------

/**
 * Detect budget/price range mentions in text.
 * Returns a normalized budget range string.
 */
export function parseBudgetRange(text: string): string | undefined {
  const lower = text.toLowerCase();

  // Check for predefined budget ranges first
  for (const range of PREDEFINED_BUDGET_RANGES) {
    if (lower.includes(range.toLowerCase())) {
      return range;
    }
  }

  // Dollar range: "$50-$100", "$50 - $100", "$50 to $100"
  const rangeMatch = text.match(/\$\s*(\d+)\s*[-–—]|(?:to)\s*\$?\s*(\d+)/i);
  if (rangeMatch) {
    const fullRange = text.match(/\$\s*(\d+)\s*[-–—to]+\s*\$?\s*(\d+)/i);
    if (fullRange) {
      return `$${fullRange[1]} - $${fullRange[2]}`;
    }
  }

  // "under $X" / "below $X" / "less than $X"
  const underMatch = text.match(/(?:under|below|less than)\s*\$?\s*(\d+)/i);
  if (underMatch) {
    return `under $${underMatch[1]}`;
  }

  // "around $X" / "about $X"
  const aroundMatch = text.match(/(?:around|about|approximately)\s*\$?\s*(\d+)/i);
  if (aroundMatch) {
    const amount = parseInt(aroundMatch[1]);
    const lower = Math.max(0, Math.round(amount * 0.8));
    const upper = Math.round(amount * 1.2);
    return `$${lower} - $${upper}`;
  }

  // "budget of $X" / "budget is $X" / "up to $X" / "max $X"
  const budgetMatch = text.match(
    /(?:budget|spend|afford|pay|up to|max|maximum)\s*(?:of|is|around|about)?\s*\$\s*(\d+)/i
  );
  if (budgetMatch) {
    return `up to $${budgetMatch[1]}`;
  }

  // "$X budget"
  const budgetSuffixMatch = text.match(/\$\s*(\d+)\s*budget/i);
  if (budgetSuffixMatch) {
    return `up to $${budgetSuffixMatch[1]}`;
  }

  return undefined;
}

// -----------------------------------------------------------------------------
// Main extraction function
// -----------------------------------------------------------------------------

/**
 * Extract all order-related fields from a customer message.
 * Parses text for dates, servings, flavors, design descriptions, and budget.
 */
export function extractOrderFields(message: string): CapturedOrderFields {
  const fields: CapturedOrderFields = {};

  const eventDate = parseDate(message);
  if (eventDate) {
    fields.eventDate = eventDate;
  }

  const servings = parseServings(message);
  if (servings !== undefined) {
    fields.servings = servings;
  }

  const flavor = parseFlavor(message);
  if (flavor) {
    fields.flavor = flavor;
  }

  const designDescription = parseDesignDescription(message);
  if (designDescription) {
    fields.designDescription = designDescription;
  }

  const budgetRange = parseBudgetRange(message);
  if (budgetRange) {
    fields.budgetRange = budgetRange;
  }

  return fields;
}

// -----------------------------------------------------------------------------
// Intent threshold check
// -----------------------------------------------------------------------------

/**
 * Determines if enough fields (≥2) have been captured to trigger
 * an Order_Intent capture.
 */
export function shouldCaptureIntent(capturedFields: CapturedOrderFields): boolean {
  const filledCount = ALL_ORDER_FIELDS.filter(
    (field) => capturedFields[field] !== undefined
  ).length;

  return filledCount >= 2;
}

// -----------------------------------------------------------------------------
// Missing fields detection
// -----------------------------------------------------------------------------

/**
 * Returns the list of field names that are still missing (not yet captured).
 */
export function getMissingFields(capturedFields: CapturedOrderFields): OrderFieldName[] {
  return ALL_ORDER_FIELDS.filter(
    (field) => capturedFields[field] === undefined
  );
}

// -----------------------------------------------------------------------------
// Confirmation message builder
// -----------------------------------------------------------------------------

/**
 * Build a confirmation message listing captured fields and prompting
 * for missing ones. Uses La La Sweett's warm, creative brand voice.
 */
export function buildIntentConfirmation(capturedFields: CapturedOrderFields): string {
  const lines: string[] = [];

  lines.push("✨ I've captured these details for your order:");
  lines.push('');

  // List captured fields
  if (capturedFields.eventDate) {
    const dateStr = capturedFields.eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    lines.push(`📅 ${FIELD_LABELS.eventDate}: ${dateStr}`);
  }

  if (capturedFields.servings !== undefined) {
    lines.push(`👥 ${FIELD_LABELS.servings}: ${capturedFields.servings}`);
  }

  if (capturedFields.flavor) {
    lines.push(`🎂 ${FIELD_LABELS.flavor}: ${capturedFields.flavor}`);
  }

  if (capturedFields.designDescription) {
    lines.push(`🎨 ${FIELD_LABELS.designDescription}: ${capturedFields.designDescription}`);
  }

  if (capturedFields.budgetRange) {
    lines.push(`💰 ${FIELD_LABELS.budgetRange}: ${capturedFields.budgetRange}`);
  }

  // Prompt for missing fields
  const missing = getMissingFields(capturedFields);
  if (missing.length > 0) {
    lines.push('');
    lines.push("To complete your inquiry, I'd love to know:");
    missing.forEach((field) => {
      lines.push(`  • ${FIELD_LABELS[field]}`);
    });
  } else {
    lines.push('');
    lines.push("🎉 I have all the details I need! I'll create your order inquiry now.");
  }

  return lines.join('\n');
}

// -----------------------------------------------------------------------------
// Merge captured fields (accumulate across messages)
// -----------------------------------------------------------------------------

/**
 * Merge newly extracted fields into existing captured fields.
 * New values overwrite existing ones (latest message wins).
 */
export function mergeFields(
  existing: CapturedOrderFields,
  newFields: CapturedOrderFields
): CapturedOrderFields {
  return {
    eventDate: newFields.eventDate ?? existing.eventDate,
    servings: newFields.servings ?? existing.servings,
    flavor: newFields.flavor ?? existing.flavor,
    designDescription: newFields.designDescription ?? existing.designDescription,
    budgetRange: newFields.budgetRange ?? existing.budgetRange,
  };
}
