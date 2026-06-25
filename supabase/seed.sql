-- =============================================================================
-- La La Sweett Sales System — Seed Data
-- Categories, sample products, flavors, and marketing channels
-- =============================================================================

-- =============================================================================
-- CATEGORIES (10 core categories from requirements)
-- =============================================================================
INSERT INTO categories (id, name, slug, description, sort_order, active) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Birthday Cakes', 'birthday-cakes', 'Custom birthday cakes for all ages, from elegant tiered designs to fun character themes. Available in multiple flavors and sizes.', 1, true),
    ('a1000000-0000-0000-0000-000000000002', 'Wedding Cakes', 'wedding-cakes', 'Stunning wedding cakes crafted to match your special day. Free initial consultation included. Multi-tier options available.', 2, true),
    ('a1000000-0000-0000-0000-000000000003', 'Baby Shower Cakes', 'baby-shower-cakes', 'Adorable baby shower cakes with gender reveal options, cute animal themes, and pastel designs.', 3, true),
    ('a1000000-0000-0000-0000-000000000004', 'Graduation Cakes', 'graduation-cakes', 'Celebrate academic achievements with custom graduation cakes featuring school colors and cap designs.', 4, true),
    ('a1000000-0000-0000-0000-000000000005', 'Holiday/Seasonal Cakes', 'holiday-seasonal-cakes', 'Festive cakes for Christmas, Thanksgiving, Halloween, Valentine''s Day, and other seasonal celebrations.', 5, true),
    ('a1000000-0000-0000-0000-000000000006', 'Character/Themed Cakes', 'character-themed-cakes', 'Fun character and themed cakes featuring popular characters, movies, hobbies, and interests.', 6, true),
    ('a1000000-0000-0000-0000-000000000007', 'Cupcakes', 'cupcakes', 'Beautifully decorated cupcakes perfect for parties, events, or everyday treats. Available by the dozen.', 7, true),
    ('a1000000-0000-0000-0000-000000000008', 'Cake Pops', 'cake-pops', 'Delicious cake pops in various flavors and decorations, great for party favors and dessert tables.', 8, true),
    ('a1000000-0000-0000-0000-000000000009', 'Cookies', 'cookies', 'Custom decorated sugar cookies for events, holidays, and corporate gifts. Individually wrapped available.', 9, true),
    ('a1000000-0000-0000-0000-000000000010', 'Mini Dessert Tables/Packages', 'mini-dessert-tables', 'Complete dessert table packages with assorted treats including cake, cupcakes, cake pops, and cookies.', 10, true);

-- =============================================================================
-- PRODUCTS — Birthday Cakes ($75–$250)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Classic Birthday Cake', 'Elegant single or double tier birthday cake with custom buttercream design and personalized message.', 75.00, 150.00, 10, 30, 7, '/images/products/birthday-classic.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [1, 2], "shapes": ["round", "square"]}', true),
    ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Premium Birthday Cake', 'Show-stopping multi-tier birthday cake with fondant details, custom toppers, and intricate designs.', 150.00, 250.00, 20, 60, 10, '/images/products/birthday-premium.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [2, 3], "shapes": ["round", "square", "hexagon"]}', true),
    ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Kids Birthday Fun Cake', 'Colorful and playful birthday cake with fun shapes, sprinkles, and kid-friendly decorations.', 75.00, 175.00, 10, 40, 7, '/images/products/birthday-kids.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [1, 2], "shapes": ["round", "number", "custom"]}', true);

