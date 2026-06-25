// =============================================================================
// La La Sweett Sales System — Intent Capture Service Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  extractOrderFields,
  shouldCaptureIntent,
  buildIntentConfirmation,
  getMissingFields,
  mergeFields,
  parseDate,
  parseServings,
  parseFlavor,
  parseDesignDescription,
  parseBudgetRange,
  type CapturedOrderFields,
} from './intent-capture.service';

// -----------------------------------------------------------------------------
// parseDate
// -----------------------------------------------------------------------------

describe('parseDate', () => {
  it('parses ISO format dates', () => {
    const result = parseDate('My event is on 2025-12-25');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(11); // December
    expect(result!.getDate()).toBe(25);
  });

  it('parses US format dates (MM/DD/YYYY)', () => {
    const result = parseDate('The party is on 3/15/2025');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(2); // March
    expect(result!.getDate()).toBe(15);
    expect(result!.getFullYear()).toBe(2025);
  });

  it('parses US format dates without year', () => {
    const result = parseDate('The party is on 12/25');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(11); // December
    expect(result!.getDate()).toBe(25);
  });

  it('parses "Month Day" format', () => {
    const result = parseDate('I need it by March 15, 2025');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
    expect(result!.getFullYear()).toBe(2025);
  });

  it('parses "Month Dayth" format', () => {
    const result = parseDate('The wedding is on June 22nd, 2025');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(22);
  });

  it('parses abbreviated month names', () => {
    const result = parseDate('Event on Jan 5, 2026');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(5);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('parses "Day of Month" format', () => {
    const result = parseDate('The cake is for the 15th of March, 2025');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
  });

  it('returns undefined for messages without dates', () => {
    const result = parseDate('I want a chocolate cake');
    expect(result).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// parseServings
// -----------------------------------------------------------------------------

describe('parseServings', () => {
  it('detects direct servings mention', () => {
    expect(parseServings('I need 50 servings')).toBe(50);
  });

  it('detects "for X people" pattern', () => {
    expect(parseServings('It is for 30 people')).toBe(30);
  });

  it('detects "X guests" pattern', () => {
    expect(parseServings('We will have 75 guests')).toBe(75);
  });

  it('detects "serves X" pattern', () => {
    expect(parseServings('It should serve 100')).toBe(100);
  });

  it('detects "feed X" pattern', () => {
    expect(parseServings('We need to feed 40')).toBe(40);
  });

  it('ignores numbers outside valid range', () => {
    expect(parseServings('I need 600 servings')).toBeUndefined();
    expect(parseServings('I need 0 servings')).toBeUndefined();
  });

  it('returns undefined for messages without servings info', () => {
    expect(parseServings('I want a beautiful cake')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// parseFlavor
// -----------------------------------------------------------------------------

describe('parseFlavor', () => {
  it('detects single-word flavors', () => {
    expect(parseFlavor('I would love a chocolate cake')).toBe('chocolate');
  });

  it('detects multi-word flavors', () => {
    expect(parseFlavor('Can you do red velvet?')).toBe('red velvet');
  });

  it('is case insensitive', () => {
    expect(parseFlavor('VANILLA cake please')).toBe('vanilla');
  });

  it('returns the first matched flavor', () => {
    const result = parseFlavor('I like chocolate or vanilla');
    // Should return first match in our KNOWN_FLAVORS order (vanilla comes first)
    expect(result).toBe('vanilla');
  });

  it('returns undefined for unknown flavors', () => {
    expect(parseFlavor('I want a amazing cake')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// parseDesignDescription
// -----------------------------------------------------------------------------

describe('parseDesignDescription', () => {
  it('detects design keywords and returns relevant text', () => {
    const result = parseDesignDescription(
      'I want a 3-tier elegant cake with gold accents'
    );
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('tier');
  });

  it('detects theme-related descriptions', () => {
    const result = parseDesignDescription(
      'The theme is unicorn princess for my daughter'
    );
    expect(result).toBeDefined();
    expect(result!.toLowerCase()).toContain('theme');
  });

  it('detects decoration keywords', () => {
    const result = parseDesignDescription(
      'I want buttercream frosting with floral decorations'
    );
    expect(result).toBeDefined();
  });

  it('returns undefined for messages without design info', () => {
    const result = parseDesignDescription('I need it for Saturday');
    expect(result).toBeUndefined();
  });

  it('caps output at 500 characters', () => {
    const longDesign =
      'I want a custom designed cake with floral elements. '.repeat(20);
    const result = parseDesignDescription(longDesign);
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(500);
  });
});

// -----------------------------------------------------------------------------
// parseBudgetRange
// -----------------------------------------------------------------------------

describe('parseBudgetRange', () => {
  it('detects dollar range pattern', () => {
    const result = parseBudgetRange('My budget is $100 - $200');
    expect(result).toBe('$100 - $200');
  });

  it('detects "under $X" pattern', () => {
    const result = parseBudgetRange('I want to spend under $300');
    expect(result).toBe('under $300');
  });

  it('detects "around $X" pattern', () => {
    const result = parseBudgetRange('I want to spend around $200');
    expect(result).toBeDefined();
    expect(result).toContain('$');
  });

  it('detects "budget of $X" pattern', () => {
    const result = parseBudgetRange('I have a budget of $250');
    expect(result).toBe('up to $250');
  });

  it('detects "$X budget" pattern', () => {
    const result = parseBudgetRange('I have a $300 budget');
    expect(result).toBe('up to $300');
  });

  it('detects predefined range strings', () => {
    const result = parseBudgetRange('My range is $200 - $300');
    expect(result).toBe('$200 - $300');
  });

  it('returns undefined for messages without budget info', () => {
    expect(parseBudgetRange('I want a chocolate cake')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// extractOrderFields
// -----------------------------------------------------------------------------

describe('extractOrderFields', () => {
  it('extracts multiple fields from a single message', () => {
    const result = extractOrderFields(
      'I need a vanilla cake for 50 guests on March 15, 2025'
    );
    expect(result.flavor).toBe('vanilla');
    expect(result.servings).toBe(50);
    expect(result.eventDate).toBeInstanceOf(Date);
    expect(result.eventDate!.getMonth()).toBe(2);
    expect(result.eventDate!.getDate()).toBe(15);
  });

  it('extracts budget and design from a message', () => {
    const result = extractOrderFields(
      'I want a 3-tier elegant cake with gold accents. Budget is around $300'
    );
    expect(result.designDescription).toBeDefined();
    expect(result.budgetRange).toBeDefined();
  });

  it('returns empty fields for generic messages', () => {
    const result = extractOrderFields('Hello, how are you?');
    expect(result.eventDate).toBeUndefined();
    expect(result.servings).toBeUndefined();
    expect(result.flavor).toBeUndefined();
    expect(result.designDescription).toBeUndefined();
    expect(result.budgetRange).toBeUndefined();
  });

  it('extracts all 5 fields from a detailed message', () => {
    const result = extractOrderFields(
      'I need a chocolate 3-tier elegant cake for 100 guests on June 20, 2025. My budget is $200 - $300'
    );
    expect(result.eventDate).toBeDefined();
    expect(result.servings).toBe(100);
    expect(result.flavor).toBe('chocolate');
    expect(result.designDescription).toBeDefined();
    expect(result.budgetRange).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// shouldCaptureIntent
// -----------------------------------------------------------------------------

describe('shouldCaptureIntent', () => {
  it('returns false when fewer than 2 fields are captured', () => {
    expect(shouldCaptureIntent({})).toBe(false);
    expect(shouldCaptureIntent({ flavor: 'vanilla' })).toBe(false);
    expect(shouldCaptureIntent({ servings: 50 })).toBe(false);
  });

  it('returns true when exactly 2 fields are captured', () => {
    expect(
      shouldCaptureIntent({ flavor: 'vanilla', servings: 50 })
    ).toBe(true);
    expect(
      shouldCaptureIntent({ eventDate: new Date(), budgetRange: '$100 - $200' })
    ).toBe(true);
  });

  it('returns true when more than 2 fields are captured', () => {
    expect(
      shouldCaptureIntent({
        flavor: 'chocolate',
        servings: 100,
        eventDate: new Date(),
        budgetRange: '$200 - $300',
        designDescription: 'elegant tier cake',
      })
    ).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// getMissingFields
// -----------------------------------------------------------------------------

describe('getMissingFields', () => {
  it('returns all fields when none are captured', () => {
    const missing = getMissingFields({});
    expect(missing).toHaveLength(5);
    expect(missing).toContain('eventDate');
    expect(missing).toContain('servings');
    expect(missing).toContain('flavor');
    expect(missing).toContain('designDescription');
    expect(missing).toContain('budgetRange');
  });

  it('returns remaining fields when some are captured', () => {
    const missing = getMissingFields({
      flavor: 'vanilla',
      servings: 50,
    });
    expect(missing).toHaveLength(3);
    expect(missing).toContain('eventDate');
    expect(missing).toContain('designDescription');
    expect(missing).toContain('budgetRange');
    expect(missing).not.toContain('flavor');
    expect(missing).not.toContain('servings');
  });

  it('returns empty array when all fields are captured', () => {
    const missing = getMissingFields({
      eventDate: new Date(),
      servings: 50,
      flavor: 'chocolate',
      designDescription: 'tiered cake',
      budgetRange: '$100 - $200',
    });
    expect(missing).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// buildIntentConfirmation
// -----------------------------------------------------------------------------

describe('buildIntentConfirmation', () => {
  it('includes captured field values in the confirmation', () => {
    const confirmation = buildIntentConfirmation({
      flavor: 'vanilla',
      servings: 50,
    });
    expect(confirmation).toContain('vanilla');
    expect(confirmation).toContain('50');
  });

  it('prompts for missing fields', () => {
    const confirmation = buildIntentConfirmation({
      flavor: 'vanilla',
      servings: 50,
    });
    expect(confirmation).toContain('Event Date');
    expect(confirmation).toContain('Design Description');
    expect(confirmation).toContain('Budget Range');
  });

  it('shows completion message when all fields captured', () => {
    const confirmation = buildIntentConfirmation({
      eventDate: new Date('2025-06-20'),
      servings: 50,
      flavor: 'chocolate',
      designDescription: 'elegant tiered cake',
      budgetRange: '$200 - $300',
    });
    expect(confirmation).toContain('all the details');
    expect(confirmation).not.toContain("I'd love to know");
  });

  it('formats dates in a readable format', () => {
    const confirmation = buildIntentConfirmation({
      eventDate: new Date('2025-06-20'),
      servings: 30,
    });
    expect(confirmation).toContain('June');
    expect(confirmation).toContain('20');
    expect(confirmation).toContain('2025');
  });
});

// -----------------------------------------------------------------------------
// mergeFields
// -----------------------------------------------------------------------------

describe('mergeFields', () => {
  it('merges new fields into existing empty fields', () => {
    const result = mergeFields({}, { flavor: 'vanilla', servings: 50 });
    expect(result.flavor).toBe('vanilla');
    expect(result.servings).toBe(50);
  });

  it('new values overwrite existing ones', () => {
    const result = mergeFields(
      { flavor: 'vanilla', servings: 50 },
      { flavor: 'chocolate' }
    );
    expect(result.flavor).toBe('chocolate');
    expect(result.servings).toBe(50);
  });

  it('preserves existing fields when new fields are undefined', () => {
    const existing: CapturedOrderFields = {
      eventDate: new Date('2025-06-20'),
      servings: 50,
      flavor: 'vanilla',
    };
    const result = mergeFields(existing, { budgetRange: '$100 - $200' });
    expect(result.eventDate).toEqual(existing.eventDate);
    expect(result.servings).toBe(50);
    expect(result.flavor).toBe('vanilla');
    expect(result.budgetRange).toBe('$100 - $200');
  });
});
