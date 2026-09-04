# Database

PostgreSQL + Prisma. Entidades tenant-owned incluyen `tenant_id`.

## Core
tenants, users, roles, permissions, role_permissions, user_roles, branches, user_branches, contacts, companies, contact_channels, conversations, messages, attachments, tags, contact_tags, notes, activities.

## Ecommerce configuration
`ecommerce_stores`: id, tenant_id, name, slug, status, operation_mode, location_source, fulfillment_options, theme_id, published_at.

`ecommerce_store_settings`: store_id, logo, mobile_logo, favicon, hero_image, mobile_hero_image, primary_color, secondary_color, button_color, text_color, background_color, promo_color, font_family, social_links, whatsapp_settings, seo_settings, checkout_settings.

`ecommerce_sections`: id, store_id, type, title, subtitle, config_json, sort_order, enabled.

`ecommerce_navigation`, `ecommerce_themes`.

## Catalog
categories, subcategories, products, product_variants, product_media, branch_products.

`branch_products`: tenant_id, branch_id, product_id, variant_id, stock, reserved_stock, min_stock, max_stock, reorder_point, price, compare_price, status.

## Commerce
`customer_addresses`: contact_id, label, recipient_name, phone, address_line, reference, city, zone, latitude, longitude, notes, is_default.

`commerce_sessions`: tenant_id, contact_id, conversation_id, store_id, branch_id, cart_id, appointment_id nullable, metadata, timestamps.

`carts`: tenant_id, contact_id, commerce_session_id, conversation_id nullable, branch_id nullable, status, currency, subtotal, discount, shipping, tax, total, expires_at.

`cart_items`: cart_id, product_id/variant_id/pack_id, quantity, unit_price, discount, subtotal, metadata_json.

## Orders
`orders`: tenant_id, contact_id, cart_id, branch_id, order_number, status, currency, subtotal, discount, shipping, tax, total, fulfillment_type, customer_address_id nullable, confirmed_at, timestamps.

`order_items`: order_id, product/variant/pack IDs, product_name_snapshot, sku_snapshot, quantity, unit_price, discount, subtotal.

order_status_history, payments, payment_transactions.

## Booking
booking_services, booking_service_users, booking_resources, booking_resource_services, booking_resource_schedules, appointments, appointment_services, appointment_resources, appointment_status_history, user_schedules, user_schedule_intervals, user_time_off.

## Fulfillment
`fulfillments`: tenant_id, order_id nullable, appointment_id nullable, type PICKUP|LOCAL_DELIVERY|SHIPPING, status, branch_id, customer_address_id nullable, scheduled_at, completed_at.

## Delivery futuro
delivery_orders, delivery_providers, delivery_provider_configs, delivery_zones, delivery_zone_rules, delivery_rates, delivery_rate_rules, drivers, driver_branches, driver_vehicles, delivery_assignments, delivery_tracking_events, delivery_routes, delivery_route_stops, delivery_proofs, delivery_status_history.

`delivery_routes`: tenant_id, branch_id, route_date, responsible_user_id, status PLANNED|PREPARING|IN_ROUTE|PARTIALLY_COMPLETED|COMPLETED|CANCELLED, started_at, completed_at, notes.

`delivery_route_stops`: route_id, fulfillment_id, sequence, status, planned_at, completed_at, notes.

## Inventory/Automation/AI
inventory_movements, inventory_transfers, inventory_transfer_items; events, event_subscriptions, flows, flow_nodes, flow_edges, flow_triggers, flow_actions, flow_executions, flow_execution_logs, campaigns, segments, tasks; ai_providers, ai_models, ai_agents, ai_agent_tools, knowledge_documents, knowledge_chunks, embeddings, ai_memory, ai_usage.

## Índices
tenant+created_at, tenant+status, tenant+branch_id, contact+created_at, conversation+created_at, unique order_number per tenant, cart by contact/session/status, route by tenant/date, route stops by route/sequence.
