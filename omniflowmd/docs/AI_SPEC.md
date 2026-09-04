# AI Specification

## Providers
Adapters para OpenAI, Anthropic, Gemini y otros. Capabilities: text, vision, transcription, embeddings, tool calling.

## Agent
name, model, temperature, goal, personality, language, channels, knowledge, tools, escalation, limits.

## Ecommerce tools
search_products, check_stock, find_branch, get_price, search_promotions, search_packs, create_cart, get_cart, add_to_cart, modify_cart, remove_from_cart, create_order, get_order, cancel_order, create_checkout, request_location.

## Booking tools
search_booking_services, get_available_slots, find_best_specialist, book_appointment, reschedule_appointment, cancel_appointment, get_appointment.

## Delivery futuro
check_delivery_coverage, get_delivery_quote, get_delivery_status, request_delivery_location, request_human_delivery_assistance. No autonomía inicial para modificar rutas, tarifas, repartidores o completar entregas.

## Seguridad
Cada tool define required_permissions, allowed_scopes, input_schema, risk_level, confirmation_required.

## Context/RAG
Resumen + mensajes relevantes + memoria + RAG. RAG estrictamente aislado por tenant.
