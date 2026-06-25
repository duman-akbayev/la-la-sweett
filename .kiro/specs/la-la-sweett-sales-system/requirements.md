# Requirements Document

## Introduction

La La Sweett is a custom cakes bakery based in Austin, TX that currently operates through Instagram and social media with manual order management. This system provides an AI-assisted sales and operations platform that automates customer interactions, streamlines order management from inquiry to delivery/pickup, and gives the owner visibility into marketing effectiveness. The system spans a public-facing website/storefront, AI-powered messaging across WhatsApp and on-site chat, owner notifications via Telegram, Instagram integration for content and DM handling, and a marketing optimization layer—all designed to reduce manual workload while maintaining La La Sweett's warm, creative brand voice.

## Glossary

- **Website**: The Next.js 14+ App Router web application hosted at lalasweett.com (localhost for development) serving as the public storefront and catalog
- **AI_Assistant**: The Claude API-powered conversational agent that handles customer inquiries across chat widget, WhatsApp, and Instagram DMs in La La Sweett's brand voice
- **Catalog_Service**: The backend service managing product data including cake categories, pricing, flavors, availability, and design options
- **Order_Service**: The backend service managing order lifecycle from inquiry through deposit, confirmation, production, and delivery/pickup
- **Chat_Widget**: The on-site conversational interface embedded in the Website for real-time customer assistance
- **WhatsApp_Integration**: The WhatsApp Business API connector handling inbound/outbound customer messaging
- **Telegram_Bot**: The Telegram bot providing real-time notifications, daily summaries, and quick actions for the bakery owner
- **Instagram_Integration**: The Meta Business API connector for DM handling, comment replies, and content planning
- **Marketing_System**: The subsystem managing $100/month budget allocation, ROI tracking, and campaign recommendations across advertising channels
- **Owner**: The La La Sweett bakery owner who manages operations, approves complex orders, and creates cake designs
- **Customer**: A person interested in purchasing custom cakes or baked goods from La La Sweett
- **Order_Intent**: A structured record of a customer's desired order details (date, servings, flavor, design, budget) captured during conversation
- **Escalation**: The process of routing a conversation or order to the Owner when the AI_Assistant cannot handle complexity or the customer requests human interaction
- **MCP_Layer**: The Model Context Protocol service layer providing structured tool access for catalog, orders, customers, calendar, notifications, and marketing data
- **Handoff**: The transition of a conversation from AI_Assistant to Owner with full context summary

## Requirements

### Requirement 1: Product Catalog Display

**User Story:** As a Customer, I want to browse La La Sweett's cake portfolio organized by category, so that I can explore design options and understand pricing ranges before inquiring.

#### Acceptance Criteria

1. THE Website SHALL display cake products organized into the following categories: Birthday Cakes, Wedding Cakes, Baby Shower Cakes, Graduation Cakes, Holiday/Seasonal Cakes, Character/Themed Cakes, Cupcakes, Cake Pops, Cookies, and Mini Dessert Tables/Packages
2. WHEN a Customer selects a cake category, THE Website SHALL display a photo gallery of past work within that category showing up to 12 items per page with pagination controls when more items exist, and each item SHALL display its starting price in the format "$X – $Y"
3. THE Website SHALL render each product listing with a product name, category, photo, starting price, and a description of no more than 150 characters
4. IF a selected category contains no products, THEN THE Website SHALL display a message indicating no items are currently available in that category
5. THE Catalog_Service SHALL expose product data at the /api/catalog.json endpoint in JSON format
6. THE Website SHALL include JSON-LD structured data following schema.org/Product markup for each catalog item

### Requirement 2: Order Inquiry Submission

**User Story:** As a Customer, I want to submit an order inquiry with my event details, so that I can get a quote for a custom cake.

#### Acceptance Criteria

