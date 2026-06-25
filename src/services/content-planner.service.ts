/**
 * Content Planner Service
 *
 * Generates weekly content plans every Monday for Instagram/social media
 * targeting Austin-area cake buyers in La La Sweett's warm, creative brand voice.
 *
 * Responsibilities:
 * - Generate weekly content plan with ≥3 post topics, ≥3 story ideas, ≥3 caption drafts
 * - Schedule automatic generation every Monday at a configured time
 * - Provide a default/template content plan when AI is unavailable
 * - Deliver the plan via Telegram Bot and make it available via /content command
 *
 * Requirements: 9.4, 9.5
 */

import type { ContentPlan, ContentSuggestion, OwnerNotification } from '../types';
import { notificationService } from './notification.service';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default hour for Monday content plan delivery (9:00 AM local) */
const DEFAULT_CONTENT_PLAN_HOUR = 9;

/** Default minute for content plan delivery */
const DEFAULT_CONTENT_PLAN_MINUTE = 0;

/** Minimum required post topics */
const MIN_POST_TOPICS = 3;

/** Minimum required story ideas */
const MIN_STORY_IDEAS = 3;

/** Minimum required caption drafts */
const MIN_CAPTION_DRAFTS = 3;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Injectable AI content generation provider */
export type AIContentGenerator = () => Promise<ContentPlan>;

// -----------------------------------------------------------------------------
// Default Content Plans (rotated weekly)
// -----------------------------------------------------------------------------

/**
 * Pool of default post topics for Austin-area cake buyers.
 * Used when AI generation is unavailable.
 */
const DEFAULT_POST_TOPICS: ContentSuggestion[] = [
  {
    topic: 'Behind-the-scenes: decorating process for a custom birthday cake',
    format: 'post',
    caption:
      '✨ Every swirl, every detail — made with love right here in Austin! Watch this birthday beauty come to life 🎂💫 Which detail catches your eye? #LaLaSweett #AustinCakes #CustomCakes #CakeDecorating',
  },
  {
    topic: 'Seasonal flavor of the month reveal',
    format: 'post',
    caption:
      '🌸 NEW FLAVOR DROP! This month we\'re swooning over our Strawberry Champagne layer cake — perfect for spring celebrations in ATX! Book yours before they\'re gone 🍓🥂 #AustinBakery #CustomCakeATX',
  },
  {
    topic: 'Customer cake reveal and testimonial',
    format: 'post',
    caption:
      '💕 "It was even more beautiful than I imagined!" — Sarah K. Nothing makes our heart sing like happy customers! Ready to create YOUR dream cake? DM us to start planning 🎂✨ #LaLaSweett #AustinWedding',
  },
  {
    topic: 'Cake flavor pairing guide for events',
    format: 'post',
    caption:
      '🎨 Not sure which flavor matches your vibe? Here\'s our go-to pairing guide for Austin events! Swipe through to find your perfect match 👉🍰 #CakeFlavors #AustinEvents #WeddingCake',
  },
  {
    topic: 'Austin event spotlight: local celebrations we\'ve been part of',
    format: 'post',
    caption:
      '🤠 Austin, you know how to celebrate! From SoCo weddings to Lake Travis birthdays — we\'ve been honored to sweeten your best moments 🎂❤️ #ATXLife #AustinCelebrations #CustomCakesATX',
  },
];

/**
 * Pool of default story ideas.
 */
const DEFAULT_STORY_IDEAS: ContentSuggestion[] = [
  {
    topic: 'Quick poll: favorite frosting type',
    format: 'story',
    caption:
      '🧁 POLL TIME! Buttercream or fondant — which team are you? Tap to vote! 💛',
  },
  {
    topic: 'This or that: cake design edition',
    format: 'story',
    caption:
      '🎂 THIS OR THAT: Floral cascade vs. geometric modern design? Tell us your style! ✨',
  },
  {
    topic: 'Countdown to next available booking slot',
    format: 'story',
    caption:
      '⏰ BOOKING ALERT! Only 2 spots left for next month\'s weekends! DM us now to lock in your date 📅💕',
  },
  {
    topic: 'Sneak peek of a cake in progress',
    format: 'story',
    caption:
      '👀 Sneak peek! Can you guess what this cake is going to be? Answer reveal tomorrow! 🎂🔮',
  },
  {
    topic: 'Q&A: ask me anything about custom cakes',
    format: 'story',
    caption:
      '💬 It\'s Q&A time! Drop your custom cake questions and I\'ll answer them all! Nothing is too specific 🎂✨',
  },
];

/**
 * Pool of default caption drafts.
 */