-- =============================================================================
-- PRODUCTS — Wedding Cakes ($300–$800)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'Classic Wedding Cake', 'Timeless multi-tier wedding cake with buttercream or fondant finish, fresh flowers optional.', 300.00, 500.00, 50, 150, 14, '/images/products/wedding-classic.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [3, 4], "consultation": "free"}', true),
    ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'Luxury Wedding Cake', 'Stunning luxury wedding cake with hand-crafted sugar flowers, metallic accents, and premium details.', 500.00, 800.00, 100, 300, 21, '/images/products/wedding-luxury.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [4, 5], "consultation": "free"}', true),
    ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'Rustic Wedding Cake', 'Beautiful semi-naked or rustic style wedding cake with natural textures and seasonal decorations.', 300.00, 600.00, 50, 200, 14, '/images/products/wedding-rustic.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [3, 4], "consultation": "free"}', true);

-- =============================================================================
-- PRODUCTS — Baby Shower Cakes ($85–$200)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000003', 'Gender Reveal Cake', 'Surprise-filled gender reveal cake with hidden colored filling or confetti inside.', 85.00, 150.00, 15, 40, 7, '/images/products/babyshower-reveal.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"reveal_options": ["pink_filling", "blue_filling", "confetti"]}', true),
    ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000003', 'Baby Shower Themed Cake', 'Adorable baby shower cake with cute animal designs, booties, or nursery themes.', 100.00, 200.00, 20, 50, 10, '/images/products/babyshower-themed.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"themes": ["safari", "woodland", "nautical", "floral"]}', true);

-- =============================================================================
-- PRODUCTS — Graduation Cakes ($85–$200)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000004', 'Graduation Cap Cake', 'Classic graduation cake with cap topper, school colors, and congratulatory message.', 85.00, 150.00, 15, 40, 7, '/images/products/graduation-cap.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"customizable": ["school_colors", "year", "degree"]}', true),
    ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000004', 'Graduation Party Cake', 'Large celebration cake for graduation parties with multi-tier option and photo decoration.', 125.00, 200.00, 30, 60, 10, '/images/products/graduation-party.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"tiers": [1, 2], "photo_print": true}', true);

-- =============================================================================
-- PRODUCTS — Holiday/Seasonal ($75–$200)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000005', 'Holiday Celebration Cake', 'Festive holiday cake with seasonal decorations for Christmas, Thanksgiving, or Easter.', 85.00, 175.00, 10, 40, 7, '/images/products/holiday-celebration.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"seasons": ["christmas", "thanksgiving", "easter", "halloween"]}', true),
    ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000005', 'Valentine''s Day Cake', 'Romantic heart-shaped or decorated cake perfect for Valentine''s Day celebrations.', 75.00, 150.00, 8, 30, 7, '/images/products/holiday-valentines.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"shapes": ["heart", "round"], "colors": ["red", "pink", "gold"]}', true);

-- =============================================================================
-- PRODUCTS — Character/Themed ($100–$300)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000006', 'Character Cake', 'Custom character cake featuring favorite cartoon, movie, or game characters.', 100.00, 250.00, 15, 50, 10, '/images/products/character-custom.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"styles": ["printed", "sculpted_2d", "piped"]}', true),
    ('b1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000006', 'Hobby/Interest Cake', 'Themed cake celebrating hobbies, sports, music, or special interests.', 100.00, 300.00, 15, 60, 10, '/images/products/character-hobby.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"themes": ["sports", "music", "gaming", "travel"]}', true);

-- =============================================================================
-- PRODUCTS — Cupcakes ($36–$72 per dozen)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000007', 'Classic Cupcakes', 'Beautifully piped buttercream cupcakes in your choice of flavors. Minimum order one dozen.', 36.00, 48.00, 12, 120, 5, '/images/products/cupcakes-classic.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"unit": "dozen", "min_order": 12}', true),
    ('b1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000007', 'Themed Cupcakes', 'Custom decorated cupcakes with fondant toppers and themed designs matching your event.', 48.00, 72.00, 12, 120, 7, '/images/products/cupcakes-themed.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"unit": "dozen", "min_order": 12, "toppers": true}', true);

