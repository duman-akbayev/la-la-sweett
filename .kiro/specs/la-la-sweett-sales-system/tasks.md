# Implementation Plan: La La Sweett Sales System

## Overview

This plan implements the AI-assisted sales platform for La La Sweett bakery in three phases: Core (website, catalog, order intake, WhatsApp AI, Telegram notifications), Intelligence (chat widget, Instagram DM, order state machine, conversation history), and Growth (marketing optimizer, content planner, review solicitation, analytics). The stack is Next.js 14+ with Tailwind CSS, Node.js backend with Express, PostgreSQL/Supabase, Redis, Claude API, and integrations with WhatsApp Business API, Telegram Bot API, and Instagram/Meta API. Property-based tests use fast-check; unit/integration tests use Vitest.

## Tasks

- [x] 1. Project scaffolding, database schema, and shared types
  - [x] 1.1 Initialize Next.js 14+ App Router project with TypeScript and Tailwind CSS
    - Create project with `create-next-app` using App Router, TypeScript strict mode, Tailwind CSS v3.4+
    - Set up folder structure: `src/app/`, `src/components/`, `src/lib/`, `src/services/`, `src/mcp/`, `src/types/`
    - Configure ESLint, Prettier, Vitest, and fast-check
    - Add environment variable template (.env.example) for all API keys
    - _Requirements: 1.1, 4.1, 4.5_

  - [x] 1.2 Define shared TypeScript interfaces and types
    - Create `src/types/index.ts` with all interfaces: InboundMessage, OutboundMessage, OrderIntent, OrderState, ConversationSession, AIResponse, Product, Category, Customer, etc.
    - Define OrderState union type and valid transition map
    - Define MCP tool types and server interfaces
    - _Requirements: 13.1, 2.1, 6.6_

  - [x] 1.3 Set up PostgreSQL/Supabase schema and migrations
    - Create migration files for all tables: customers, categories, products, product_flavors, orders, order_state_transitions, conversations, messages, escalations, consent_records, marketing_channels, marketing_attributions, notifications
    - Implement all constraints from the design: field lengths, enums, foreign keys
    - Seed initial data for categories (Birthday, Wedding, Baby Shower, Graduation, Holiday/Seasonal, Character/Themed, Cupcakes, Cake Pops, Cookies, Mini Dessert Tables)
    - _Requirements: 1.1, 11.5, 15.2_

  - [x] 1.4 Set up Redis connection and session configuration
    - Configure Redis client for session management, rate limiting, and notification queuing
    - Create utility modules for Redis operations (session get/set/expire, rate limit check, queue push/pop)
    - _Requirements: 11.3, 11.4, 12.3_

  - [x]* 1.5 Write property tests for input validation (Properties 4, 21)
    - **Property 4: Input validation enforcement** — generate random form data testing boundary conditions for name (100 chars), email (254 chars), phone (20 chars, digits-only), text (2000 chars), script tag rejection
    - **Property 21: Input validation enforcement** — validate acceptance of valid inputs within constraints
    - **Validates: Requirements 2.1, 11.1, 11.7**

