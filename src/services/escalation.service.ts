// =============================================================================
// La La Sweett Sales System — Escalation Service Implementation
// =============================================================================
//
// Detects escalation triggers in customer messages, creates escalation records,
// and notifies the owner via Telegram within 30 seconds.
//
// Escalation triggers:
//   - Multi-tier cakes with >5 tiers
//   - Sculpted 3D designs
//   - Designs not represented in catalog categories
//   - Pricing requests beyond listed price ranges
//   - Explicit requests to speak with a human/owner
//
// After one clarification attempt fails, offers owner connection.
//
// Requirements: 6.5, 6.9, 7.6
// =============================================================================

import type {
  Channel,
  EscalationStatus,
  NotificationService,
  Product,
} from '@/types';

// -----------------------------------------------------------------------------
// Escalation Record
// -----------------------------------------------------------------------------

/** Escalation record created when the AI cannot handle a request */
export interface EscalationRecord {
  id: string;
  reason: EscalationReason;
  contextSummary: string; // max 500 characters
  originatingChannel: Channel;
  status: EscalationStatus;
  createdAt: string;
}

/** Reason categories for escalation */
export type EscalationReason =
  | 'multi_tier_complex'
  | 'sculpted_3d_design'
  | 'design_not_in_catalog'
  | 'pricing_beyond_range'
  | 'human_requested'
  | 'clarification_failed';

// -----------------------------------------------------------------------------
// Escalation Detection Result
// -----------------------------------------------------------------------------

/** Result of escalation detection */
export interface EscalationDetectionResult {
  shouldEscalate: boolean;
  reason?: EscalationReason;
  details?: string;
}

// -----------------------------------------------------------------------------
// Conversation Context for escalation detection
// -----------------------------------------------------------------------------

/** Minimal conversation context for escalation detection */
export interface ConversationContext {
  clarificationAttempts: number;
  channel: Channel;
  mentionedPrice?: number;
  messageHistory?: string[];
}

// -----------------------------------------------------------------------------
// Catalog Context for pricing/category checks
// -----------------------------------------------------------------------------

/** Catalog context for escalation pricing checks */
export interface CatalogContext {
  maxPrice: number;
  categoryNames: string[];
}

// -----------------------------------------------------------------------------
// Constants — keyword/pattern detection
// -----------------------------------------------------------------------------

/** Keywords indicating request for human contact */
const HUMAN_REQUEST_KEYWORDS: string[] = [
  'human',
  'person',
  'owner',
  'real person',
  'speak to someone',
  'talk to someone',
  'talk to a human',
  'speak to a human',
  'speak with a human',
  'talk to a person',
  'speak to a person',
  'speak with a person',
  'speak with someone',
  'connect me',
  'real human',
  'actual person',
  'manager',
  'representative',
];

/** Keywords indicating sculpted 3D design requests */
const SCULPTED_3D_KEYWORDS: string[] = [
  'sculpted',
  '3d',
  '3-d',
  'three dimensional',
  'three-dimensional',
  'sculpture',
  'carved',
  'shaped like',
  'life-size',
  'lifesize',
  'life size',
  'realistic',
  'bust cake',
];

/** Patterns indicating multi-tier (>5 tiers) requests */
const MULTI_TIER_PATTERNS: RegExp[] = [
  /(\b[6-9]\b|\b[1-9]\d+)\s*[-–]?\s*tier/i,
  /tier[s]?\s*[:=]?\s*(\b[6-9]\b|\b[1-9]\d+\b)/i,
  /(\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)\s*[-–]?\s*tier/i,
];

/** Default catalog max price if no catalog context is provided */
const DEFAULT_MAX_CATALOG_PRICE = 800;

/** Default catalog categories */
const DEFAULT_CATALOG_CATEGORIES: string[] = [
  'birthday',
  'wedding',
  'baby shower',
  'graduation',
  'holiday',
  'seasonal',
  'character',
  'themed',
  'cupcakes',
  'cake pops',
  'cookies',
  'mini dessert',
  'dessert table',
  'packages',
];

// -----------------------------------------------------------------------------
// Escalation Detection Logic
// -----------------------------------------------------------------------------

/**
 * Check if a message contains keywords requesting human contact.
 */
export function detectHumanRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return HUMAN_REQUEST_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );
}

/**
 * Check if a message describes a sculpted/3D design.
 */
export function detectSculpted3D(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return SCULPTED_3D_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );
}

/**
 * Check if a message requests multi-tier cakes with >5 tiers.
 */
