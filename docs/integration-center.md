# Integration Center Architecture

Vortex One treats external applications, SaaS products, communication providers, AI providers, CRMs, storage services, and productivity platforms as optional integrations.

## Core platform

The platform owns its application runtime, authentication/session state, tenant boundaries, audit state, and PostgreSQL persistence.

PostgreSQL is a core storage dependency. It is not an external app integration.

## External integrations

Provider-specific services are connected through the Integration Center. A provider account may be connected when the user already has an account or when the provider supports account creation through Google and/or Microsoft sign-in.

Examples include Google Workspace, Microsoft 365, RingCentral, AI providers, CRM systems, Slack, email providers, storage systems, and external property-data services.

An unavailable or disconnected integration must not prevent the core platform from starting.

## Connection model

Each integration should expose:

- provider identity and category
- supported authentication method
- connection state
- account/workspace identity after authorization
- scopes and permissions granted
- connect, reconnect, disconnect, and test actions
- provider-specific health and capability status

Credentials and refresh tokens belong to the integration connection layer and must never be placed in client-visible VITE_* configuration.

## Sign-in options

Where a provider supports OAuth, the Integration Center should prefer the provider's OAuth flow. If account creation is offered, the UI may provide Google and/or Microsoft sign-in according to the provider's supported identity options.

Google/Microsoft sign-in is an account-creation convenience; it does not make Google or Microsoft a core Vortex One dependency.

## Graceful degradation

Core navigation, tenant state, PostgreSQL persistence, audit records, and platform workflows must continue to function when an integration is disconnected.

Provider-dependent features should show a clear connection state and direct the user to the Integration Center rather than failing platform startup.