1. THE Website SHALL provide an order inquiry form capturing: date needed, number of servings (minimum 10, maximum 500), flavor preferences (selected from available Catalog_Service flavors), design description (free-text, maximum 1000 characters), budget range (selected from predefined ranges), and customer contact information (full name, email address, and phone number)
2. WHEN a Customer submits a valid order inquiry form, THE Order_Service SHALL create an Order_Intent record and send a confirmation email to the Customer's provided email address within 60 seconds containing the submitted inquiry details and expected response timeframe
3. WHEN a Customer submits an order inquiry form with missing required fields, THE Website SHALL display validation error messages adjacent to each incomplete field indicating what information is required
4. IF a Customer submits an order inquiry form with a date needed that is less than 7 days from the current date, THEN THE Website SHALL display a validation message indicating the minimum lead time requirement and prevent submission
5. WHEN a new Order_Intent is created, THE Telegram_Bot SHALL send a notification to the Owner within 30 seconds containing: customer name, event date, cake type, number of servings, and budget range
6. THE Website SHALL display current lead time (minimum 1-2 weeks) and deposit requirement (50%) on the order inquiry form

### Requirement 3: Business Policies Display

**User Story:** As a Customer, I want to clearly understand La La Sweett's policies before ordering, so that I can plan my event accordingly.

#### Acceptance Criteria

1. THE Website SHALL display a policies page accessible from the main navigation containing: deposit requirements (50% to book), minimum lead time (1-2 weeks for custom orders), cancellation policy (specifying refund eligibility window relative to event date and any non-refundable deposit terms), delivery zones within Austin metro with per-zone fee amounts, free pickup option with pickup location, and allergen accommodation information listing which allergens can be accommodated
2. WHEN a product listing in the Catalog_Service includes allergen accommodation tags, THE Website SHALL display the applicable allergen options (nut-free, gluten-free) on that product listing
3. THE Website SHALL display on the Wedding Cakes category page that the initial wedding cake consultation is free
4. WHEN a Customer navigates to the policies page, THE Website SHALL load and render all policy content within 3 seconds on a 4G connection

### Requirement 4: Mobile-First Responsive Design

**User Story:** As a Customer, I want to access La La Sweett's website from my phone, so that I can browse and inquire while on the go.

#### Acceptance Criteria

1. THE Website SHALL render all page content without horizontal scrolling, without overlapping elements, and without truncated text on viewport widths from 320px to 2560px using a mobile-first responsive layout
2. THE Website SHALL achieve a Largest Contentful Paint (LCP) of less than 2 seconds on a simulated 4G mobile connection (9 Mbps download, 1.5 Mbps upload, 170ms RTT as defined by Lighthouse mobile throttling profile)
3. THE Website SHALL achieve Core Web Vitals scores meeting: LCP under 2.5 seconds, Interaction to Next Paint (INP) under 200 milliseconds, and Cumulative Layout Shift (CLS) under 0.1
4. THE Website SHALL comply with WCAG 2.1 Level AA accessibility standards across all public pages, including minimum touch target size of 44x44 CSS pixels for all interactive elements
5. THE Website SHALL use a dark background color palette with gold and cream accent colors consistent with La La Sweett brand identity, where the specific color values are defined in the project design tokens
6. THE Website SHALL serve responsive images using appropriate srcset or picture elements, delivering images no wider than the viewport requires at each breakpoint
7. WHILE the viewport width is 768px or narrower, THE Website SHALL display a collapsed navigation menu accessible via a single toggle button, and all form inputs SHALL have a minimum height of 44px

### Requirement 5: SEO and Machine-Readable Structure

**User Story:** As the Owner, I want the website to rank well in local Austin searches for custom cakes, so that new customers can find La La Sweett organically.

#### Acceptance Criteria

1. THE Website SHALL generate a sitemap.xml file listing all public pages
2. WHEN catalog content is added, removed, or modified, THE Website SHALL regenerate the sitemap.xml to reflect the current set of public pages
3. THE Website SHALL include a robots.txt file permitting search engine crawling of public pages
4. THE Website SHALL render semantic HTML with one H1 heading per page, sequentially descending heading levels without skipping levels, landmark regions (header, nav, main, footer), and alt text for all non-decorative images
5. THE Website SHALL include a meta title of 60 characters or fewer containing the primary keyword for that page and a meta description of 160 characters or fewer containing the primary keyword, where primary keywords include "custom cakes Austin TX" for the homepage and category-specific terms for category pages
6. THE Catalog_Service SHALL serve product data in structured JSON with numeric price fields, unit indicators, and constraint fields (minimum servings, lead time in days, available flavors as enumerated values) parseable without natural language processing
7. THE Website SHALL include JSON-LD structured data following schema.org/LocalBusiness markup on every page, containing business name, Austin TX address, phone number, and operating hours

