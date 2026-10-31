# InfoHQ — CRM & UI Color Design System Specification

> **Purpose**: This document contains the complete, exact color palette, gradients, text treatments, surfaces, and visual styling rules used across the **InfoHQ** production website.  
> **Agent Implementation Rule**: When designing or building any CRM, dashboard, or web UI, copy the exact HEX, RGBA, and gradient formulas below. Do not approximate or substitute any color.

---

## 1. Color Palette Overview & Visual Philosophy

InfoHQ uses a **Modern Gradient-Infused Light Studio Aesthetic**:
* **Base Foundation**: Soft, clean lavender-white canvas (`#F8F8FF`) paired with pure white cards (`#FFFFFF`). Never harsh pure gray or stark plain white.
* **Text Contrast**: Deep royal navy-purple (`#1A085C`) for all headings, giving enterprise authority without the dullness of pure `#000000`.
* **Primary Brand Gradient (4-Stop)**: Coral $\to$ Magenta $\to$ Purple $\to$ Royal Blue. Used for headline highlights, accent keywords, and gradient borders.
* **Action & CTA Gradient (2-Stop)**: Electric Violet $\to$ Hot Pink. Used for high-conversion buttons, pills, and active indicators.
* **Dark Contrast Accent**: Midnight Navy to Deep Indigo (`#1A085C` $\to$ `#081E71`) used for footers, terminal mockups, and high-tech cards.

---

## 2. Complete CSS Color Tokens (Copy-Paste `:root`)

```css
:root {
  /* ==========================================================================
     1. BRAND GRADIENTS
     ========================================================================== */
  /* 4-Stop Primary Brand Signature Gradient (Headlines, Accent Words, Key Highlights) */
  --brand-gradient: linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%);
  --brand-gradient-hover: linear-gradient(90deg, #D34F3E 0%, #C93D75 35%, #8040A8 65%, #4770CE 100%);
  --brand-gradient-vertical: linear-gradient(180deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%);

  /* 2-Stop Action & Primary Button Gradient (Let's Talk, Consultation, Primary CTAs) */
  --btn-cta-bg: linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%);
  --btn-cta-hover: linear-gradient(90deg, #4A3BE2 0%, #D84890 100%);
  
  /* Active Link & Underline Gradient */
  --nav-underline-gradient: linear-gradient(90deg, #5B4BF0 0%, #C24BD6 100%);
  
  /* Pricing / Special High-Conversion Gradient */
  --pricing-cta-gradient: linear-gradient(90deg, #F43F5E 0%, #E11D48 20%, #7C3AED 70%, #2563EB 100%);

  /* ==========================================================================
     2. SOLID PRIMARY PURPLES & BRAND ACCENTS
     ========================================================================== */
  --color-primary: #7C5CE8;            /* Main solid brand purple */
  --color-primary-hover: #6A48DC;      /* Solid button hover */
  --color-primary-active: #5835CF;     /* Solid button pressed */
  --color-primary-light: #E5DEFF;      /* Badge fills, soft borders */
  --color-primary-subtle: #F3F0FF;     /* Ultra-soft icon background tint */
  --color-accent-blue: #5B4CF5;        /* Vibrant UI action violet */
  --color-accent-pink: #E85AA0;        /* Vibrant UI action pink */

  /* ==========================================================================
     3. TYPOGRAPHY COLORS
     ========================================================================== */
  --color-text-heading: #1A085C;       /* Main headings (H1, H2, H3), card titles */
  --color-text-body: #4B5563;          /* Main paragraph text, body copy, list text */
  --color-text-muted: #6B7280;         /* Subtitles, timestamps, breadcrumbs, tags */
  --color-text-light: #9CA3AF;         /* Placeholder text, inactive hints */
  --color-text-white: #FFFFFF;         /* White text on dark/gradient buttons & cards */

  /* ==========================================================================
     4. BACKGROUNDS & SURFACES
     ========================================================================== */
  --color-bg-page: #F8F8FF;           /* Main page canvas (soft lavender white) */
  --color-bg-section: #F4F3F9;        /* Alternating secondary section background */
  --color-bg-wash: #E6DFFE;           /* Subtle bottom section gradient wash */
  --color-surface-white: #FFFFFF;     /* Standard card background */
  --color-surface-elevated: #FFFFFF;  /* Modals, popovers, dropdowns */
  
  /* Dark Tech Surfaces (Footer, Code blocks, Dark cards) */
  --color-dark-navy: #1A085C;
  --color-dark-indigo: #081E71;
  --color-dark-surface: linear-gradient(135deg, #1A085C 0%, #081E71 100%);
  --color-dark-surface-vertical: linear-gradient(180deg, #1A085C 0%, #081E71 100%);
  --color-text-dark-muted: rgba(230, 223, 254, 0.8);

  /* Glassmorphic Surfaces (Floating Nav, Floating Banners) */
  --glass-bg: rgba(255, 255, 255, 0.84);
  --glass-border: 1px solid rgba(120, 110, 220, 0.16);
  --glass-backdrop-blur: blur(20px);

  /* ==========================================================================
     5. BORDERS & DIVIDERS
     ========================================================================== */
  --color-border-card: #EAE6F7;                        /* Default card outline */
  --color-border-subtle: rgba(124, 92, 232, 0.12);     /* Hairline container borders */
  --color-border-focus: #5B4BF0;                       /* Active input focus outline */
  --divider-color: rgba(20, 20, 60, 0.10);             /* Table lines, header border */

  /* ==========================================================================
     6. STATUS & SYSTEM FEEDBACK COLORS
     ========================================================================== */
  --color-success: #10B981;             /* Success green (Active, Online) */
  --color-success-bg: rgba(16, 185, 129, 0.10);
  --color-warning: #F59E0B;             /* Warning amber (Offline, Pending) */
  --color-warning-bg: rgba(245, 158, 11, 0.12);
  --color-error: #EF4444;               /* Error red (Failed, Danger) */
  --color-error-bg: rgba(239, 68, 68, 0.10);
  --color-info: #3B82F6;                /* Info blue */
  --color-info-bg: rgba(59, 130, 246, 0.10);

  /* ==========================================================================
     7. ELEVATIONS, SHADOWS & GLOWS
     ========================================================================== */
  --shadow-sm: 0 1px 3px rgba(26, 8, 92, 0.04);
  --shadow-md: 0 4px 16px rgba(26, 8, 92, 0.06);
  --shadow-lg: 0 10px 30px rgba(26, 8, 92, 0.08);
  --shadow-xl: 0 20px 40px rgba(26, 8, 92, 0.10);
  
  /* Colored Ambient Drop Shadows for Interactive Elements */
  --shadow-btn-cta: 0 4px 14px rgba(99, 88, 240, 0.30);
  --shadow-btn-cta-hover: 0 6px 18px rgba(99, 88, 240, 0.42);
  --shadow-card-hover: 0 16px 36px rgba(124, 92, 232, 0.12);
  --shadow-glow-purple: 0 0 25px rgba(124, 92, 232, 0.25);
}
```