- [x] 2. Catalog Service and product display
  - [x] 2.1 Implement Catalog Service with database queries
    - Create `src/services/catalog.service.ts` implementing CatalogService interface
    - Implement getCategories, getProductsByCategory (with pagination), getProduct, searchProducts, getFlavors, calculateServings, getFullCatalog
    - Connect to Supabase/PostgreSQL for data retrieval
    - _Requirements: 1.1, 1.2, 1.5, 5.6_

  - [x] 2.2 Implement MCP Catalog Server
    - Create `src/mcp/catalog-server.ts` exposing tools: get_categories, get_products, get_product_by_id, search_products, get_flavors, get_pricing_range, calculate_servings
    - Wire to Catalog Service methods
    - _Requirements: 6.3, 6.7_

  - [x] 2.3 Build catalog pages with ISR (category gallery + pagination)
    - Create `src/app/cakes/[category]/page.tsx` with ISR (revalidate every 60s)
    - Implement photo gallery grid with 12 items per page and pagination controls
    - Display starting price in "$X – $Y" format for each item
    - Show empty state message when category has no products
    - _Requirements: 1.2, 1.4_

  - [x] 2.4 Implement product listing rendering with allergen tags
    - Render product name, category, photo, starting price, description (max 150 chars)
    - Display allergen accommodation tags (nut-free, gluten-free) from product data
    - _Requirements: 1.3, 3.2_

  - [x] 2.5 Implement JSON-LD structured data for products and LocalBusiness
    - Generate schema.org/Product JSON-LD for each product (name, description, offers with price)
    - Generate schema.org/LocalBusiness JSON-LD on all pages (name, address, phone, hours)
    - _Requirements: 1.6, 5.7_

  - [x] 2.6 Create /api/catalog.json public endpoint
    - Expose full catalog with numeric price fields, unit indicators, constraint fields (min_servings as integer, lead_time_days as integer, flavors as enumerated array)
    - _Requirements: 1.5, 5.6_

  - [x]* 2.7 Write property tests for catalog (Properties 1, 2, 3, 7, 11)
    - **Property 1: Pagination Correctness** — for random N products, verify ceil(N/12) pages, each ≤12 items, union = original set
    - **Property 2: Product Listing Completeness** — for random products, verify name, category, image, price, description ≤150 chars
    - **Property 3: JSON-LD Product Markup** — for random products, validate schema.org/Product fields match catalog data
    - **Property 7: Allergen Tag Display** — for products with allergen tags, verify all tags appear in rendered output
    - **Property 11: Catalog JSON Structure** — verify numeric prices, integer servings/lead_time, flavors as array
    - **Validates: Requirements 1.2, 1.3, 1.6, 3.2, 5.6**

- [x] 3. Checkpoint - Verify catalog and types
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Order Service and inquiry form
  - [x] 4.1 Implement Order Service with state machine
    - Create `src/services/order.service.ts` implementing OrderService interface
    - Implement createOrderIntent, transitionState (with valid transitions map), getOrder, getOrdersByCustomer, cancelOrder, verifyDeposit
    - Enforce valid state transitions: Inquiry→Quoted→Deposit_Received→Confirmed→In_Production→Ready→Delivered/Picked_Up
    - Record OrderStateTransition audit entries on every successful transition
    - _Requirements: 13.1, 13.2, 13.6, 13.8_

  - [x] 4.2 Implement delivery zone validation
    - Create `src/services/delivery-zone.service.ts` with Austin metro zone boundary check
    - Reject Confirmed transition if delivery address is outside zone; retain order in Deposit_Received state
    - Notify customer with pickup alternative suggestion
    - _Requirements: 13.4, 13.5_

  - [x] 4.3 Implement deposit verification logic
    - Verify deposit amount ≥ 50% of quoted price before transitioning to Deposit_Received
    - Reject with descriptive error and minimum amount if insufficient
    - _Requirements: 13.6, 13.7_

  - [x] 4.4 Implement cancellation with refund flagging
    - Flag orders for refund review when cancelled from Deposit_Received, Confirmed, or In_Production
    - Do not flag orders cancelled from Inquiry or Quoted state
    - Record cancellation reason
    - _Requirements: 13.8_

  - [x] 4.5 Implement MCP Orders Server
    - Create `src/mcp/orders-server.ts` exposing tools: create_order_intent, get_order_status, update_order_state, get_orders_by_customer, validate_delivery_zone
    - Wire to Order Service methods
    - _Requirements: 13.1, 13.3_

  - [x]* 4.6 Write property tests for Order Service (Properties 24, 25, 26, 27, 28)
    - **Property 24: Order State Machine Validity** — generate random state+action pairs, verify only valid transitions succeed and invalid ones are rejected
    - **Property 25: Order State Transition Audit** — verify every successful transition creates audit record with from-state, to-state, action, timestamp
    - **Property 26: Delivery Zone Validation** — generate random addresses, verify zone acceptance/rejection logic
    - **Property 27: Deposit Amount Validation** — generate random price/deposit pairs, verify ≥50% rule
    - **Property 28: Cancellation Refund Flag** — generate random cancellation scenarios, verify refund_flagged logic based on source state
    - **Validates: Requirements 13.1, 13.2, 13.4, 13.6, 13.8**

  - [x] 4.7 Build order inquiry form page
    - Create `src/app/order/page.tsx` with form fields: date, servings (10–500), flavor (from Catalog_Service), design description (max 1000 chars), budget range, name, email, phone
    - Display lead time info (1-2 weeks) and deposit requirement (50%)
    - Client-side validation with adjacent error messages for each field
    - Implement minimum lead time (7 days) date validation
    - _Requirements: 2.1, 2.3, 2.4, 2.6_

  - [x] 4.8 Implement server-side form validation and Order_Intent creation
    - Create API route `src/app/api/orders/route.ts` with server-side validation (field lengths, formats, date check)
    - Create Order_Intent record on valid submission
    - Send confirmation email within 60 seconds
    - Return validation errors without internal system details on failure
    - Implement CSRF protection on form submission
    - _Requirements: 2.2, 2.3, 11.1, 11.2, 11.7_

  - [x]* 4.9 Write property tests for form validation (Properties 5, 6)
    - **Property 5: Missing field error mapping** — generate random subsets of missing required fields, verify error messages match exactly the missing set
    - **Property 6: Minimum lead time enforcement** — generate random dates, verify rejection <7 days and acceptance ≥7 days
    - **Validates: Requirements 2.3, 2.4**

