# UI/UX Design System & Anti-Slop Rules

## 1. Color System & Contrast
- **Strict 90/10 Distribution**: 90% structural neutrals (deep charcoal, pitch dark, clean light backdrops), 10% high-contrast accent color.
- **WCAG Contrast Compliance**: Minimum 4.5:1 contrast for normal body text, minimum 3:1 for large text.
- **Tinted Neutrals**: Avoid pure dead grays (#888888); use subtle tinted undertones (slate, zinc, warm dark).

## 2. Mobile & Responsive Touch Architecture
- **Touch Target Geometry**: Minimum 48x48px safe bounding box for all interactive triggers, buttons, and links.
- **Lower-Third Reachability**: Primary interactive triggers and navigation docks must stay comfortably within reach of the thumb zone on mobile screens (< 768px).
- **Web Sticky Hover Isolation**: Protect mobile touchscreens from sticky hover states using Tailwind's `md:hover:...` or `@media (hover: hover)`.

## 3. Anti-Slop Visual Standards
- **Zero Decorative Slop**: No generic un-tinted shadows, no arbitrary nested cards inside cards, no floating purple-blue AI-slop gradients.
- **Clean Typography**: Establish strong typographic hierarchy (metric/headline dominance over muted labels). Use tabular figures (`tabular-nums` / `font-mono`) for numerical values.
- **Layout Shift Containment**: Lock aspect ratios on 3D canvases, images, and videos (`aspect-video`, `aspect-square`) to ensure zero Cumulative Layout Shift (CLS).