---

## 3. How Colors Are Used (Component-by-Component Rules)

### 3.1. Typography & Text Styling

#### 1. Gradient Highlight Text (`.text-gradient`)
Used for 1 to 3 words inside headings to give that signature InfoHQ vibrancy.
```css
.text-gradient {
  background: linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: inline-block;
}
```
* **Example Usage**: `<h2>Transform Your <span class="text-gradient">Business Intelligence</span></h2>`

#### 2. Headings (H1, H2, H3, Card Titles)
* **Color**: `#1A085C` (Deep Royal Navy)
* **Font Weight**: `700` (H2/H3) to `800` (H1)
* **Letter Spacing**: `-0.02em`
* **Rule**: Never use pure black (`#000000`). `#1A085C` gives warmth, brand continuity, and high readability.

#### 3. Body Text (Paragraphs, Descriptions)
* **Color**: `#4B5563`
* **Line Height**: `1.65`
* **Font Weight**: `400` or `500`

#### 4. Metadata, Dates & Secondary Labels
* **Color**: `#6B7280`
* **Font Weight**: `500` to `600`

#### 5. Eyebrow Tags & Section Subtitles
* **Color**: `#7C5CE8` (or `#DD4985` for story/founder accents)
* **Text Transform**: `uppercase`
* **Font Weight**: `700`
* **Letter Spacing**: `0.08em`

---

### 3.2. Buttons & CTAs

#### 1. Primary Action Button (`.btn-primary`)
Used for "Free Consultation", "Save Changes", "Create Deal", "Let's Talk".
```css
.btn-primary {
  background: linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%);
  color: #FFFFFF;
  font-weight: 600;
  border: none;
  border-radius: 9999px; /* Pill shape */
  padding: 0.6rem 1.3rem;
  box-shadow: 0 4px 14px rgba(99, 88, 240, 0.30);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1.5px);
  box-shadow: 0 6px 18px rgba(99, 88, 240, 0.42);
  filter: brightness(1.06);
}

.btn-primary:active {
  transform: translateY(0);
}
```