- [x] 5. Checkpoint - Verify order service and form
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Customer Service and privacy compliance
  - [x] 6.1 Implement Customer Service
    - Create `src/services/customer.service.ts` implementing get, create, update, deleteCustomerPII
    - Enforce data minimization: store only name, email, phone, delivery address, order details
    - Implement PII deletion: remove name, email, phone, delivery address while retaining anonymized order records
    - _Requirements: 15.2, 15.4_

  - [x] 6.2 Implement MCP Customers Server
    - Create `src/mcp/customers-server.ts` exposing tools: get_customer, create_customer, update_customer, delete_customer_pii
    - Wire to Customer Service
    - _Requirements: 15.4_

  - [x] 6.3 Implement consent management
    - Create consent record on opt-in (unchecked-by-default checkbox); record timestamp and channel
    - Handle consent withdrawal: stop marketing comms within 24 hours, update consent record
    - _Requirements: 15.3, 15.6, 11.6_

  - [x] 6.4 Build privacy policy and policies pages
    - Create `src/app/policies/page.tsx` with deposit requirements, lead time, cancellation policy, delivery zones/fees, free pickup, allergen info, free wedding consultation
    - Create `src/app/privacy/page.tsx` with data collection, usage, storage, deletion request info
    - Load within 3 seconds on 4G
    - _Requirements: 3.1, 3.3, 3.4, 15.1_

  - [x]* 6.5 Write property tests for customer data (Properties 31, 32, 33, 34)
    - **Property 31: Customer Data Minimization** — generate random customer input, verify only allowed fields are persisted
    - **Property 32: PII Deletion with Order Preservation** — verify PII removal while orders remain with anonymized references
    - **Property 33: Marketing Consent Withdrawal** — verify no marketing sent after withdrawal
    - **Property 34: Notification Queue Ordering** — verify FIFO delivery of queued notifications (up to 1000)
    - **Validates: Requirements 15.2, 15.4, 15.6, 12.3**

- [x] 7. Notification Service and Telegram Bot
  - [x] 7.1 Implement Notification Service with Redis queue
    - Create `src/services/notification.service.ts` implementing notifyOwner, notifyCustomer, queueNotification, processQueue, sendDailySummary
    - Queue notifications in Redis (max 1000); use email fallback on overflow or 24h Telegram outage
    - Deliver in FIFO order on reconnection
    - _Requirements: 12.3, 12.4_

  - [x] 7.2 Implement MCP Notifications Server
    - Create `src/mcp/notifications-server.ts` exposing tools: send_owner_notification, send_customer_message, create_escalation
    - Wire to Notification Service
    - _Requirements: 8.1, 8.2_

  - [x] 7.3 Implement Telegram Bot integration
    - Create `src/integrations/telegram.bot.ts` implementing sendNotification, handleCommand, handleCallbackQuery, sendDailySummary
    - Implement inline action buttons for order notifications (approve, reject, reply)
    - Handle /content command → return 3 AI-generated content suggestions within 15 seconds
    - Handle /analytics command → return weekly metrics within 10 seconds
    - _Requirements: 8.1, 8.4, 8.6, 14.4_

  - [x] 7.4 Implement daily summary and unresponded alerts
    - Daily summary at 20:00 local: total inquiries, orders, estimated revenue, top 3 cake types
    - Alert after 30 minutes of unresponded customer message
    - _Requirements: 8.3, 8.5_

  - [x] 7.5 Implement Telegram webhook handler
    - Create `src/app/api/webhooks/telegram/route.ts` for callback queries and commands
    - Handle approve/reject/reply inline button callbacks → update order state via Order Service
    - _Requirements: 8.4_

  - [x]* 7.6 Write property tests for notification queue (Property 34)
    - **Property 34: Notification Queue Ordering** — generate random notification sequences, verify queue accepts max 1000, delivers FIFO, handles overflow via email
    - **Validates: Requirements 12.3, 12.4**

