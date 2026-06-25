// =============================================================================
// La La Sweett Sales System — Escalation Service Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectHumanRequest,
  detectSculpted3D,
  detectMultiTierAboveFive,
  detectPricingBeyondRange,
  detectDesignNotInCatalog,
  detectEscalation,
  shouldEscalate,
  createEscalation,
  EscalationService,
  type ConversationContext,
  type CatalogContext,
  type EscalationReason,
} from './escalation.service';
import type { NotificationService } from '@/types';

// -----------------------------------------------------------------------------
// Mock Notification Service
// -----------------------------------------------------------------------------

function createMockNotificationService(): NotificationService {
  return {
    notifyOwner: vi.fn().mockResolvedValue(undefined),
    notifyCustomer: vi.fn().mockResolvedValue(undefined),
    queueNotification: vi.fn().mockResolvedValue(undefined),
    processQueue: vi.fn().mockResolvedValue(undefined),
    sendDailySummary: vi.fn().mockResolvedValue(undefined),
  };
}

// -----------------------------------------------------------------------------
// Human Request Detection
// -----------------------------------------------------------------------------

describe('detectHumanRequest', () => {
  it('should detect "human" keyword', () => {
    expect(detectHumanRequest('I want to talk to a human')).toBe(true);
  });

  it('should detect "person" keyword', () => {
    expect(detectHumanRequest('Can I speak to a person?')).toBe(true);
  });

  it('should detect "owner" keyword', () => {
    expect(detectHumanRequest('Please connect me with the owner')).toBe(true);
  });

  it('should detect "real person" keyword', () => {
    expect(detectHumanRequest('I need a real person')).toBe(true);
  });

  it('should detect "connect me" keyword', () => {
    expect(detectHumanRequest('Can you connect me to someone?')).toBe(true);
  });

  it('should detect "manager" keyword', () => {
    expect(detectHumanRequest('Let me speak to the manager')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(detectHumanRequest('I WANT TO TALK TO A HUMAN')).toBe(true);
  });

  it('should not trigger on unrelated messages', () => {
    expect(detectHumanRequest('I want a chocolate cake for 20 people')).toBe(false);
  });

  it('should not trigger on empty messages', () => {
    expect(detectHumanRequest('')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Sculpted 3D Detection
// -----------------------------------------------------------------------------

describe('detectSculpted3D', () => {
  it('should detect "sculpted" keyword', () => {
    expect(detectSculpted3D('I want a sculpted dinosaur cake')).toBe(true);
  });

  it('should detect "3d" keyword', () => {
    expect(detectSculpted3D('Can you do a 3d car cake?')).toBe(true);
  });

  it('should detect "3-d" keyword', () => {
    expect(detectSculpted3D('Looking for a 3-d design')).toBe(true);
  });

  it('should detect "carved" keyword', () => {
    expect(detectSculpted3D('I need a carved guitar cake')).toBe(true);
  });

  it('should detect "shaped like" keyword', () => {
    expect(detectSculpted3D('I want a cake shaped like a castle')).toBe(true);
  });

  it('should detect "life-size" keyword', () => {
    expect(detectSculpted3D('Can you make a life-size shoe cake?')).toBe(true);
  });

  it('should detect "realistic" keyword', () => {
    expect(detectSculpted3D('I want a realistic looking purse cake')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(detectSculpted3D('SCULPTED CAKE PLEASE')).toBe(true);
  });

  it('should not trigger on standard cake requests', () => {
    expect(detectSculpted3D('I want a 2-tier vanilla birthday cake')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Multi-Tier >5 Detection
// -----------------------------------------------------------------------------

describe('detectMultiTierAboveFive', () => {
  it('should detect "6 tier"', () => {
    expect(detectMultiTierAboveFive('I want a 6 tier wedding cake')).toBe(true);
  });

  it('should detect "7-tier"', () => {
    expect(detectMultiTierAboveFive('Can you do a 7-tier cake?')).toBe(true);
  });

  it('should detect "8 tier"', () => {
    expect(detectMultiTierAboveFive('Looking for an 8 tier design')).toBe(true);
  });

  it('should detect "10 tier"', () => {
    expect(detectMultiTierAboveFive('I need a 10 tier cake')).toBe(true);
  });

  it('should detect "six tier" (word form)', () => {
    expect(detectMultiTierAboveFive('six tier wedding cake please')).toBe(true);
  });

  it('should detect "seven tier" (word form)', () => {
    expect(detectMultiTierAboveFive('I want a seven tier cake')).toBe(true);
  });

  it('should NOT detect 5 tiers or fewer', () => {
    expect(detectMultiTierAboveFive('I want a 5 tier cake')).toBe(false);
    expect(detectMultiTierAboveFive('3 tier wedding cake')).toBe(false);
    expect(detectMultiTierAboveFive('2-tier birthday cake')).toBe(false);
  });

  it('should NOT detect 1 tier', () => {
    expect(detectMultiTierAboveFive('single tier cake')).toBe(false);
  });

  it('should not trigger on unrelated numbers', () => {
    expect(detectMultiTierAboveFive('I need 6 cupcakes')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Pricing Beyond Range Detection
// -----------------------------------------------------------------------------

describe('detectPricingBeyondRange', () => {
  it('should detect prices above max catalog price (default $800)', () => {
    expect(detectPricingBeyondRange('My budget is $1000')).toBe(true);
    expect(detectPricingBeyondRange('I can spend $1,500 on this')).toBe(true);
  });

  it('should detect prices with custom max', () => {
    expect(detectPricingBeyondRange('My budget is $600', 500)).toBe(true);
  });

  it('should NOT trigger for prices within range', () => {
    expect(detectPricingBeyondRange('My budget is $500')).toBe(false);
    expect(detectPricingBeyondRange('I can spend $200')).toBe(false);
    expect(detectPricingBeyondRange('Budget is $800')).toBe(false);
  });

  it('should detect "dollars" format', () => {
    expect(detectPricingBeyondRange('I have 1200 dollars to spend')).toBe(true);
  });

  it('should detect "budget of" format', () => {
    expect(detectPricingBeyondRange('budget of $2000 for the event')).toBe(true);
  });

  it('should not trigger when no price mentioned', () => {
    expect(detectPricingBeyondRange('I want a big cake')).toBe(false);
  });

  it('should handle decimal prices', () => {
    expect(detectPricingBeyondRange('Budget is $850.50')).toBe(true);
    expect(detectPricingBeyondRange('Budget is $799.99')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Design Not In Catalog Detection
// -----------------------------------------------------------------------------

describe('detectDesignNotInCatalog', () => {
  const categories = [
    'birthday',
    'wedding',
    'baby shower',
    'graduation',
    'holiday',
    'cupcakes',
    'cookies',
  ];

  it('should detect design requests not matching any category', () => {
    expect(
      detectDesignNotInCatalog('I want a corporate event cake', categories)
    ).toBe(true);
  });

  it('should detect "looking for" with non-catalog design', () => {
    expect(
      detectDesignNotInCatalog(
        'Looking for a dinosaur fossil excavation theme',
        categories
      )
    ).toBe(true);
  });

  it('should NOT trigger for messages matching catalog categories', () => {
    expect(
      detectDesignNotInCatalog('I want a birthday cake for my daughter', categories)
    ).toBe(false);
  });

  it('should NOT trigger for wedding category', () => {
    expect(
      detectDesignNotInCatalog('I need a wedding cake for 100 guests', categories)
    ).toBe(false);
  });

  it('should NOT trigger for non-design messages', () => {
    expect(
      detectDesignNotInCatalog('What are your delivery hours?', categories)
    ).toBe(false);
  });

  it('should NOT trigger for simple pricing inquiries', () => {
    expect(
      detectDesignNotInCatalog('How much does a cake cost?', categories)
    ).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Full Escalation Detection
// -----------------------------------------------------------------------------

describe('detectEscalation', () => {
  it('should detect human request', () => {
    const result = detectEscalation('I want to talk to the owner');
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('human_requested');
  });

  it('should detect multi-tier >5', () => {
    const result = detectEscalation('I need a 7 tier wedding cake');
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('multi_tier_complex');
  });

  it('should detect sculpted 3D', () => {
    const result = detectEscalation('Can you make a sculpted dinosaur?');
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('sculpted_3d_design');
  });

  it('should detect pricing beyond range', () => {
    const result = detectEscalation('My budget is $1500');
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('pricing_beyond_range');
  });

  it('should detect design not in catalog', () => {
    const result = detectEscalation('I want a corporate retreat cake');
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('design_not_in_catalog');
  });

  it('should detect clarification failure from context', () => {
    const context: ConversationContext = {
      clarificationAttempts: 1,
      channel: 'whatsapp',
    };
    const result = detectEscalation('asdfghjkl', context);
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('clarification_failed');
  });

  it('should NOT escalate normal messages', () => {
    const result = detectEscalation(
      'I want a birthday cake for 20 people with chocolate flavor'
    );
    expect(result.shouldEscalate).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('should NOT escalate simple pricing queries within range', () => {
    const result = detectEscalation('How much for a cake? Budget is $300');
    expect(result.shouldEscalate).toBe(false);
  });

  it('should use custom catalog context for pricing', () => {
    const catalogContext: CatalogContext = {
      maxPrice: 400,
      categoryNames: ['birthday', 'wedding'],
    };
    const result = detectEscalation('My budget is $500', undefined, catalogContext);
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBe('pricing_beyond_range');
  });

  it('should prioritize human request over other triggers', () => {
    // Message that could match both human_requested and sculpted_3d
    const result = detectEscalation(
      'I want to talk to the owner about a sculpted cake'
    );
    expect(result.reason).toBe('human_requested');
  });
});

// -----------------------------------------------------------------------------
// shouldEscalate convenience function
// -----------------------------------------------------------------------------

describe('shouldEscalate', () => {
  it('should return true with reason for escalation triggers', () => {
    const result = shouldEscalate('I need a real person');
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it('should return false for normal messages', () => {
    const result = shouldEscalate('What flavors do you have?');
    expect(result.shouldEscalate).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// createEscalation
// -----------------------------------------------------------------------------

describe('createEscalation', () => {
  let mockNotificationService: NotificationService;

  beforeEach(() => {
    mockNotificationService = createMockNotificationService();
  });

  it('should create an escalation record with correct fields', async () => {
    const record = await createEscalation(
      'human_requested',
      'Customer asked to speak with the owner about a custom design.',
      'whatsapp',
      mockNotificationService
    );

    expect(record.id).toBeDefined();
    expect(record.reason).toBe('human_requested');
    expect(record.contextSummary).toBe(
      'Customer asked to speak with the owner about a custom design.'
    );
    expect(record.originatingChannel).toBe('whatsapp');
    expect(record.status).toBe('pending');
    expect(record.createdAt).toBeDefined();
  });

  it('should truncate context summary to 500 chars', async () => {
    const longSummary = 'A'.repeat(600);
    const record = await createEscalation(
      'sculpted_3d_design',
      longSummary,
      'instagram',
      mockNotificationService
    );

    expect(record.contextSummary.length).toBeLessThanOrEqual(500);
    expect(record.contextSummary.endsWith('...')).toBe(true);
  });

  it('should not truncate summaries of exactly 500 chars', async () => {
    const exactSummary = 'B'.repeat(500);
    const record = await createEscalation(
      'pricing_beyond_range',
      exactSummary,
      'chat_widget',
      mockNotificationService
    );

    expect(record.contextSummary.length).toBe(500);
    expect(record.contextSummary).toBe(exactSummary);
  });

  it('should notify owner via notification service', async () => {
    await createEscalation(
      'human_requested',
      'Customer wants to speak with owner.',
      'whatsapp',
      mockNotificationService
    );

    expect(mockNotificationService.notifyOwner).toHaveBeenCalledTimes(1);
    expect(mockNotificationService.notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'escalation',
        priority: 'high',
      })
    );
  });

  it('should include escalation details in notification content', async () => {
    await createEscalation(
      'multi_tier_complex',
      'Customer wants 8-tier wedding cake.',
      'instagram',
      mockNotificationService
    );

    const call = (mockNotificationService.notifyOwner as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(call.content).toContain('Escalation');
    expect(call.content).toContain('instagram');
    expect(call.content).toContain('Customer wants 8-tier wedding cake.');
  });
});

// -----------------------------------------------------------------------------
// EscalationService class
// -----------------------------------------------------------------------------

describe('EscalationService', () => {
  let service: EscalationService;
  let mockNotificationService: NotificationService;

  beforeEach(() => {
    mockNotificationService = createMockNotificationService();
    service = new EscalationService(mockNotificationService);
  });

  describe('detectEscalation', () => {
    it('should detect escalation triggers', () => {
      const result = service.detectEscalation('I want to talk to the owner');
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toBe('human_requested');
    });

    it('should use custom catalog context', () => {
      service.setCatalogContext({ maxPrice: 300, categoryNames: ['birthday'] });
      const result = service.detectEscalation('Budget is $400');
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toBe('pricing_beyond_range');
    });
  });

  describe('shouldEscalate', () => {
    it('should return boolean and reason', () => {
      const result = service.shouldEscalate('Please connect me to someone');
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toBeDefined();
    });
  });

  describe('createEscalation', () => {
    it('should create and store an escalation record', async () => {
      const record = await service.createEscalation(
        'sculpted_3d_design',
        'Customer wants a 3D dragon cake.',
        'chat_widget'
      );

      expect(record.reason).toBe('sculpted_3d_design');
      expect(record.originatingChannel).toBe('chat_widget');
      expect(service.getEscalations()).toHaveLength(1);
    });

    it('should notify owner', async () => {
      await service.createEscalation(
        'human_requested',
        'Customer asked for owner.',
        'whatsapp'
      );

      expect(mockNotificationService.notifyOwner).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMessage', () => {
    it('should detect and escalate when trigger found', async () => {
      const record = await service.handleMessage(
        'I want a sculpted 3D cake',
        'whatsapp'
      );

      expect(record).not.toBeNull();
      expect(record!.reason).toBe('sculpted_3d_design');
      expect(mockNotificationService.notifyOwner).toHaveBeenCalled();
    });

    it('should return null when no escalation needed', async () => {
      const record = await service.handleMessage(
        'I want a birthday cake for 20 people',
        'chat_widget'
      );

      expect(record).toBeNull();
      expect(mockNotificationService.notifyOwner).not.toHaveBeenCalled();
    });

    it('should use provided conversation summary', async () => {
      const record = await service.handleMessage(
        'I need a real person',
        'instagram',
        undefined,
        'Customer has been asking about complex custom design for 5 minutes.'
      );

      expect(record!.contextSummary).toBe(
        'Customer has been asking about complex custom design for 5 minutes.'
      );
    });

    it('should auto-generate summary from message when not provided', async () => {
      const record = await service.handleMessage(
        'Can I talk to the owner please?',
        'whatsapp'
      );

      expect(record!.contextSummary).toContain('Can I talk to the owner please?');
    });

    it('should escalate when clarification attempts exhausted', async () => {
      const context: ConversationContext = {
        clarificationAttempts: 1,
        channel: 'whatsapp',
      };

      const record = await service.handleMessage(
        'xyzzy wombat',
        'whatsapp',
        context
      );

      expect(record).not.toBeNull();
      expect(record!.reason).toBe('clarification_failed');
    });
  });

  describe('getEscalations', () => {
    it('should return all stored escalations', async () => {
      await service.createEscalation('human_requested', 'Test 1', 'whatsapp');
      await service.createEscalation('sculpted_3d_design', 'Test 2', 'instagram');

      const escalations = service.getEscalations();
      expect(escalations).toHaveLength(2);
    });
  });

  describe('getEscalationsByStatus', () => {
    it('should filter by status', async () => {
      await service.createEscalation('human_requested', 'Test 1', 'whatsapp');
      await service.createEscalation('sculpted_3d_design', 'Test 2', 'instagram');

      const pending = service.getEscalationsByStatus('pending');
      expect(pending).toHaveLength(2);

      const resolved = service.getEscalationsByStatus('resolved');
      expect(resolved).toHaveLength(0);
    });
  });

  describe('setCatalogContextFromProducts', () => {
    it('should derive max price from products', () => {
      const products = [
        { priceMax: 200 } as any,
        { priceMax: 500 } as any,
        { priceMax: 350 } as any,
      ];

      service.setCatalogContextFromProducts(products);

      // Now $600 should trigger, but $500 should not
      const result1 = service.detectEscalation('Budget is $600');
      expect(result1.shouldEscalate).toBe(true);
      expect(result1.reason).toBe('pricing_beyond_range');

      const result2 = service.detectEscalation('Budget is $400');
      expect(result2.shouldEscalate).toBe(false);
    });

    it('should handle empty products array gracefully', () => {
      service.setCatalogContextFromProducts([]);
      // Should still use default max price
      const result = service.detectEscalation('Budget is $900');
      expect(result.shouldEscalate).toBe(true);
    });
  });
});