const DEFAULT_CAPTIONS: string[] = [
  '🎂 Every cake tells a story. What story do you want YOUR cake to tell? DM us to bring your vision to life! 💌 #LaLaSweett #AustinCustomCakes #CakeArtist',
  '✨ Handcrafted with love in the heart of Austin, TX. From birthdays to weddings, we make every celebration a little sweeter! 🍰💕 #ATXBakery #CustomCakes',
  '🌟 Your dream cake is just a DM away! Tell us about your event and we\'ll create something magical just for you 🎂✨ #AustinCakes #OrderNow #LaLaSweett',
  '💐 Spring in Austin means wedding season! Book your free consultation today and let\'s design something unforgettable together 🤍🎂 #AustinWeddings #WeddingCake',
  '🧁 Small bites, big smiles! Our cupcakes and cake pops are perfect for Austin office parties, showers, and everything in between 💛 #AustinCatering #Cupcakes',
];

// -----------------------------------------------------------------------------
// Content Planner Service
// -----------------------------------------------------------------------------

export class ContentPlannerService {
  private _weeklyTimer: ReturnType<typeof setTimeout> | null = null;
  private _isRunning = false;
  private _aiGenerator: AIContentGenerator | null = null;
  private _lastGeneratedPlan: ContentPlan | null = null;

  /**
   * Set the AI content generation provider.
   * When set, the service uses AI to generate creative content plans.
   * When null, falls back to the default content pool.
   */
  setAIGenerator(generator: AIContentGenerator): void {
    this._aiGenerator = generator;
  }

  /**
   * Whether the scheduler is running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * The most recently generated content plan (for caching/retrieval).
   */
  get lastGeneratedPlan(): ContentPlan | null {
    return this._lastGeneratedPlan;
  }

  // ---------------------------------------------------------------------------
  // Core Content Plan Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate a weekly content plan.
   *
   * If an AI generator is configured, attempts AI generation first.
   * Falls back to the default content plan if AI is unavailable or fails.
   *
   * The plan always includes:
   * - ≥3 post topics with captions
   * - ≥3 story ideas with captions
   * - ≥3 standalone caption drafts
   *
   * Content targets Austin-area cake buyers in La La Sweett's brand voice.
   *
   * @returns A ContentPlan for the current week
   */
  async generateWeeklyContentPlan(): Promise<ContentPlan> {
    let plan: ContentPlan;

    if (this._aiGenerator) {
      try {
        plan = await this._aiGenerator();

        // Validate the AI-generated plan meets minimum requirements
        if (this.isValidContentPlan(plan)) {
          this._lastGeneratedPlan = plan;
          return plan;
        }
      } catch {
        // AI generation failed — fall back to default
      }
    }

    // Use default content plan
    plan = this.getDefaultContentPlan();
    this._lastGeneratedPlan = plan;
    return plan;
  }

  /**
   * Returns a default/template content plan.
   *
   * Selects from the default content pool, rotating based on week number
   * to provide variety even without AI generation.
   *
   * Always targets Austin-area cake buyers with La La Sweett's warm,
   * creative, personal brand voice.
   */
  getDefaultContentPlan(): ContentPlan {
    const now = new Date();
    const weekNumber = this.getWeekNumber(now);

    // Rotate through the default pool based on week number
    const postOffset = (weekNumber * 2) % DEFAULT_POST_TOPICS.length;
    const storyOffset = (weekNumber * 2) % DEFAULT_STORY_IDEAS.length;
    const captionOffset = (weekNumber * 2) % DEFAULT_CAPTIONS.length;

    const posts = this.selectRotating(DEFAULT_POST_TOPICS, postOffset, MIN_POST_TOPICS);
    const stories = this.selectRotating(DEFAULT_STORY_IDEAS, storyOffset, MIN_STORY_IDEAS);
    const captions = this.selectRotating(DEFAULT_CAPTIONS, captionOffset, MIN_CAPTION_DRAFTS);

    // Monday of this week
    const weekStarting = this.getMondayOfWeek(now);

    return {
      weekStarting,
      posts,
      stories,
      captions,
    };
  }

  // ---------------------------------------------------------------------------
  // Weekly Scheduling
  // ---------------------------------------------------------------------------

  /**
   * Schedule weekly content plan generation for every Monday.
   *
   * The plan is generated and delivered via Telegram Bot.
   * Uses setTimeout to schedule the next Monday occurrence.
   */
  scheduleWeeklyGeneration(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;
    this.scheduleNextMonday();
  }

  /**
   * Stop the weekly scheduler.
   */
  stopScheduler(): void {
    this._isRunning = false;

    if (this._weeklyTimer) {
      clearTimeout(this._weeklyTimer);
      this._weeklyTimer = null;
    }
  }