- [x] 8. Checkpoint - Verify notifications and Telegram
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. AI Assistant and Message Router
  - [x] 9.1 Implement Message Router
    - Create `src/services/message-router.ts` implementing handleInbound and deliverResponse
    - Normalize messages from WhatsApp, Instagram, Chat Widget into unified InboundMessage format
    - Route to AI Assistant, deliver responses back to originating channel
    - _Requirements: 7.1, 9.1, 6.2_

  - [x] 9.2 Implement AI Assistant with Claude API and MCP tool access
    - Create `src/services/ai-assistant.ts` implementing processMessage
    - Configure system prompt with La La Sweett brand voice (warm, creative, personal, enthusiastic)
    - Connect all 6 MCP servers as tools for Claude API
    - Implement 5-second response time target
    - Maintain session context for 30 minutes of inactivity
    - _Requirements: 6.2, 6.3, 6.8_

  - [x] 9.3 Implement escalation detection logic
    - Detect escalation triggers: multi-tier >5, sculpted 3D, designs not in catalog, pricing beyond ranges, explicit human request
    - Create Escalation record with summary (max 500 chars), reason, originating channel
    - Notify owner via Telegram within 30 seconds
    - After one clarification attempt fails, offer owner connection
    - _Requirements: 6.5, 6.9, 7.6_

  - [x] 9.4 Implement order intent capture from conversation
    - Detect when customer provides ≥2 of: event date, servings, flavor, design description, budget range
    - Capture structured Order_Intent, confirm details back to customer, prompt for missing fields
    - Guide WhatsApp/Instagram customers through structured intake flow
    - _Requirements: 6.6, 7.4, 7.5_

  - [x] 9.5 Implement servings calculator
    - Accept guest count (1–500), return recommended servings ≥ guest count
    - Return valid tier configuration from Catalog_Service portion data
    - Ensure monotonically non-decreasing results as guest count increases
    - _Requirements: 6.7_

  - [x] 9.6 Implement conversation logging and intent tagging
    - Log every message (customer + assistant) with timestamp, channel, customer ID
    - Tag conversations with intent categories: pricing_inquiry, availability_check, custom_design_request, order_status, general_question
    - Retain data for 12 months minimum
    - Retry logging up to 3 times; queue on failure; notify owner
    - _Requirements: 14.1, 14.3, 14.5_

  - [x]* 9.7 Write property tests for AI/conversation logic (Properties 12, 13, 14, 15, 29, 30)
    - **Property 12: AI Response Grounding** — verify factual claims trace to Catalog_Service data
    - **Property 13: Escalation Trigger** — generate random design descriptions, verify correct escalation classification
    - **Property 14: Order Intent Capture** — generate random sets of 0-5 order fields, verify ≥2 triggers capture
    - **Property 15: Servings Calculator** — generate random guest counts 1-500, verify result ≥ count + valid tier config
    - **Property 29: Conversation Logging** — verify every processed message has log with timestamp, channel, customer ID
    - **Property 30: Intent Tagging** — verify every conversation gets ≥1 valid intent tag
    - **Validates: Requirements 6.3, 6.5, 6.6, 6.7, 14.1, 14.3**