-- =============================================================================
-- PRODUCTS — Cake Pops ($30–$60 per dozen)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000008', 'Classic Cake Pops', 'Delicious chocolate-dipped cake pops with sprinkles or drizzle. Minimum order one dozen.', 30.00, 42.00, 12, 100, 5, '/images/products/cakepops-classic.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"unit": "dozen", "min_order": 12}', true),
    ('b1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000008', 'Custom Designed Cake Pops', 'Hand-decorated cake pops with custom designs, characters, or themed shapes.', 42.00, 60.00, 12, 100, 7, '/images/products/cakepops-custom.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"unit": "dozen", "min_order": 12, "custom_shapes": true}', true);

-- =============================================================================
-- PRODUCTS — Cookies ($36–$72 per dozen)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000009', 'Decorated Sugar Cookies', 'Hand-decorated royal icing sugar cookies in custom shapes and designs. Minimum one dozen.', 36.00, 60.00, 12, 120, 7, '/images/products/cookies-sugar.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"unit": "dozen", "min_order": 12, "packaging": ["bulk", "individual_wrap"]}', true),
    ('b1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000009', 'Corporate/Event Cookie Sets', 'Premium decorated cookie sets for corporate events, favors, and branding with logo options.', 48.00, 72.00, 12, 200, 10, '/images/products/cookies-corporate.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"unit": "dozen", "min_order": 24, "logo_printing": true}', true);

-- =============================================================================
-- PRODUCTS — Mini Dessert Tables ($200–$500)
-- =============================================================================
INSERT INTO products (id, category_id, name, description_short, price_min, price_max, min_servings, max_servings, lead_time_days, image_url, allergen_tags, structured_data, active) VALUES
    ('b1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000010', 'Mini Dessert Package', 'Curated dessert table with cake, cupcakes, and cake pops for intimate gatherings (20-50 guests).', 200.00, 350.00, 20, 50, 10, '/images/products/dessert-mini.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"includes": ["mini_cake", "12_cupcakes", "12_cake_pops"]}', true),
    ('b1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000010', 'Full Dessert Table Package', 'Complete dessert table with cake, cupcakes, cake pops, cookies, and display setup (50-150 guests).', 350.00, 500.00, 50, 150, 14, '/images/products/dessert-full.jpg', '["contains-gluten", "contains-dairy", "contains-eggs"]', '{"includes": ["tiered_cake", "24_cupcakes", "24_cake_pops", "24_cookies", "display_setup"]}', true);

-- =============================================================================
-- PRODUCT FLAVORS
-- =============================================================================

-- Birthday Cakes flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000001', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000001', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000001', 'Red Velvet', true),
    ('b1000000-0000-0000-0000-000000000001', 'Funfetti', true),
    ('b1000000-0000-0000-0000-000000000001', 'Strawberry', true),
    ('b1000000-0000-0000-0000-000000000002', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000002', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000002', 'Red Velvet', true),
    ('b1000000-0000-0000-0000-000000000002', 'Lemon', true),
    ('b1000000-0000-0000-0000-000000000002', 'Marble', true),
    ('b1000000-0000-0000-0000-000000000003', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000003', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000003', 'Funfetti', true),
    ('b1000000-0000-0000-0000-000000000003', 'Strawberry', true);

-- Wedding Cakes flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000004', 'Vanilla Bean', true),
    ('b1000000-0000-0000-0000-000000000004', 'Champagne', true),
    ('b1000000-0000-0000-0000-000000000004', 'Lemon Raspberry', true),
    ('b1000000-0000-0000-0000-000000000004', 'Chocolate Ganache', true),
    ('b1000000-0000-0000-0000-000000000004', 'Almond', true),
    ('b1000000-0000-0000-0000-000000000005', 'Vanilla Bean', true),
    ('b1000000-0000-0000-0000-000000000005', 'Champagne', true),
    ('b1000000-0000-0000-0000-000000000005', 'Earl Grey Lavender', true),
    ('b1000000-0000-0000-0000-000000000005', 'Chocolate Truffle', true),
    ('b1000000-0000-0000-0000-000000000005', 'Italian Cream', true),
    ('b1000000-0000-0000-0000-000000000006', 'Vanilla Bean', true),
    ('b1000000-0000-0000-0000-000000000006', 'Carrot Cake', true),
    ('b1000000-0000-0000-0000-000000000006', 'Lemon', true),
    ('b1000000-0000-0000-0000-000000000006', 'Spice Cake', true);