export function detectMultiTierAboveFive(message: string): boolean {
  return MULTI_TIER_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Check if a mentioned price exceeds the catalog max price.
 */
export function detectPricingBeyondRange(
  message: string,
  maxCatalogPrice: number = DEFAULT_MAX_CATALOG_PRICE
): boolean {
  // Match dollar amounts in various formats
  const pricePatterns = [
    /\$\s*([\d,]+(?:\.\d{1,2})?)/g,
    /(\d{3,}(?:,\d{3})*(?:\.\d{1,2})?)\s*dollars/gi,
    /budget\s*(?:is|of|around|about)?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ];

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > maxCatalogPrice) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if the design described does not fit any known catalog category.
 * This is a heuristic check — if the message describes a design but none
 * of the catalog category keywords match, it may need escalation.
 */
export function detectDesignNotInCatalog(
  message: string,
  catalogCategories: string[] = DEFAULT_CATALOG_CATEGORIES
): boolean {
  const lowerMessage = message.toLowerCase();

  // Only trigger this check if the message seems to describe a design request
  const designIndicators = [
    'design',
    'theme',
    'want a',
    'need a',
    'looking for',
    'can you make',
    'can you do',
    'i need',
    'i want',
    'custom',
    'special',
    'unique',
  ];

  const isDesignRequest = designIndicators.some((indicator) =>
    lowerMessage.includes(indicator)
  );

  if (!isDesignRequest) {
    return false;
  }

  // Check if any catalog category is mentioned
  const matchesCategory = catalogCategories.some((category) =>
    lowerMessage.includes(category.toLowerCase())
  );

  // If it's a design request but doesn't match any category, escalate
  return !matchesCategory;
}

// -----------------------------------------------------------------------------
// Main Escalation Detection
// -----------------------------------------------------------------------------

/**
 * Analyze a message and conversation context to determine if escalation is needed.
 *
 * @param message - The customer message text
 * @param context - Optional conversation context (clarification attempts, channel, etc.)
 * @param catalogContext - Optional catalog context (max price, categories)
 * @returns EscalationDetectionResult indicating whether to escalate and why
 */
export function detectEscalation(
  message: string,
  context?: ConversationContext,
  catalogContext?: CatalogContext
): EscalationDetectionResult {
  const maxPrice = catalogContext?.maxPrice ?? DEFAULT_MAX_CATALOG_PRICE;
  const categories = catalogContext?.categoryNames ?? DEFAULT_CATALOG_CATEGORIES;

  // Check for explicit human request (highest priority)
  if (detectHumanRequest(message)) {
    return {
      shouldEscalate: true,
      reason: 'human_requested',
      details: 'Customer explicitly requested to speak with a human or the owner.',
    };
  }

  // Check for multi-tier >5 tiers
  if (detectMultiTierAboveFive(message)) {
    return {
      shouldEscalate: true,
      reason: 'multi_tier_complex',
      details: 'Customer requested a multi-tier cake with more than 5 tiers.',
    };
  }

  // Check for sculpted 3D designs
  if (detectSculpted3D(message)) {
    return {
      shouldEscalate: true,
      reason: 'sculpted_3d_design',
      details: 'Customer requested a sculpted or 3D cake design.',
    };
  }

  // Check for pricing beyond catalog ranges
  if (detectPricingBeyondRange(message, maxPrice)) {
    return {
      shouldEscalate: true,
      reason: 'pricing_beyond_range',
      details: `Customer mentioned pricing that exceeds the catalog maximum of $${maxPrice}.`,
    };
  }

  // Check for designs not in catalog categories
  if (detectDesignNotInCatalog(message, categories)) {
    return {
      shouldEscalate: true,
      reason: 'design_not_in_catalog',
      details: 'Customer described a design not represented in catalog categories.',
    };
  }

  // Check if clarification has already failed
  if (context && context.clarificationAttempts >= 1) {
    return {
      shouldEscalate: true,
      reason: 'clarification_failed',
      details:
        'AI could not interpret the customer message after one clarification attempt.',
    };
  }

  return { shouldEscalate: false };
}

/**
 * Convenience function that returns a simple boolean + reason.
 *
 * @param message - The customer message text
 * @returns Object with shouldEscalate boolean and optional reason string
 */
export function shouldEscalate(message: string): {
  shouldEscalate: boolean;
  reason?: string;
} {
  const result = detectEscalation(message);
  return {
    shouldEscalate: result.shouldEscalate,
    reason: result.details,
  };
}

// -----------------------------------------------------------------------------
// Escalation Record Creation and Notification
// -----------------------------------------------------------------------------

/**
 * Create an escalation record and notify the owner via Telegram.
 *
 * @param reason - The escalation reason category
 * @param contextSummary - Summary of the conversation (max 500 chars, truncated if longer)
 * @param channel - The originating channel
 * @param notificationService - The notification service for owner alerts
 * @returns The created EscalationRecord
 */
export async function createEscalation(
  reason: EscalationReason,
  contextSummary: string,
  channel: Channel,
  notificationService: NotificationService
): Promise<EscalationRecord> {
  // Enforce max 500 char summary
  const truncatedSummary =
    contextSummary.length > 500
      ? contextSummary.slice(0, 497) + '...'
      : contextSummary;

  const escalation: EscalationRecord = {
    id: crypto.randomUUID(),
    reason,
    contextSummary: truncatedSummary,
    originatingChannel: channel,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Notify owner via Telegram within 30 seconds (immediate call)
  await notificationService.notifyOwner({
    type: 'escalation',
    content: formatEscalationNotification(escalation),
    priority: 'high',
  });

  return escalation;
}

/**
 * Format an escalation record into a human-readable Telegram notification.
 */
function formatEscalationNotification(escalation: EscalationRecord): string {
  const reasonLabels: Record<EscalationReason, string> = {
    multi_tier_complex: '🎂 Complex multi-tier (>5 tiers)',
    sculpted_3d_design: '🎨 Sculpted/3D design request',
    design_not_in_catalog: '📋 Design not in catalog',
    pricing_beyond_range: '💰 Pricing beyond catalog range',
    human_requested: '👤 Customer requested human contact',
    clarification_failed: '❓ Clarification attempt failed',
  };

  const reasonLabel = reasonLabels[escalation.reason] || escalation.reason;

  return (
    `⚠️ Escalation Required\n\n` +
    `Reason: ${reasonLabel}\n` +
    `Channel: ${escalation.originatingChannel}\n\n` +
    `Context: ${escalation.contextSummary}`
  );
}

// -----------------------------------------------------------------------------
// Escalation Service Class (stateful, manages escalation history)
// -----------------------------------------------------------------------------

export class EscalationService {
  private escalations: EscalationRecord[] = [];
  private notificationService: NotificationService;
  private catalogContext: CatalogContext;

  constructor(
    notificationService: NotificationService,
    catalogContext?: CatalogContext
  ) {
    this.notificationService = notificationService;
    this.catalogContext = catalogContext ?? {
      maxPrice: DEFAULT_MAX_CATALOG_PRICE,
      categoryNames: DEFAULT_CATALOG_CATEGORIES,
    };
  }

  /**
   * Update the catalog context (e.g., when products/prices change).
   */
  setCatalogContext(context: CatalogContext): void {
    this.catalogContext = context;
  }

  /**
   * Derive catalog context from a list of products.
   */
  setCatalogContextFromProducts(products: Product[]): void {
    if (products.length === 0) return;

    const maxPrice = Math.max(...products.map((p) => p.priceMax));
    const categoryNames = DEFAULT_CATALOG_CATEGORIES; // keep default for keyword matching
    this.catalogContext = { maxPrice, categoryNames };
  }

  /**
   * Detect whether a message requires escalation.
   */
  detectEscalation(
    message: string,
    context?: ConversationContext
  ): EscalationDetectionResult {
    return detectEscalation(message, context, this.catalogContext);
  }

  /**
   * Simple boolean check for escalation need.
   */
  shouldEscalate(message: string): { shouldEscalate: boolean; reason?: string } {
    const result = this.detectEscalation(message);
    return {
      shouldEscalate: result.shouldEscalate,
      reason: result.details,
    };
  }

  /**
   * Create an escalation record and notify the owner.
   */
  async createEscalation(
    reason: EscalationReason,
    contextSummary: string,
    channel: Channel
  ): Promise<EscalationRecord> {
    const escalation = await createEscalation(
      reason,
      contextSummary,
      channel,
      this.notificationService
    );

    this.escalations.push(escalation);
    return escalation;
  }

  /**
   * Handle a full escalation flow: detect, create record, notify.
   * Returns the escalation record if escalated, or null if not needed.
   */
  async handleMessage(
    message: string,
    channel: Channel,
    context?: ConversationContext,
    conversationSummary?: string
  ): Promise<EscalationRecord | null> {
    const detection = this.detectEscalation(message, context);

    if (!detection.shouldEscalate || !detection.reason) {
      return null;
    }

    const summary =
      conversationSummary ||
      `Customer message: "${message.slice(0, 450)}"`;

    return this.createEscalation(detection.reason, summary, channel);
  }

  /**
   * Get all escalation records.
   */
  getEscalations(): EscalationRecord[] {
    return [...this.escalations];
  }

  /**
   * Get escalations by status.
   */
  getEscalationsByStatus(status: EscalationStatus): EscalationRecord[] {
    return this.escalations.filter((e) => e.status === status);
  }
}