- [x] 10. WhatsApp Integration
  - [x] 10.1 Implement WhatsApp webhook handler and message delivery
    - Create `src/integrations/whatsapp.ts` implementing handleWebhook, sendMessage, sendTemplate
    - Create `src/app/api/webhooks/whatsapp/route.ts` for webhook verification and message handling
    - Deliver inbound messages to Message Router within 3 seconds
    - _Requirements: 7.1, 7.2_

  - [x] 10.2 Implement WhatsApp rate limiting
    - Rate limit: 20 messages per minute per phone number (sliding window via Redis)
    - Reject excess messages with single rate-limit notification
    - _Requirements: 11.3_

  - [x] 10.3 Implement WhatsApp graceful degradation
    - On AI timeout (>10s): send predefined acknowledgment message
    - Retry failed API calls 3x with exponential backoff (1s, 2s, 4s)
    - Alert owner if all retries fail
    - Implement 24-hour follow-up for abandoned intake flows
    - _Requirements: 12.2, 12.6, 7.7_

  - [x]* 10.4 Write property tests for rate limiting (Properties 22, 23)
    - **Property 22: WhatsApp Rate Limiting** — generate random message timestamp sequences, verify 20/min limit per phone
    - **Property 23: Chat Widget Rate Limiting** — generate random session message sequences, verify 10/min limit per session
    - **Validates: Requirements 11.3, 11.4**

- [x] 11. Chat Widget
  - [x] 11.1 Build Chat Widget component
    - Create `src/components/ChatWidget.tsx` as floating bottom-right interface on every page
    - Implement SSE/WebSocket connection for real-time messaging
    - Connect to Message Router with channel='chat_widget'
    - Rate limit: 10 messages per minute per session; disable input for 60s on limit with countdown
    - _Requirements: 6.1, 11.4_

  - [x] 11.2 Implement Chat Widget graceful degradation
    - On AI timeout (>10s): display "assistant temporarily unavailable" message and present order inquiry form
    - Maintain session context across page navigations
    - _Requirements: 12.1, 6.8_

- [x] 12. Checkpoint - Verify messaging channels
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Instagram Integration
  - [x] 13.1 Implement Instagram DM webhook handler
    - Create `src/integrations/instagram.ts` implementing handleDMWebhook, sendDM
    - Create `src/app/api/webhooks/instagram/route.ts` for webhook handling
    - Route DMs containing cake-related keywords to AI_Assistant within 3 seconds
    - Route non-keyword DMs to AI_Assistant for greeting response
    - _Requirements: 9.1, 9.6_

  - [x] 13.2 Implement Instagram comment auto-reply
    - Implement handleCommentWebhook and replyToComment
    - Detect purchase-intent keywords (order, price, how much, available, book) as case-insensitive whole words
    - Auto-reply within 60 seconds directing to DM or WhatsApp
    - _Requirements: 9.2_

  - [x] 13.3 Implement Instagram graceful degradation
    - On AI timeout (>10s): send predefined acknowledgment message
    - Retry 3x with exponential backoff; skip and log if exhausted
    - _Requirements: 12.7, 12.6_

  - [x] 13.4 Implement weekly content plan generation
    - Generate weekly content plan every Monday: ≥3 post topics, ≥3 story ideas, ≥3 caption drafts
    - Target Austin-area cake buyers in La La Sweett brand voice
    - Deliver via Telegram Bot; also available via /content command
    - _Requirements: 9.4, 9.5_

  - [x]* 13.5 Write property tests for Instagram keyword detection (Properties 16, 17)
    - **Property 16: Instagram DM Keyword Routing** — generate random DM texts with/without keywords, verify correct routing
    - **Property 17: Instagram Comment Purchase-Intent Detection** — generate random comments, verify whole-word case-insensitive matching
    - **Validates: Requirements 9.1, 9.2**

