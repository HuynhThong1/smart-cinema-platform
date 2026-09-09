# Galaxy Cinema – Brand Colors & Logo

Website: https://www.galaxycine.vn/

## 1. Brand Colors

| Role | Color | HEX | Suggested Usage |
|---|---|---|---|
| Primary | Galaxy Orange | `#F26B38` | CTA, primary buttons, highlights |
| Secondary | Galaxy Blue | `#034EA2` | Header, navigation, links |
| Text Primary | Dark Gray | `#1F2937` | Main text |
| Text Secondary | Gray | `#6B7280` | Secondary text |
| Background | White | `#FFFFFF` | Main background |
| Background Secondary | Light Gray | `#F5F5F5` | Sections, cards |
| Border | Light Gray | `#E5E7EB` | Borders, dividers |

## 2. Recommended Design Tokens

```css
:root {
  --color-primary: #F26B38;
  --color-primary-hover: #E95D29;
  --color-primary-active: #D94F20;

  --color-secondary: #034EA2;
  --color-secondary-hover: #02458F;
  --color-secondary-active: #013D80;

  --color-background: #FFFFFF;
  --color-background-secondary: #F5F5F5;

  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;

  --color-border: #E5E7EB;

  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-error: #DC2626;
}
```

## 3. Logo

### Header Logo – PNG

https://www.galaxycine.vn/_next/static/media/logo-glx-header.8bbdac6e.png

Recommended for:
- Website header
- Prototype
- Internal documents

### Footer Logo – SVG

https://www.galaxycine.vn/media/2024/11/11/glx-footer.svg

Recommended for:
- Figma
- Design systems
- High-resolution documents
- Printing

SVG is preferred when possible because it scales without losing quality.

## 4. Recommended UI Usage

### Primary Actions

Use Galaxy Orange:

```text
#F26B38
```

Examples:
- Submit feedback
- Confirm
- Save
- Main CTA

### Navigation / Structural Elements

Use Galaxy Blue:

```text
#034EA2
```

Examples:
- Header
- Navigation
- Links
- Secondary buttons
- Admin sidebar

### Background

Main:

```text
#FFFFFF
```

Secondary sections/cards:

```text
#F5F5F5
```

## 5. Suggested Theme

For a Galaxy Cinema–inspired application:

- **Primary:** `#F26B38`
- **Secondary:** `#034EA2`
- **Background:** `#FFFFFF`
- **Surface:** `#F5F5F5`
- **Text:** `#1F2937`
- **Muted Text:** `#6B7280`
- **Border:** `#E5E7EB`

The Galaxy logo itself contains multiple accent colors, but the application UI should mainly use **Orange + Blue** to keep the interface consistent and clean.

## 6. Tailwind Example

```js
colors: {
  galaxy: {
    orange: '#F26B38',
    blue: '#034EA2',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
  }
}
```

---

Source: Galaxy Cinema official website  
https://www.galaxycine.vn/