-- Baby Shower flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000007', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000007', 'Strawberry', true),
    ('b1000000-0000-0000-0000-000000000007', 'Lemon', true),
    ('b1000000-0000-0000-0000-000000000008', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000008', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000008', 'Funfetti', true);

-- Graduation flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000009', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000009', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000009', 'Red Velvet', true),
    ('b1000000-0000-0000-0000-000000000010', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000010', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000010', 'Marble', true);

-- Holiday flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000011', 'Gingerbread', true),
    ('b1000000-0000-0000-0000-000000000011', 'Pumpkin Spice', true),
    ('b1000000-0000-0000-0000-000000000011', 'Eggnog', true),
    ('b1000000-0000-0000-0000-000000000011', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000012', 'Red Velvet', true),
    ('b1000000-0000-0000-0000-000000000012', 'Strawberry', true),
    ('b1000000-0000-0000-0000-000000000012', 'Chocolate', true);

-- Character/Themed flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000013', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000013', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000013', 'Funfetti', true),
    ('b1000000-0000-0000-0000-000000000014', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000014', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000014', 'Red Velvet', true);

-- Cupcake flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000015', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000015', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000015', 'Red Velvet', true),
    ('b1000000-0000-0000-0000-000000000015', 'Lemon', true),
    ('b1000000-0000-0000-0000-000000000015', 'Strawberry', true),
    ('b1000000-0000-0000-0000-000000000016', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000016', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000016', 'Red Velvet', true);

-- Cake Pop flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000017', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000017', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000017', 'Red Velvet', true),
    ('b1000000-0000-0000-0000-000000000018', 'Vanilla', true),
    ('b1000000-0000-0000-0000-000000000018', 'Chocolate', true),
    ('b1000000-0000-0000-0000-000000000018', 'Birthday Cake', true);

-- Cookie flavors
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000019', 'Vanilla Sugar', true),
    ('b1000000-0000-0000-0000-000000000019', 'Chocolate Sugar', true),
    ('b1000000-0000-0000-0000-000000000019', 'Almond', true),
    ('b1000000-0000-0000-0000-000000000020', 'Vanilla Sugar', true),
    ('b1000000-0000-0000-0000-000000000020', 'Chocolate Sugar', true);

-- Dessert Table flavors (mixed)
INSERT INTO product_flavors (product_id, flavor_name, available) VALUES
    ('b1000000-0000-0000-0000-000000000021', 'Assorted (Your Choice)', true),
    ('b1000000-0000-0000-0000-000000000021', 'Vanilla & Chocolate Mix', true),
    ('b1000000-0000-0000-0000-000000000022', 'Assorted (Your Choice)', true),
    ('b1000000-0000-0000-0000-000000000022', 'Custom Mix', true);

-- =============================================================================
-- MARKETING CHANNELS (from Requirement 10)
-- =============================================================================
INSERT INTO marketing_channels (id, name, monthly_budget, channel_type) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Meta Ads', 30.00, 'paid'),
    ('c1000000-0000-0000-0000-000000000002', 'Google Local Search', 25.00, 'paid'),
    ('c1000000-0000-0000-0000-000000000003', 'Boosted Instagram Posts', 20.00, 'paid'),
    ('c1000000-0000-0000-0000-000000000004', 'Organic Content', 15.00, 'organic'),
    ('c1000000-0000-0000-0000-000000000005', 'Review Generation', 10.00, 'organic');