- [x] 14. Marketing Service and analytics
  - [x] 14.1 Implement Marketing Service core
    - Create `src/services/marketing.service.ts` implementing generateBudgetAllocation, trackConversion, getROIMetrics, generateSeasonalRecommendations, getWeeklyAnalytics, generateContentSuggestions, sendReviewSolicitation
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 14.2 Implement budget allocation logic
    - Generate monthly allocation across 5 channels (Meta Ads, Google local search, boosted Instagram posts, organic content, review generation)
    - Enforce sum = exactly $100.00, all channels non-negative
    - _Requirements: 10.1_

  - [x] 14.3 Implement conversion attribution with 30-day window
    - Track first customer interaction and marketing channel
    - Attribute conversions only within 30-day window
    - _Requirements: 10.2_

  - [x] 14.4 Implement ROI metrics and insufficient data flagging
    - Calculate cost-per-inquiry (S/I) and cost-per-order (S/O) per channel
    - Return undefined/null when I=0 or O=0
    - Flag channel as "insufficient data" when <5 attributed inquiries
    - _Requirements: 10.4, 10.6_

  - [x] 14.5 Implement seasonal recommendations
    - Generate promotion recommendations ≥4 weeks before Austin events (wedding season, graduation, holidays)
    - Based on historical order patterns from corresponding prior months
    - _Requirements: 10.3_

  - [x] 14.6 Implement review solicitation
    - On order transition to Delivered/Picked_Up: generate one review solicitation within 48 hours
    - Enforce idempotency: at most one solicitation per order
    - _Requirements: 10.5_

  - [x] 14.7 Implement MCP Marketing Server
    - Create `src/mcp/marketing-server.ts` exposing tools: get_channel_metrics, get_budget_allocation, generate_content_suggestions
    - Wire to Marketing Service
    - _Requirements: 10.1, 10.4_

  - [x] 14.8 Implement weekly analytics delivery
    - Every Monday at configured time via Telegram: total conversations by channel, top 5 topics, conversion rate, average response time
    - Also available on-demand via /analytics Telegram command
    - _Requirements: 14.2, 14.4_

  - [x]* 14.9 Write property tests for marketing (Properties 18, 19, 20, 21, 22, 24)
    - **Property 18: Budget Allocation Invariant** — generate random channel configs, verify sum = $100.00, all non-negative, all channels represented
    - **Property 19: Conversion Attribution Window** — generate random interaction dates, verify 30-day window enforcement
    - **Property 20: ROI Insufficient Data Flag** — generate random inquiry counts, verify flag when <5
    - **Property 21: Review Solicitation Uniqueness** — verify at most one solicitation per order, second attempt rejected
    - **Property 22: WhatsApp Rate Limiting** — (covered in 10.4, cross-validation here)
    - **Property 24: Marketing Consent Gate** — generate random consent states, verify send only with active consent
    - **Validates: Requirements 10.1, 10.2, 10.5, 10.6, 11.6, 15.6**

- [x] 15. Checkpoint - Verify marketing and Instagram
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. SEO, responsive design, and accessibility
  - [x] 16.1 Implement sitemap.xml and robots.txt generation
    - Create dynamic sitemap listing all public pages; regenerate on catalog changes
    - Create robots.txt permitting search engine crawling
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 16.2 Implement semantic HTML and meta tags
    - One H1 per page, sequential heading levels, landmark regions (header, nav, main, footer)
    - Alt text for all non-decorative images
    - Meta title ≤60 chars with primary keyword, meta description ≤160 chars with primary keyword
    - Homepage keyword: "custom cakes Austin TX"; category pages: category-specific terms
    - _Requirements: 5.4, 5.5_

  - [x] 16.3 Implement mobile-first responsive layout
    - Dark background with gold/cream accents (brand design tokens)
    - No horizontal scroll, overlap, or truncation from 320px to 2560px
    - Responsive images with srcset/picture elements
    - ≤768px: collapsed nav via toggle, form inputs min 44px height
    - Touch targets ≥44x44px, WCAG 2.1 AA compliance
    - _Requirements: 4.1, 4.4, 4.5, 4.6, 4.7_

  - [x] 16.4 Implement homepage with hero, featured cakes, and CTA
    - Create `src/app/page.tsx` with hero section, featured cakes from catalog, order CTA
    - Optimize for LCP <2s on 4G mobile, INP <200ms, CLS <0.1
    - _Requirements: 4.2, 4.3_

  - [x]* 16.5 Write property tests for SEO (Properties 8, 9, 10)
    - **Property 8: Sitemap Synchronization** — for random sets of active/inactive pages, verify sitemap contains exactly active pages
    - **Property 9: Semantic HTML Structure** — verify one H1, sequential headings, non-empty alt text
    - **Property 10: Meta Tag Constraints** — verify title ≤60 chars, description ≤160 chars, both contain primary keyword
    - **Validates: Requirements 5.1, 5.4, 5.5**

