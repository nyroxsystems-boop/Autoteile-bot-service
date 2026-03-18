
# ADR 003: WhatsApp Bot State Machine

## Status
Accepted

## Context
Handling asynchronous conversational flows (WhatsApp/Twilio) where users randomly reply, send photos, or go silent requires robust state tracking. A linear procedural script fails immediately when users step out of bounds.

## Decision
We built a Redis-backed finite state machine (`botLogicService.ts`, `stateMachine/`) that maps users to isolated states (e.g., `AWAITING_KBA`, `AWAITING_PART`, `AWAITING_CONFIRMATION`). Every inbound webhook triggers a handler strictly mapped to the user's current state.

## Consequences
- **Positive:** Predictable UI behavior inside an unstructured text interface. Easy to unit test individual handlers.
- **Negative:** Adding a new step to a flow requires touching the Redis schema, the handler, and the state typings.
