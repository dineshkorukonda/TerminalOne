# Theme foundation

The renderer consumes Tailwind v4 theme tokens from `src/renderer/src/theme/tokens.css`, compiled locally through the Vite plugin. Tokens cover near-black canvas/panel/elevated surfaces, text, muted text, decorative/control borders, focus/accent colors, system font stacks, radius, and sixteen ANSI colors. Only renderer sources are scanned for utilities. No remote CSS, font service, or image is loaded.

The current view demonstrates startup status, typography, and the ANSI palette. It is not a terminal emulator or a dashboard; shell sessions, settings, tabs, and terminal themes are later issues. The Project documentation button uses the existing allowlisted external-link capability. Icons use a shared 24×24 SVG component with consistent 1.5px strokes and inherit text color; decorative SVGs are hidden from assistive technology.

## Font model

`TerminalFontConfig` has a whitelisted family, integer size 10–32px, finite line height 1–2, and a boolean ligature setting. Defaults are Cascadia Mono, 14px, line height 1.5, ligatures disabled. Available families are Cascadia Mono, Consolas, and Liberation Mono, with local monospace fallbacks. Missing fonts use the fallback; no font installation or download is implied. The font sample consumes the typed model. No settings persistence or user font picker is shipped.

The parser rejects missing/extra fields, unknown families, non-finite/fractional/out-of-range metrics, and invalid ligature values. Unit tests exercise the boundary, including CSS-injection-shaped family values.

## Focus and contrast

All keyboard-focused controls use a 2px solid `focus` outline, offset 3px from the control. The documentation button is reachable by Tab and has a visible text label. The Electron component tests verify focus, outline width/style/color, shared canvas color, computed font metrics, all sixteen swatches, and absence of horizontal overflow. ANSI swatches are decorative color samples with accessible color names, not low-contrast text content.

Measured sRGB contrast from the actual token definitions:

- Ink on canvas: 16.57:1.
- Muted text on panel: 7.67:1.
- Ink on elevated button: 13.11:1.
- Focus outline on canvas: 11.11:1; on panel: 10.15:1.
- Control border on elevated button: 3.20:1.

Unit checks enforce 4.5:1 for text and 3:1 for focus/control boundaries. Subtle decorative dividers do not carry control or status meaning. A full assistive-technology and contrast audit remains in #46.

## Scale verification

`npm run test:smoke` launches built and development renderers at Chromium device-scale factors 1, 1.5, and 2, retaining a focused-window screenshot from each case. These correspond to 100%, 150%, and 200% renderer scaling. All six tests passed on Linux during implementation. The Windows theme CI run passed all six cases; its 100%, 150%, and 200% built-window screenshots were visually inspected and retained in the [Phase 0 verification record](phase-0-verification.md).

Forced Chromium scale does not test native window chrome or changing Windows system DPI across monitors. Those checks remain in #23/#45; no Windows 10/11 compatibility guarantee is made here.