- [x] 17. Reliability, retry logic, and circuit breaker
  - [x] 17.1 Implement retry with exponential backoff
    - Create `src/lib/retry.ts` utility: 3 retries, delays 1s, 2s, 4s
    - Apply to all external API calls (WhatsApp, Instagram, Telegram, Claude)
    - Generate alert if all retries fail
    - _Requirements: 12.6_

  - [x] 17.2 Implement circuit breaker pattern
    - Create `src/lib/circuit-breaker.ts`: closed→open after 5 consecutive failures in 1 min; 30s open; half-open probe
    - Apply to WhatsApp, Instagram, Telegram, Claude APIs
    - _Requirements: 12.6_

  - [x] 17.3 Implement MCP Calendar Server
    - Create `src/mcp/calendar-server.ts` exposing tools: check_availability, get_lead_time, get_booked_dates
    - Wire to order and catalog data for availability checking
    - _Requirements: 2.4, 6.3_

  - [x]* 17.4 Write property tests for infrastructure (Properties 26, 27)
    - **Property 26: Notification Queue Bounds** — generate notification sequences during outage, verify max 1000 accepted, email fallback beyond limit, FIFO on reconnect
    - **Property 27: Retry with Exponential Backoff** — generate random failure sequences, verify exactly 3 retries at 1s, 2s, 4s intervals, alert on exhaustion
    - **Validates: Requirements 12.3, 12.6**

- [x] 18. Integration wiring and end-to-end flows
  - [x] 18.1 Wire all MCP servers to AI Assistant
    - Connect Catalog, Orders, Customers, Calendar, Notifications, Marketing servers
    - Verify AI Assistant can call all tools and receive responses
    - Ensure data-only responses (no fabrication beyond MCP tool results)
    - _Requirements: 6.3, 6.4_

  - [x] 18.2 Wire order creation flow end-to-end
    - Form submission → Order_Intent creation → Telegram notification (within 30s)
    - WhatsApp intake → Order_Intent creation → Telegram notification
    - Instagram DM intake → Order_Intent creation → Telegram notification
    - Chat Widget intake → Order_Intent creation → Telegram notification
    - _Requirements: 2.2, 2.5, 7.5, 8.1, 9.3_

  - [x] 18.3 Wire Telegram inline button callbacks to Order Service
    - Approve → transition order to Confirmed
    - Reject → transition to Cancelled
    - Reply → deliver owner's response to customer's originating channel
    - _Requirements: 8.4_

  - [x] 18.4 Wire graceful degradation fallback chain
    - AI timeout → predefined message per channel
    - Channel API failure → queue for owner via Telegram
    - Telegram down → Redis queue (max 1000, 24h)
    - Queue full/24h elapsed → email summary to owner
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.7_

  - [x]* 18.5 Write integration tests for end-to-end flows
    - Test order lifecycle: form → Order_Intent → quote → deposit → confirm → production → ready → deliver
    - Test multi-channel: start on web chat → continue on WhatsApp
    - Test escalation flow: complex request → Escalation → Telegram notification
    - Test data deletion: request → acknowledgment → PII removal
    - _Requirements: 2.2, 7.5, 8.1, 13.1, 15.4_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases using Vitest
- The implementation follows the phased approach: Core (tasks 1-8), Intelligence (tasks 9-13), Growth (tasks 14-18)
- All external API calls use retry with exponential backoff and circuit breaker pattern
- TypeScript strict mode enforced throughout the project
- All MCP servers follow the same interface pattern for consistency

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "1.5"] },
    { "id": 3, "tasks": ["2.1", "6.1", "17.1", "17.2"] },
    { "id": 4, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "6.2", "6.3", "6.4", "17.3"] },
    { "id": 5, "tasks": ["2.7", "4.1", "6.5"] },
    { "id": 6, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.7"] },
    { "id": 7, "tasks": ["4.6", "4.8", "4.9"] },
    { "id": 8, "tasks": ["7.1", "9.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "9.2"] },
    { "id": 10, "tasks": ["7.4", "7.5", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 11, "tasks": ["7.6", "9.7", "10.1", "11.1"] },
    { "id": 12, "tasks": ["10.2", "10.3", "10.4", "11.2", "13.1"] },
    { "id": 13, "tasks": ["13.2", "13.3", "13.4", "13.5"] },
    { "id": 14, "tasks": ["14.1"] },
    { "id": 15, "tasks": ["14.2", "14.3", "14.4", "14.5", "14.6", "14.7"] },
    { "id": 16, "tasks": ["14.8", "14.9"] },
    { "id": 17, "tasks": ["16.1", "16.2", "16.3", "16.4"] },
    { "id": 18, "tasks": ["16.5", "17.4"] },
    { "id": 19, "tasks": ["18.1"] },
    { "id": 20, "tasks": ["18.2", "18.3", "18.4"] },
    { "id": 21, "tasks": ["18.5"] }
  ]
}
```