  /**
   * Execute the weekly content plan generation and delivery.
   *
   * Generates the plan and sends it to the owner via Telegram Bot.
   */
  async executeWeeklyContentPlan(): Promise<void> {
    const plan = await this.generateWeeklyContentPlan();
    await this.deliverContentPlanViaTelegram(plan);
  }

  // ---------------------------------------------------------------------------
  // Telegram Delivery
  // ---------------------------------------------------------------------------

  /**
   * Deliver a content plan to the owner via Telegram notification.
   */
  async deliverContentPlanViaTelegram(plan: ContentPlan): Promise<void> {
    const message = this.formatContentPlanMessage(plan);

    const notification: OwnerNotification = {
      type: 'system_alert',
      content: message,
      priority: 'normal',
    };

    await notificationService.notifyOwner(notification);
  }

  /**
   * Format a content plan into a readable Telegram message.
   */
  formatContentPlanMessage(plan: ContentPlan): string {
    const weekLabel = plan.weekStarting.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const postsSection = plan.posts
      .map(
        (p, i) =>
          `  ${i + 1}. <b>${p.topic}</b>\n     📝 ${p.caption}`
      )
      .join('\n\n');

    const storiesSection = plan.stories
      .map(
        (s, i) =>
          `  ${i + 1}. <b>${s.topic}</b>\n     📝 ${s.caption}`
      )
      .join('\n\n');

    const captionsSection = plan.captions
      .map((c, i) => `  ${i + 1}. ${c}`)
      .join('\n\n');

    return [
      `📋 <b>Weekly Content Plan</b>`,
      `📅 Week of ${weekLabel}`,
      '',
      '📸 <b>Post Topics:</b>',
      postsSection,
      '',
      '📱 <b>Story Ideas:</b>',
      storiesSection,
      '',
      '✍️ <b>Caption Drafts:</b>',
      captionsSection,
    ].join('\n');
  }

  /**
   * Get content suggestions for the /content Telegram command.
   *
   * Returns the most recent content plan formatted as ContentSuggestion[]
   * suitable for the Telegram Bot's content provider interface.
   *
   * @param count - Number of suggestions to return (default 3)
   */
  async getContentSuggestions(count: number = 3): Promise<ContentSuggestion[]> {
    const plan = this._lastGeneratedPlan ?? await this.generateWeeklyContentPlan();

    // Combine posts and stories and return the requested count
    const allSuggestions: ContentSuggestion[] = [
      ...plan.posts,
      ...plan.stories,
    ];

    return allSuggestions.slice(0, count);
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Schedule a timer for the next Monday at the configured time.
   */
  private scheduleNextMonday(): void {
    const msUntilNextMonday = this.getMillisecondsUntilNextMonday();

    this._weeklyTimer = setTimeout(async () => {
      await this.executeWeeklyContentPlan();

      // Reschedule for next Monday
      if (this._isRunning) {
        this.scheduleNextMonday();
      }
    }, msUntilNextMonday);
  }

  /**
   * Calculate milliseconds until the next Monday at the configured time.
   */
  getMillisecondsUntilNextMonday(): number {
    const now = new Date();
    const target = new Date(now);

    // Set target to the configured hour
    target.setHours(DEFAULT_CONTENT_PLAN_HOUR, DEFAULT_CONTENT_PLAN_MINUTE, 0, 0);

    // Calculate days until Monday (1 = Monday)
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    let daysUntilMonday = (1 - currentDay + 7) % 7;

    // If it's Monday but we've already passed the target time, go to next Monday
    if (daysUntilMonday === 0 && now >= target) {
      daysUntilMonday = 7;
    }

    target.setDate(target.getDate() + daysUntilMonday);

    return target.getTime() - now.getTime();
  }

  /**
   * Get the ISO week number for a date.
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Get the Monday of the current week.
   */
  private getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Select items from a pool with rotation offset for variety.
   */
  private selectRotating<T>(pool: T[], offset: number, count: number): T[] {
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
      result.push(pool[(offset + i) % pool.length]);
    }
    return result;
  }

  /**
   * Validate that a content plan meets minimum requirements.
   */
  private isValidContentPlan(plan: ContentPlan): boolean {
    return (
      plan.posts.length >= MIN_POST_TOPICS &&
      plan.stories.length >= MIN_STORY_IDEAS &&
      plan.captions.length >= MIN_CAPTION_DRAFTS
    );
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

export const contentPlannerService = new ContentPlannerService();

// Export constants for testing
export {
  DEFAULT_CONTENT_PLAN_HOUR,
  DEFAULT_CONTENT_PLAN_MINUTE,
  MIN_POST_TOPICS,
  MIN_STORY_IDEAS,
  MIN_CAPTION_DRAFTS,
  DEFAULT_POST_TOPICS,
  DEFAULT_STORY_IDEAS,
  DEFAULT_CAPTIONS,
};
