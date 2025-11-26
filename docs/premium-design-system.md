# Premium Design System (Web + Mobile)

This overhaul aligns the web and Expo mobile apps around a single luxe fintech language inspired by gradient luxury / minimal fintech aesthetics.

## Core style choices
- **Palette family**: Violet ➜ Cyan gradient, backed by charcoal neutrals.
- **Primary style**: Minimal fintech with glassmorphism accents (frosted cards, soft depth, micro-interactions).
- **Layout rule**: Persistent left sidebar (drawer on mobile) with redesigned icons, rails, and hover/active treatments.
- **Typography**: Bold display weights for financial figures, tighter letter-spacing on labels, and small-caps meta labels.

## Theme tokens
- **Light**
  - Background: `oklch(0.985 0.014 250)`
  - Primary: `oklch(0.63 0.21 295)`
  - Accent: `oklch(0.78 0.15 190)`
  - Card: translucent frosted white with subtle border + blur
- **Dark**
  - Background: `oklch(0.08 0.01 250)`
  - Primary: `oklch(0.76 0.23 296)`
  - Accent: `oklch(0.8 0.16 195)`
  - Card: translucent charcoal with glass highlights

For mobile, matching palettes live in `mobile/src/styles/theme.ts` (`palette.light` / `palette.dark`). Default rendering uses the dark palette to keep parity with the premium fintech feel.

## Component guidance
- **Sidebar**: Gradient badge logo, vertical accent rail for active state, glass cards for user block, rounded icon tiles.
- **Cards**: Frosted surfaces, layered gradients, and soft elevation (`--glass`). Hover states lift with stronger shadows; metric pills reinforce status.
- **Buttons**: Rounded-xl, gradient primary fills, subtle scale on press; outline uses translucent borders.
- **Mining CTA**: Circular glow, pulse rings, and state-specific badges (ready / cooldown / deposit required).
- **Tables/lists**: Prefer compact density with pill statuses; on mobile, stack rows into cards with leading icon + trailing pill.

## Light/dark behavior
- All palette tokens are defined in `app/globals.css`; tailwind classes consume CSS variables so components inherit automatically.
- Cards and buttons rely on blur + gradient surfaces—keep transparency (rgba/oklch with alpha) intact when adjusting colors.
- Navigation drawers on mobile should apply the same gradient + blur background used on web sidebar.

## Rollout checklist
- Verify sidebar and dashboard cards visually in both themes.
- Ensure gradients remain WCAG-compliant (check contrast on text over blended surfaces).
- When adding new components, use the same radii scale (`--radius` derives sm/md/lg/xl) and animation timings (`--t-fast`, `--t-med`).