### Requirement 6: On-Site AI Chat Assistant

**User Story:** As a Customer, I want to chat with an AI assistant on the website that knows about La La Sweett's offerings, so that I can get immediate answers without waiting for the owner to reply.

#### Acceptance Criteria

1. THE Chat_Widget SHALL be accessible on every page of the Website as a floating interface element positioned in the bottom-right corner of the viewport
2. WHEN a Customer sends a message through the Chat_Widget, THE AI_Assistant SHALL respond within 5 seconds using La La Sweett's brand voice (warm, creative, personal, enthusiastic about cake art)
3. THE AI_Assistant SHALL answer questions about cake flavors, pricing ranges, available dates, design options, delivery/pickup zones, and deposit policies using only data from the Catalog_Service and the business policies defined in Requirement 3
4. THE AI_Assistant SHALL never fabricate product information, prices, or availability not present in the Catalog_Service data
5. WHEN a Customer asks about a design requiring multi-tier structures above 5 tiers, sculpted 3D elements, designs not represented in the Catalog_Service categories, or requests that require custom quoting beyond listed price ranges, THE AI_Assistant SHALL inform the Customer that the Owner will follow up, create an Escalation record, and notify the Owner via the Telegram_Bot within 30 seconds
6. WHEN a Customer provides at least two of the following details—event date, number of servings, flavor preference, design description, or budget range—THE AI_Assistant SHALL capture the Order_Intent details in a structured format, confirm the captured details back to the Customer, and prompt for any missing fields
7. THE AI_Assistant SHALL provide a servings calculator that accepts a guest count between 1 and 500 and returns a recommended cake size (number of servings) and corresponding tier configuration based on Catalog_Service portion data
8. WHILE a Customer is in an active chat session, THE AI_Assistant SHALL maintain conversation context across messages within that session for up to 30 minutes of inactivity
9. IF the AI_Assistant cannot interpret a Customer's message after one clarification attempt, THEN THE AI_Assistant SHALL offer to connect the Customer with the Owner and create an Escalation record

### Requirement 7: WhatsApp Customer Messaging

**User Story:** As a Customer, I want to message La La Sweett on WhatsApp and get quick, helpful responses, so that I can inquire about cakes through my preferred messaging app.

#### Acceptance Criteria

1. WHEN a Customer sends a message via WhatsApp, THE WhatsApp_Integration SHALL deliver the message to the AI_Assistant for processing within 3 seconds
2. WHEN a Customer sends a message via WhatsApp, THE AI_Assistant SHALL respond within 5 seconds using La La Sweett's brand voice and the same knowledge base and capabilities defined for Chat_Widget interactions (catalog queries, order intake, escalation)
3. WHEN a Customer inquires about pricing, flavors, or availability via WhatsApp, THE AI_Assistant SHALL retrieve current data from the Catalog_Service and respond with information matching the current Catalog_Service records without fabricating products, prices, or availability not present in the data
4. WHEN a Customer expresses intent to order a cake via WhatsApp (e.g., requests a quote, asks to book, or describes a desired cake for an event), THE AI_Assistant SHALL guide the Customer through a structured intake flow collecting: event date, number of servings, flavor preferences, design description (maximum 500 characters), and budget range
5. WHEN the AI_Assistant has collected all required intake fields (event date, servings, flavor, design description, and budget range) from a WhatsApp conversation, THE Order_Service SHALL create an Order_Intent record and THE Telegram_Bot SHALL notify the Owner within 30 seconds containing the inquiry summary
6. WHEN a Customer requests to speak with the Owner or the AI_Assistant encounters a topic that exceeds its configured scope (complex custom designs, pricing exceptions, or complaints), THE WhatsApp_Integration SHALL create a Handoff record and notify the Owner via Telegram_Bot within 30 seconds with the full conversation context
7. IF a Customer does not respond during an active order intake flow for more than 24 hours, THEN THE AI_Assistant SHALL send a single follow-up message asking if the Customer would like to continue, and preserve the partially collected intake data for 7 days

