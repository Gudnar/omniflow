# Implementation Plan

0. Discovery
1. Foundation
2. Auth + Tenancy
3. Branches
4. CRM
5. Conversations
6. WhatsApp
7. Other channels
8. Ecommerce foundation
9. Products + inventory
10. Cart + checkout
11. Orders
12. Booking
13. AI foundation
14. AI Commerce
15. RAG
16. Workflows
17. Campaigns/templates
18. Manual fulfillment
19. Manual delivery routes
20. Advanced delivery
21. Analytics
22. Billing
23. Production hardening
24. QA
25. Deployment
26. Voice: Audio transcription
27. Voice: Phone calls (futuro)

## Ecommerce foundation
Config store, operation mode, theme/colors, hero, sections, mobile preview, branch selection, location source.

## Orders
Confirmación transaccional, reserva de stock, estados y operación manual.

## Manual fulfillment
Pickup y registro de delivery.

## Manual delivery
Rutas del día, stops, secuencia, responsable, mapa, estados y notificaciones.

## Advanced delivery futuro
Zonas, tarifas, drivers, vehicles, assignments, ETA, tracking, proofs, provider adapters y APIs externas.

No implementar logística automática durante las fases iniciales.

## Voice: Audio transcription
Detectar mensajes de audio entrantes (WhatsApp, Instagram, Messenger), descargar el archivo vía el Media API del canal, transcribir con Whisper u otro STT, guardarlo como Attachment y usar el texto transcrito como entrada del agente de IA (Fase 13). Requiere: `MessageType.AUDIO`, cola/worker "transcriptions" (ya nombrado en ARCHITECTURE.md pero nunca implementado), y un `TranscriptionAdapter` con el mismo patrón que los adapters de IA existentes. Extensión natural de canales/IA ya construidos, sin proveedores nuevos.

## Voice: Phone calls futuro
Contestar llamadas telefónicas con un agente de IA (STT↔LLM↔TTS en tiempo real, fuera del ciclo request/response HTTP habitual). Requiere elegir proveedor de telefonía (Twilio Voice + pipeline propio, o una plataforma voice-agent todo-en-uno como Vapi/Retell), un número de teléfono dedicado, nuevo modelo de datos (Call, grabación, transcripción) y un webhook de voz separado del de mensajería. No implementar sin elegir proveedor y validar costos, cumplimiento y consentimiento de grabación primero.
