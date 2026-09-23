# Vortex One — Design Context

## Product register
Vortex One is a production-oriented property intelligence and AI operations platform. The primary users operate dense workflows: property discovery, owner/lead research, outreach, approvals, agent monitoring, analytics, and audit review.

## Visual thesis
**Mission-control clarity for property intelligence.** The interface should feel like a serious operations console rather than a generic SaaS dashboard: calm neutral work surfaces, deep graphite/navy structural chrome, electric cyan for active intelligence, and restrained amber for attention/risk.

The signature element is the **intelligence rail**: active context, agent telemetry, approvals, and system status should feel continuously present without competing with the user's primary work.

## Palette
- Ink / structural: #0B1220
- Deep navy: #111C2E
- Work surface: #F7F9FC
- Elevated surface: #FFFFFF
- Cyan signal: #06B6D4
- Blue action: #2563EB
- Amber attention: #D97706
- Green healthy: #059669
- Red destructive: #DC2626
- Muted text: #64748B
- Hairline: #E2E8F0

Use cyan for intelligence/active state, blue for primary actions, amber for attention, green for healthy state, and red only for destructive/security-sensitive actions. Do not communicate state by color alone.

## Typography
- Display / product identity: Inter or the existing system sans, with tight tracking and strong weight.
- Body: system sans stack for reliable rendering and density.
- Data / telemetry: tabular numerals and compact mono only where the content is genuinely machine-like.

Keep headings compact and operational. Avoid oversized marketing typography inside authenticated product surfaces.

## Layout
- Persistent top header for identity, tenant context, search, and global actions.
- Persistent left navigation for domain switching and AI fleet visibility.
- Main workspace owns document scrolling.
- Context Inspector is a secondary information rail and must never obscure the primary workflow.
- Mobile uses a bottom navigation bar plus a full-height navigation drawer.
- Tables and long lists own their own scrolling; never solve table height by hiding page scrolling.

## Interaction language
Use plain action verbs: Search, Save changes, Create lead, Start call, Run research, Approve, Reject, Delete.

Every interactive control needs hover, keyboard focus, pressed/busy, and disabled states. Use native semantic controls whenever possible.

## Motion
Motion is functional and restrained:
- 120–180ms for local hover/focus transitions.
- 200–260ms for drawers and panels.
- Avoid continuous decorative animation except live agent/status indicators where the motion communicates activity.
- Respect prefers-reduced-motion.

## Accessibility
Target WCAG 2.2 AA. Maintain visible focus, semantic controls, accessible names, stable layout during async states, keyboard access to menus/dialogs, and sufficient contrast.

## Durable rules
1. Reuse existing shared components before creating screen-local equivalents.
2. Preserve the established Vortex One information architecture.
3. Keep the operational density high, but create clear hierarchy through spacing and typography rather than excessive cards.
4. Keep danger actions visually separated from safe primary actions.
5. Do not introduce gradients, glassmorphism, oversized shadows, or decorative badges unless they carry product meaning.
6. New screens must visually and behaviorally match this context.