### Requirement 8: Telegram Owner Notifications

**User Story:** As the Owner, I want real-time Telegram notifications about new orders, inquiries, and escalations, so that I can respond promptly to business-critical events without constantly checking multiple platforms.

#### Acceptance Criteria

1. WHEN a new Order_Intent is created from any channel (Website, WhatsApp, Instagram, Chat_Widget), THE Telegram_Bot SHALL send a notification to the Owner within 30 seconds containing: customer name, event date, cake type, servings, and budget range
2. WHEN an Escalation is triggered by the AI_Assistant, THE Telegram_Bot SHALL send a notification to the Owner within 30 seconds containing: a conversation summary of no more than 500 characters, the reason for escalation, and the originating channel
3. WHEN the configured daily summary time is reached (default: 20:00 Owner's local time), THE Telegram_Bot SHALL send a summary message containing: total inquiries, orders received, estimated revenue, and the top 3 most-inquired cake types for that day
4. WHEN a notification for a new Order_Intent is sent, THE Telegram_Bot SHALL include inline action buttons allowing the Owner to: approve the order (transitioning it to Confirmed state in the Order_Service), reject the order (transitioning it to Cancelled state in the Order_Service), or reply to the customer (delivering the Owner's response to the channel the customer originally used)
5. WHEN a customer message has received no response from the AI_Assistant or the Owner for more than 30 minutes, THE Telegram_Bot SHALL send an alert to the Owner containing the customer name, originating channel, and time elapsed since the message was received
6. WHEN the Owner sends the /content command to the Telegram_Bot, THE Telegram_Bot SHALL return 3 AI-generated content plan suggestions for social media posts within 15 seconds, each containing a topic, suggested format (post, story, or reel), and a caption draft in La La Sweett's brand voice

### Requirement 9: Instagram DM and Engagement Handling

**User Story:** As the Owner, I want Instagram DMs and comments to be handled automatically where possible, so that interested followers are quickly routed into the order path without manual effort.

#### Acceptance Criteria

1. WHEN a Customer sends an Instagram DM containing cake-related keywords (cake, order, price, custom, birthday, wedding, cupcake, dessert, book, quote), THE Instagram_Integration SHALL route the message to the AI_Assistant for processing within 3 seconds, using the same knowledge and conversational capabilities as WhatsApp and Chat_Widget interactions
2. WHEN a Customer comments on an Instagram post and the comment contains one or more purchase-intent keywords (order, price, how much, available, book) matched case-insensitively as whole words, THE Instagram_Integration SHALL auto-reply within 60 seconds directing the Customer to send a DM or message via WhatsApp for order details
3. WHEN the AI_Assistant captures an Order_Intent from an Instagram DM, THE Order_Service SHALL create the Order_Intent record and THE Telegram_Bot SHALL notify the Owner within 30 seconds containing customer name, event date, cake type, servings, and budget range
4. THE Instagram_Integration SHALL generate a weekly content plan every Monday at a configured time containing: at least 3 suggested post topics, at least 3 story ideas, and at least 3 caption drafts in La La Sweett's brand voice targeting Austin-area cake buyers, and deliver it to the Owner via the Telegram_Bot
5. WHEN the Owner issues the /content command via the Telegram_Bot, THE Instagram_Integration SHALL respond within 30 seconds with post and story captions written in La La Sweett's brand voice
6. IF a Customer sends an Instagram DM that does not match any cake-related keywords, THEN THE Instagram_Integration SHALL route the message to the AI_Assistant, and THE AI_Assistant SHALL respond with a greeting and offer to help with cake inquiries or direct the Customer to the Owner for other matters

### Requirement 10: Marketing Budget Optimization

**User Story:** As the Owner, I want recommendations for spending the $100/month marketing budget effectively, so that I can get more orders without wasting money.

#### Acceptance Criteria

1. THE Marketing_System SHALL generate monthly budget allocation recommendations by the 1st of each month across channels: Meta Ads, Google local search, boosted Instagram posts, organic content, and review generation, with a specific dollar amount allocated to each channel summing to $100
2. THE Marketing_System SHALL track conversion attribution per marketing channel by associating incoming Customers with their referral source within a 30-day attribution window from the Customer's first interaction
3. THE Marketing_System SHALL generate seasonal promotion recommendations at least 4 weeks before Austin-area events (wedding season, graduation, holidays) based on historical order patterns from the corresponding period in prior months
4. THE Marketing_System SHALL provide ROI metrics per channel showing cost-per-inquiry and cost-per-order on a monthly basis, calculated from Owner-entered actual spend amounts and tracked conversions per channel
5. WHEN an order transitions to the Delivered/Picked_Up state, THE Marketing_System SHALL generate a review/testimonial solicitation message and send it to the Customer within 48 hours, limited to one solicitation per order
6. IF a marketing channel has fewer than 5 attributed inquiries in a given month, THEN THE Marketing_System SHALL flag the channel's ROI metrics as having insufficient data in that month's report

### Requirement 11: Security and Input Validation

**User Story:** As the Owner, I want the system to be secure against abuse, so that customer data is protected and the system remains available.

#### Acceptance Criteria

1. THE Website SHALL validate all form inputs on both client and server side, enforcing maximum field lengths (name: 100 characters, email: 254 characters, phone: 20 characters, text fields: 2000 characters) and rejecting inputs that do not match expected format patterns (valid email format, digits-only phone, no script tags in text) before processing
2. THE Website SHALL implement CSRF protection on all state-changing form submissions
3. IF a phone number exceeds 20 messages within a 1-minute sliding window, THEN THE WhatsApp_Integration SHALL reject additional messages and send a single notification to the Customer indicating the rate limit has been reached with a retry time
4. IF a session exceeds 10 messages within a 1-minute sliding window, THEN THE Chat_Widget SHALL disable the message input, display a notice indicating the rate limit has been reached, and re-enable input after 60 seconds
5. THE Order_Service SHALL store customer personally identifiable information encrypted at rest and transmit data only over TLS 1.2 or higher
6. THE Website SHALL require explicit opt-in consent from Customers via an unchecked checkbox or equivalent affirmative action before sending marketing messages via WhatsApp or email
7. IF server-side validation fails for any form submission, THEN THE Website SHALL return a response indicating which fields failed validation and the reason, without exposing internal system details, and SHALL NOT persist the invalid data

### Requirement 12: System Reliability and Graceful Degradation

**User Story:** As the Owner, I want the system to continue functioning even when individual components fail, so that I never completely lose the ability to receive customer inquiries.

#### Acceptance Criteria

1. IF the AI_Assistant fails to respond within 10 seconds, THEN THE Chat_Widget SHALL display a message indicating the assistant is temporarily unavailable and present the order inquiry form to the Customer
2. IF the AI_Assistant fails to respond within 10 seconds, THEN THE WhatsApp_Integration SHALL send a predefined message acknowledging receipt and informing the Customer that the Owner will respond personally
3. IF the Telegram_Bot becomes unavailable, THEN THE Order_Service SHALL queue up to 1000 notifications and deliver them in order when the Telegram_Bot reconnects within 24 hours
4. IF the Telegram_Bot does not reconnect within 24 hours, THEN THE Order_Service SHALL send a summary of all queued notifications to the Owner's configured email address and discard the queue
5. WHILE serving up to 50 concurrent user sessions, THE Website SHALL maintain page load times under 3 seconds and API response times under 1 second
6. IF any external API (WhatsApp, Instagram, Telegram) returns an error, THEN THE system SHALL log the error with timestamp, API name, request payload, and error response, retry the operation up to 3 times with exponential backoff starting at 1-second intervals, and alert the Owner via Telegram_Bot or email fallback if all retries fail
7. IF the AI_Assistant fails to respond within 10 seconds to an Instagram DM, THEN THE Instagram_Integration SHALL send a predefined message acknowledging receipt and informing the Customer that the Owner will respond personally

### Requirement 13: Order Lifecycle Management

**User Story:** As the Owner, I want a clear workflow for orders from inquiry to delivery, so that no orders fall through the cracks and customers know their order status.

#### Acceptance Criteria

1. THE Order_Service SHALL manage orders through the following states in this allowed progression: Inquiry → Quoted → Deposit_Received → Confirmed → In_Production → Ready → Delivered/Picked_Up, with Cancelled reachable from any state except Delivered/Picked_Up
2. WHEN an order transitions between states, THE Order_Service SHALL record the timestamp and triggering action for audit purposes
3. WHEN a Customer asks about their order status via any channel, THE AI_Assistant SHALL retrieve and communicate the current state and most recent transition timestamp from the Order_Service within 5 seconds
4. WHEN an order moves to Confirmed state, THE Order_Service SHALL record the delivery or pickup preference and, if delivery, validate the address falls within Austin metro delivery zone
5. IF a delivery address provided at Confirmed state does not fall within the Austin metro delivery zone, THEN THE Order_Service SHALL reject the transition to Confirmed, retain the order in Deposit_Received state, and notify the Customer that their address is outside the delivery area with the option to select pickup instead
6. WHEN a deposit payment is submitted for an order in Quoted state, THE Order_Service SHALL verify the payment amount is at least 50% of the quoted price before transitioning the order to Deposit_Received state
7. IF the deposit payment amount is less than 50% of the quoted price, THEN THE Order_Service SHALL reject the state transition, retain the order in Quoted state, and notify the Customer of the minimum deposit amount required
8. WHEN an order is cancelled from Deposit_Received, Confirmed, or In_Production state, THE Order_Service SHALL record the cancellation reason and flag the order for deposit refund review by the Owner

### Requirement 14: Conversation Logging and Analytics

**User Story:** As the Owner, I want all customer conversations logged and analyzed, so that I can understand what customers ask about most and improve my business.

#### Acceptance Criteria

1. THE AI_Assistant SHALL log every conversation message (customer and assistant) with timestamp, channel source, and customer identifier to the data store, retaining logged data for a minimum of 12 months
2. THE Marketing_System SHALL deliver weekly analytics every Monday at a configured time via the Telegram_Bot showing: total conversations by channel, top 5 inquiry topics by message count, conversion rate from inquiry to order, and average response time per channel
3. THE AI_Assistant SHALL tag each conversation with one or more detected intent categories (pricing inquiry, availability check, custom design request, order status, general question)
4. WHEN the Owner requests analytics via the Telegram_Bot, THE Marketing_System SHALL return within 10 seconds a summary of the current week's metrics including: total conversations by channel, top 5 inquiry topics by message count, conversion rate from inquiry to order, and average response time
5. IF the AI_Assistant fails to log a conversation message, THEN THE AI_Assistant SHALL retry logging up to 3 times and, if all retries fail, SHALL queue the message for later persistence and notify the Owner via the Telegram_Bot

### Requirement 15: Customer Data Privacy

**User Story:** As a Customer, I want my personal data handled responsibly with clear consent, so that I feel safe sharing my information with the bakery.

#### Acceptance Criteria

1. THE Website SHALL display a privacy policy page describing what Customer data is collected, how the data is used, how the data is stored, and how a Customer can request data deletion
2. WHEN a Customer provides contact information through any channel, THE Order_Service SHALL store only the following data fields: customer name, email address, phone number, delivery address (if applicable), and order-related details (event date, servings, flavor, design description, budget range)
3. THE Website SHALL obtain explicit opt-in consent via an unchecked-by-default checkbox or equivalent affirmative action before subscribing a Customer to marketing communications, and SHALL record the consent timestamp and channel for each Customer
4. WHEN a Customer requests deletion of their data through the Website contact form, email, or any messaging channel, THE Order_Service SHALL remove personally identifiable information (name, email, phone number, delivery address) within 30 days while retaining anonymized order records for business analytics
5. WHEN the Order_Service receives a Customer data deletion request, THE Order_Service SHALL send an acknowledgment to the Customer within 48 hours confirming receipt of the request and the expected completion timeframe
6. WHEN a Customer withdraws marketing consent through the Website or by messaging any supported channel, THE Order_Service SHALL stop marketing communications to that Customer within 24 hours and update the consent record accordingly