#### 2. Secondary / Ghost Button (`.btn-secondary`)
Used for "Cancel", "View Details", "Export", "Learn More".
```css
.btn-secondary {
  background: #FFFFFF;
  color: #1A085C;
  border: 1px solid rgba(120, 110, 220, 0.24);
  border-radius: 9999px;
  font-weight: 600;
  padding: 0.6rem 1.3rem;
  box-shadow: 0 2px 6px rgba(26, 8, 92, 0.04);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.btn-secondary:hover {
  background: #F3F0FF;
  border-color: #7C5CE8;
  color: #5B4CF5;
}
```

---

### 3.3. Cards & Container Surfaces

#### 1. Standard Light Card (Metrics, CRM Deals, Tables, Widgets)
```css
.crm-card {
  background: #FFFFFF;
  border: 1px solid #EAE6F7;
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 8px 24px rgba(124, 92, 232, 0.04), 0 2px 6px rgba(15, 9, 38, 0.02);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}

.crm-card:hover {
  transform: translateY(-3px);
  border-color: rgba(124, 92, 232, 0.28);
  box-shadow: 0 16px 36px rgba(124, 92, 232, 0.10);
}
```

#### 2. Floating Navbar / Glassmorphic Bar
```css
.glass-header {
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(120, 110, 220, 0.16);
  border-radius: 26px;
  box-shadow: 
    0 12px 32px -4px rgba(20, 10, 60, 0.08),
    0 4px 12px -2px rgba(20, 10, 60, 0.03),
    inset 0 1px 1px rgba(255, 255, 255, 0.95);
}
```

#### 3. Dark Contrast Surface (Executive Summaries, Deep Analytics)
```css
.dark-panel {
  background: linear-gradient(135deg, #1A085C 0%, #081E71 100%);
  border: 1px solid rgba(145, 79, 187, 0.3);
  border-radius: 24px;
  color: #FFFFFF;
  box-shadow: 0 20px 40px rgba(10, 4, 30, 0.25);
}

.dark-panel h3 {
  color: #FFFFFF;
}

.dark-panel p {
  color: rgba(230, 223, 254, 0.85);
}
```

---

### 3.4. Input Fields & Form Controls

```css
.input-control {
  background: #FFFFFF;
  border: 1px solid #EAE6F7;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: #1A085C;
  font-size: 0.95rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-control::placeholder {
  color: #9CA3AF;
}

.input-control:hover {
  border-color: rgba(124, 92, 232, 0.35);
}

.input-control:focus {
  outline: none;
  border-color: #5B4BF0;
  box-shadow: 0 0 0 3px rgba(91, 75, 240, 0.15);
}
```

---

### 3.5. Status Indicators & Badges

Used for Deal Status, Leads, Connectivity, and Active Filters:

| State | Background Tint | Text / Dot Color | Border Color |
|---|---|---|---|
| **Active / Won / Online** | `rgba(16, 185, 129, 0.10)` | `#10B981` (Emerald) | `rgba(16, 185, 129, 0.30)` |
| **Pending / In Progress** | `rgba(245, 158, 11, 0.12)` | `#F59E0B` (Amber) | `rgba(245, 158, 11, 0.30)` |
| **Urgent / Lost / Error** | `rgba(239, 68, 68, 0.10)` | `#EF4444` (Crimson) | `rgba(239, 68, 68, 0.28)` |
| **New Lead / Info** | `rgba(91, 75, 240, 0.08)` | `#5B4CF5` (Brand Violet)| `rgba(91, 75, 240, 0.22)` |

---

## 4. Key Rules for Any AI Agent Generating Code

1. **Never use standard grayscale black (`#000000`) or charcoal (`#222222`) for text.**  
   Always use `--color-text-heading: #1A085C` for titles, and `--color-text-body: #4B5563` for regular text.
2. **Never make page backgrounds pure blinding white (`#FFFFFF`) or dull gray (`#F3F4F6`).**  
   Always use `--color-bg-page: #F8F8FF` (soft lavender white) for the page canvas, and place pure white (`#FFFFFF`) cards on top of it.
3. **Primary CTA buttons must always have the 2-stop gradient**:  
   `background: linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)` with colored drop-shadow `rgba(99, 88, 240, 0.30)`.
4. **Hero & prominent section headlines should contain 1-3 words wrapped in `.text-gradient`**:  
   `background: linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)`.
5. **Card corners**: Use `border-radius: 18px` to `24px` for main cards, and `9999px` (full pill) for buttons and status badges.
6. **Borders**: Keep card borders subtle using `#EAE6F7` or `rgba(124, 92, 232, 0.14)`.

