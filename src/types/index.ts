// =============================================================================
// La La Sweett Sales System — Shared TypeScript Interfaces and Types
// =============================================================================

// -----------------------------------------------------------------------------
// Channel Types
// -----------------------------------------------------------------------------

/** Supported messaging channels */
export type Channel = 'whatsapp' | 'instagram' | 'chat_widget';

// -----------------------------------------------------------------------------
// Message Types
// -----------------------------------------------------------------------------

/** Normalized inbound message from any channel */
export interface InboundMessage {
  id: string;
  channel: Channel;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/** Outbound message to be delivered to a channel */
export interface OutboundMessage {
  channel: Channel;
  recipientId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Message Router interface for handling channel-agnostic messaging */
export interface MessageRouter {
  handleInbound(message: InboundMessage): Promise<OutboundMessage>;
  deliverResponse(message: OutboundMessage): Promise<void>;
}

// -----------------------------------------------------------------------------
// AI Assistant Types
// -----------------------------------------------------------------------------

/** Configuration for the AI Assistant */
export interface AIAssistantConfig {
  systemPrompt: string;
  mcpTools: MCPToolSet;
  maxResponseTime: number; // default: 5000ms
  sessionTimeout: number; // default: 30 minutes (1800000ms)
}

/** Active conversation session with context */
export interface ConversationSession {
  sessionId: string;
  channel: Channel;
  customerId: string;
  messages: Message[];
  capturedIntent?: Partial<OrderIntentData>;
  createdAt: Date;
  lastActivityAt: Date;
}

/** AI Assistant response with optional actions */
export interface AIResponse {
  content: string;
  actions?: AIAction[];
}

/** Actions the AI can trigger */
export type AIAction =
  | { type: 'create_order_intent'; data: Partial<OrderIntentData> }
  | { type: 'escalate'; reason: string; summary: string }
  | { type: 'capture_field'; field: keyof OrderIntentData; value: unknown }
  | { type: 'calculate_servings'; guestCount: number };

/** AI Assistant interface */
export interface AIAssistant {
  processMessage(
    session: ConversationSession,
    message: InboundMessage
  ): Promise<AIResponse>;
}

// -----------------------------------------------------------------------------
// Order State Machine Types
// -----------------------------------------------------------------------------

/** All possible order states */
export type OrderState =
  | 'Inquiry'
  | 'Quoted'
  | 'Deposit_Received'
  | 'Confirmed'
  | 'In_Production'
  | 'Ready'
  | 'Delivered'
  | 'Picked_Up'
  | 'Cancelled';

/** Valid state transitions map — defines which states can transition to which */
export const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  Inquiry: ['Quoted', 'Cancelled'],
  Quoted: ['Deposit_Received', 'Cancelled'],
  Deposit_Received: ['Confirmed', 'Cancelled'],
  Confirmed: ['In_Production', 'Cancelled'],
  In_Production: ['Ready', 'Cancelled'],
  Ready: ['Delivered', 'Picked_Up'],
  Delivered: [],
  Picked_Up: [],
  Cancelled: [],
};

/** States from which cancellation triggers a refund flag */
export const REFUND_FLAG_STATES: OrderState[] = [
  'Deposit_Received',
  'Confirmed',
  'In_Production',
];

/** Context for a state transition */
export interface TransitionContext {
  triggeredBy: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** Audit record for state transitions */
export interface OrderStateTransition {
  id: string;
  orderId: string;
  fromState: OrderState;
  toState: OrderState;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// Order Types
// -----------------------------------------------------------------------------

/** Order entity */
export interface Order {
  id: string;
  customerId: string;
  state: OrderState;
  eventDate: Date;
  servings: number;
  flavorPreference: string;
  designDescription: string;
  budgetRange: string;
  quotedPrice?: number;
  depositAmount?: number;
  deliveryPreference?: 'delivery' | 'pickup';
  deliveryAddress?: string;
  originatingChannel: Channel;
  cancellationReason?: string;
  refundFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Data required to create an order intent */
export interface OrderIntentData {
  eventDate: Date;
  servings: number; // 10–500 (form), 1–500 (AI calculator)
  flavorPreference: string;
  designDescription: string; // max 1000 chars (form), 500 chars (WhatsApp)
  budgetRange: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/** Result of deposit verification */
export interface DepositVerification {
  valid: boolean;
  depositAmount: number;
  quotedPrice: number;
  minimumRequired: number;
  message?: string;
}

/** Order Service interface */
export interface OrderService {
  createOrderIntent(data: OrderIntentData): Promise<Order>;
  transitionState(
    orderId: string,
    newState: OrderState,
    context: TransitionContext
  ): Promise<Order>;
  getOrder(orderId: string): Promise<Order>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  cancelOrder(orderId: string, reason: string): Promise<Order>;
  verifyDeposit(orderId: string, amount: number): Promise<DepositVerification>;
}

// -----------------------------------------------------------------------------
// Product and Catalog Types
// -----------------------------------------------------------------------------

/** Product category */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  active: boolean;
}

/** Product entity */
export interface Product {
  id: string;
  categoryId: string;
  name: string;
  descriptionShort: string; // max 150 chars
  priceMin: number;
  priceMax: number;
  minServings: number;
  maxServings: number;
  leadTimeDays: number;
  imageUrl: string;
  allergenTags: string[];
  structuredData: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
}

/** Flavor for a product */
export interface Flavor {
  id: string;
  productId: string;
  name: string;
  available: boolean;
}

/** Paginated products response */
export interface PaginatedProducts {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Servings recommendation result */
export interface ServingsRecommendation {
  guestCount: number;
  recommendedServings: number;
  tierConfiguration: TierConfig[];
}

/** Tier configuration for servings */
export interface TierConfig {
  tier: number;
  servings: number;
  size: string;
}

/** Full catalog JSON response */
export interface CatalogJSON {
  categories: Category[];
  products: CatalogProduct[];
  lastUpdated: string;
}

/** Product as serialized in /api/catalog.json */
export interface CatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  descriptionShort: string;
  priceMin: number;
  priceMax: number;
  minServings: number;
  maxServings: number;
  leadTimeDays: number;
  imageUrl: string;
  allergenTags: string[];
  flavors: string[];
}

/** Catalog Service interface */
export interface CatalogService {
  getCategories(): Promise<Category[]>;
  getProductsByCategory(
    categorySlug: string,
    page: number,
    pageSize: number
  ): Promise<PaginatedProducts>;
  getProduct(productId: string): Promise<Product>;
  searchProducts(query: string): Promise<Product[]>;
  getFlavors(): Promise<Flavor[]>;
  calculateServings(guestCount: number): Promise<ServingsRecommendation>;
  getFullCatalog(): Promise<CatalogJSON>;
}

// -----------------------------------------------------------------------------
// Customer Types
// -----------------------------------------------------------------------------

/** Customer entity */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  deliveryAddress?: string;
  marketingConsent: boolean;
  consentTimestamp?: Date;
  consentChannel?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Consent record */
export interface ConsentRecord {
  id: string;
  customerId: string;
  consentType: string;
  granted: boolean;
  channel: string;
  recordedAt: Date;
}

/** Customer Service interface */
export interface CustomerService {
  getCustomer(customerId: string): Promise<Customer>;
  createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  updateCustomer(customerId: string, data: Partial<Customer>): Promise<Customer>;
  deleteCustomerPII(customerId: string): Promise<void>;
}

// -----------------------------------------------------------------------------
// Conversation and Message Types
// -----------------------------------------------------------------------------

/** Conversation status */
export type ConversationStatus = 'active' | 'resolved' | 'escalated';

/** Intent tag categories */
export type IntentTag =
  | 'pricing_inquiry'
  | 'availability_check'
  | 'custom_design_request'
  | 'order_status'
  | 'general_question';

/** Conversation entity */
export interface Conversation {
  id: string;
  customerId: string;
  channel: Channel;
  sessionId: string;
  intentTags: IntentTag[];
  status: ConversationStatus;
  startedAt: Date;
  lastActivityAt: Date;
}

/** Message role */
export type MessageRole = 'customer' | 'assistant';

/** Message entity */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

// -----------------------------------------------------------------------------
// Escalation Types
// -----------------------------------------------------------------------------

/** Escalation status */
export type EscalationStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed';

/** Escalation entity */
export interface Escalation {
  id: string;
  conversationId: string;
  reason: string;
  contextSummary: string; // max 500 chars
  originatingChannel: Channel;
  status: EscalationStatus;
  createdAt: Date;
  resolvedAt?: Date;
}

// -----------------------------------------------------------------------------
// Notification Types
// -----------------------------------------------------------------------------

/** Notification status */
export type NotificationStatus = 'pending' | 'delivered' | 'failed' | 'queued';

/** Notification entity */
export interface Notification {
  id: string;
  type: string;
  recipientType: 'owner' | 'customer';
  recipientId: string;
  content: string;
  actions?: TelegramInlineButton[];
  status: NotificationStatus;
  retryCount: number;
  createdAt: Date;
  deliveredAt?: Date;
}

/** Telegram inline button for owner actions */
export interface TelegramInlineButton {
  text: string;
  callbackData: string;
}

/** Owner notification types */
export type OwnerNotificationType =
  | 'new_order'
  | 'escalation'
  | 'unresponded_alert'
  | 'daily_summary'
  | 'system_alert';

/** Owner notification payload */
export interface OwnerNotification {
  type: OwnerNotificationType;
  content: string;
  actions?: TelegramInlineButton[];
  priority: 'high' | 'normal';
}

/** Customer notification payload */
export interface CustomerNotification {
  customerId: string;
  channel: Channel;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Queued notification for Redis */
export interface QueuedNotification {
  id: string;
  notification: OwnerNotification | CustomerNotification;
  queuedAt: Date;
  retryCount: number;
}

/** Notification Service interface */
export interface NotificationService {
  notifyOwner(notification: OwnerNotification): Promise<void>;
  notifyCustomer(notification: CustomerNotification): Promise<void>;
  queueNotification(notification: QueuedNotification): Promise<void>;
  processQueue(): Promise<void>;
  sendDailySummary(): Promise<void>;
}

// -----------------------------------------------------------------------------
// Marketing Types
// -----------------------------------------------------------------------------

/** Marketing channel entity */
export interface MarketingChannel {
  id: string;
  name: string;
  monthlyBudget: number;
  channelType: string;
}

/** Marketing attribution entity */
export interface MarketingAttribution {
  id: string;
  customerId: string;
  channelId: string;
  referralSource: string;
  firstInteraction: Date;
  attributedAt: Date;
}

/** Budget allocation across channels (must sum to $100.00) */
export interface BudgetAllocation {
  allocations: ChannelAllocation[];
  totalBudget: number; // always 100.00
  month: string;
  generatedAt: Date;
}

/** Single channel allocation */
export interface ChannelAllocation {
  channelId: string;
  channelName: string;
  amount: number; // non-negative
}

/** ROI metrics for a channel */
export interface ChannelROI {
  channelId: string;
  spend: number;
  inquiryCount: number;
  orderCount: number;
  costPerInquiry?: number; // undefined if inquiryCount = 0
  costPerOrder?: number; // undefined if orderCount = 0
  insufficientData: boolean; // true if inquiryCount < 5
}

/** Content suggestion for social media */
export interface ContentSuggestion {
  topic: string;
  format: 'post' | 'story' | 'reel';
  caption: string;
}

/** Weekly content plan */
export interface ContentPlan {
  weekStarting: Date;
  posts: ContentSuggestion[];
  stories: ContentSuggestion[];
  captions: string[];
}

/** Seasonal recommendation */
export interface SeasonalRecommendation {
  eventName: string;
  eventDate: Date;
  recommendedStartDate: Date; // at least 28 days before event
  promotionIdeas: string[];
}

/** Weekly analytics report */
export interface WeeklyReport {
  weekStarting: Date;
  weekEnding: Date;
  totalConversationsByChannel: Record<Channel, number>;
  topTopics: { topic: string; count: number }[];
  conversionRate: number;
  averageResponseTimeByChannel: Record<Channel, number>;
  orderSummary?: {
    total: number;
    inquiries: number;
    confirmed: number;
    inProduction: number;
    completed: number;
    revenue: number;
  };
  ordersByChannel?: Record<Channel, number>;
}

/** Daily summary for Telegram */
export interface DailySummary {
  date: Date;
  totalInquiries: number;
  ordersReceived: number;
  estimatedRevenue: number;
  topCakeTypes: { type: string; count: number }[];
}

/** Marketing Service interface */
export interface MarketingService {
  generateBudgetAllocation(): Promise<BudgetAllocation>;
  trackConversion(customerId: string, channel: string): Promise<void>;
  getROIMetrics(month: string): Promise<ChannelROI[]>;
  generateSeasonalRecommendations(): Promise<SeasonalRecommendation[]>;
  getWeeklyAnalytics(): Promise<WeeklyReport>;
  generateContentSuggestions(count: number): Promise<ContentSuggestion[]>;
  sendReviewSolicitation(orderId: string): Promise<void>;
}

// -----------------------------------------------------------------------------
// MCP (Model Context Protocol) Types
// -----------------------------------------------------------------------------

/** MCP tool definition */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** MCP tool call request */
export interface MCPToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

/** MCP tool call result */
export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Set of available MCP tools */
export interface MCPToolSet {
  tools: MCPTool[];
}

/** MCP Server interface — all MCP servers implement this */
export interface MCPServer {
  name: string;
  tools: MCPTool[];
  handleToolCall(call: MCPToolCall): Promise<MCPToolResult>;
}

/** MCP Server names */
export type MCPServerName =
  | 'catalog'
  | 'orders'
  | 'customers'
  | 'calendar'
  | 'notifications'
  | 'marketing';

// -----------------------------------------------------------------------------
// Integration Types — WhatsApp
// -----------------------------------------------------------------------------

/** WhatsApp webhook payload (simplified) */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: {
    id: string;
    changes: {
      field: string;
      value: {
        messages?: {
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }[];
        contacts?: { profile: { name: string }; wa_id: string }[];
      };
    }[];
  }[];
}

/** WhatsApp Integration interface */
export interface WhatsAppIntegration {
  handleWebhook(payload: WhatsAppWebhookPayload): Promise<void>;
  sendMessage(recipientPhone: string, content: string): Promise<void>;
  sendTemplate(
    recipientPhone: string,
    templateName: string,
    params: Record<string, string>
  ): Promise<void>;
}

// -----------------------------------------------------------------------------
// Integration Types — Instagram
// -----------------------------------------------------------------------------

/** Instagram DM webhook payload (simplified) */
export interface InstagramDMPayload {
  object: string;
  entry: {
    id: string;
    messaging: {
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: { mid: string; text: string };
    }[];
  }[];
}

/** Instagram comment webhook payload (simplified) */
export interface InstagramCommentPayload {
  object: string;
  entry: {
    id: string;
    changes: {
      field: string;
      value: {
        id: string;
        text: string;
        from: { id: string; username: string };
        media: { id: string };
      };
    }[];
  }[];
}

/** Instagram Integration interface */
export interface InstagramIntegration {
  handleDMWebhook(payload: InstagramDMPayload): Promise<void>;
  handleCommentWebhook(payload: InstagramCommentPayload): Promise<void>;
  sendDM(recipientId: string, content: string): Promise<void>;
  replyToComment(commentId: string, content: string): Promise<void>;
  generateWeeklyContentPlan(): Promise<ContentPlan>;
}

// -----------------------------------------------------------------------------
// Integration Types — Telegram
// -----------------------------------------------------------------------------

/** Telegram command (simplified) */
export interface TelegramCommand {
  command: string;
  chatId: number;
  args?: string;
}

/** Telegram callback query (simplified) */
export interface TelegramCallbackQuery {
  id: string;
  chatId: number;
  data: string;
  messageId: number;
}

/** Telegram Bot interface */
export interface TelegramBot {
  sendNotification(notification: OwnerNotification): Promise<void>;
  handleCommand(command: TelegramCommand): Promise<{ command: string; response: string; chatId: number }>;
  handleCallbackQuery(query: TelegramCallbackQuery): Promise<{ action: string; orderId: string; answerText: string }>;
  sendDailySummary(summary: DailySummary): Promise<void>;
}

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

/** Validation error field detail */
export interface ValidationFieldError {
  field: string;
  reason: string;
}

/** Standardized API error response */
export interface APIError {
  error: {
    code: string; // e.g., "VALIDATION_FAILED", "RATE_LIMITED", "NOT_FOUND"
    message: string; // Human-readable, no internal details
    fields?: ValidationFieldError[];
    retryAfter?: number; // Seconds until retry (for rate limits)
  };
}

/** Error codes used across the system */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'DEPOSIT_INSUFFICIENT'
  | 'DELIVERY_ZONE_INVALID'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT';

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

/** Timestamp-aware entity base */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
}

/** Pagination request parameters */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Generic paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
