# CondoTrack - Landing Page State-of-the-Art

## Conceito Visual "High-End"

### Filosofia de Design
**"Dark Luxury meets Functional Minimalism"**

Inspiração direta em: Linear, Raycast, Vercel, Framer, Arc Browser
O CondoTrack deve parecer uma ferramenta criada por designers obsessivos para usuários exigentes.

---

## 1. Design System - Paleta "Midnight Aurora"

### Cores Base (Fundos)
```css
--bg-primary: #0A0F1A;      /* Deep Space - fundo principal */
--bg-secondary: #0F172A;    /* Midnight Slate - cards */
--bg-tertiary: #1E293B;     /* Elevated surfaces */
--bg-glass: rgba(15, 23, 42, 0.7); /* Glassmorphism base */
```

### Cores de Acento (Glow Effects)
```css
--accent-cyan: #06B6D4;     /* Cyan elétrico - CTAs primários */
--accent-emerald: #10B981;  /* Verde menta - sucesso/confirmação */
--accent-violet: #8B5CF6;   /* Ultravioleta - destaques premium */
--accent-amber: #F59E0B;    /* Âmbar - alertas elegantes */
```

### Gradientes Signature
```css
--gradient-hero: linear-gradient(135deg, #06B6D4 0%, #8B5CF6 50%, #EC4899 100%);
--gradient-text: linear-gradient(90deg, #06B6D4 0%, #8B5CF6 100%);
--gradient-glow: radial-gradient(ellipse at center, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
--gradient-mesh:
  radial-gradient(at 40% 20%, rgba(6, 182, 212, 0.15) 0px, transparent 50%),
  radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.1) 0px, transparent 50%),
  radial-gradient(at 0% 50%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
```

### Superfícies Glass
```css
--glass-card: backdrop-filter: blur(20px); background: rgba(15, 23, 42, 0.6);
--glass-border: 1px solid rgba(255, 255, 255, 0.08);
--glass-hover-border: 1px solid rgba(6, 182, 212, 0.3);
```

---

## 2. Tipografia "Statement Typography"

### Font Stack
```css
--font-display: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Escalas
| Elemento | Tamanho | Peso | Letter Spacing |
|----------|---------|------|----------------|
| Hero H1 | 72-96px | 700 | -0.02em |
| Section H2 | 48-56px | 600 | -0.01em |
| Card Title | 24px | 600 | 0 |
| Body | 16-18px | 400 | 0 |
| Caption | 14px | 500 | 0.02em |

---

## 3. Estrutura da Landing Page

### NAVBAR (Fixed, Glass)
```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]  Features  Pricing  About     [Login]  [Começar Grátis] │
└─────────────────────────────────────────────────────────────────┘
```
- Background: `rgba(10, 15, 26, 0.8)` + `backdrop-blur(20px)`
- Border bottom: `1px solid rgba(255,255,255,0.05)`
- Botão CTA: Gradiente cyan→violet com glow sutil

---

### HERO SECTION (Full Viewport)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              [Mesh Gradient Background - Animado]               │
│                                                                 │
│                    CONTROLE TOTAL.                              │
│                    ZERO ESFORÇO.                                │
│                                                                 │
│        Gestão inteligente de encomendas que seu                │
│              condomínio merece.                                 │
│                                                                 │
│        [Começar Grátis]    [Ver Demo ao Vivo]                  │
│                                                                 │
│     ┌───────────────────────────────────────────────┐          │
│     │                                               │          │
│     │      [DASHBOARD MOCKUP - Flutuando]          │          │
│     │           com glow cyan por trás              │          │
│     │                                               │          │
│     └───────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Headline Styling:**
- Font: 72-96px, Weight 700
- Gradiente no texto (cyan → violet)
- `text-shadow: 0 0 80px rgba(6, 182, 212, 0.3)`

**Dashboard Mockup:**
- Perspective 3D sutil (rotateX: 5deg)
- Border radius: 16px
- Box shadow: `0 25px 100px rgba(6, 182, 212, 0.2)`
- Glow animado atrás: blur 100px, pulsa suavemente

---

### SOCIAL PROOF MARQUEE

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Confiado por   [Logo1] [Logo2] [Logo3] [Logo4] [Logo5] →     │
│     (infinite scroll, grayscale, hover: color + glow)           │
└─────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Logos em grayscale 50%, opacity 0.5
- Hover: grayscale 0%, opacity 1, glow sutil
- CSS animation: `scroll 20s linear infinite`
- Fade nas bordas com gradient mask

---

### BENTO GRID - FEATURES

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Por que gestores escolhem o CondoTrack?                       │
│                                                                 │
│  ┌──────────────────────┐  ┌───────────┐  ┌───────────┐        │
│  │                      │  │           │  │           │        │
│  │   📸 FOTO AUTOMÁTICA │  │ 📊 STATS  │  │ 🔔 ALERTA │        │
│  │   Registre em 2s     │  │  Live     │  │   Push    │        │
│  │                      │  │           │  │           │        │
│  │  [Mini Preview UI]   │  │  [Gráfico]│  │ [Notif]   │        │
│  │                      │  │           │  │           │        │
│  └──────────────────────┘  └───────────┘  └───────────┘        │
│                                                                 │
│  ┌───────────┐  ┌──────────────────────────────────────┐        │
│  │           │  │                                      │        │
│  │ 💬 WHATS  │  │      🔍 BUSCA INTELIGENTE           │        │
│  │  Notifica │  │      "Apartamento 301"              │        │
│  │           │  │                                      │        │
│  │ [Chat UI] │  │   [Search Bar + Results Preview]    │        │
│  │           │  │                                      │        │
│  └───────────┘  └──────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Bento Cards Styling:**
- Background: `rgba(15, 23, 42, 0.5)`
- Border: `1px solid rgba(255, 255, 255, 0.08)`
- Border radius: 24px
- **Hover Effect:**
  - Border: `1px solid rgba(6, 182, 212, 0.4)`
  - Glow interno: `box-shadow: inset 0 0 30px rgba(6, 182, 212, 0.05)`
  - Transform: `translateY(-4px)`

**Grid Layout:**
```css
grid-template-columns: repeat(12, 1fr);
gap: 20px;

.card-large { grid-column: span 6; grid-row: span 2; }
.card-medium { grid-column: span 3; grid-row: span 1; }
.card-wide { grid-column: span 8; grid-row: span 1; }
```

---

### STATS SECTION (Números Animados)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│    │  50K+   │    │   98%   │    │  <2min  │    │  4.9★   │    │
│    │Encomendas│   │Satisfação│   │ Registro│   │App Store│    │
│    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Números: 48px, gradient text, counter animation
- Descrição: 14px, text-muted
- Dividers: linha vertical com gradient fade

---

### DEMO INTERATIVA (Video/GIF)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│         Veja em ação. Sem compromisso.                          │
│                                                                 │
│         ┌───────────────────────────────────────┐              │
│         │                                       │              │
│         │   [Video Player / GIF Loop]          │              │
│         │   Mostrando fluxo completo:          │              │
│         │   Receber → Registrar → Notificar    │              │
│         │                                       │              │
│         │           ▶ Play                      │              │
│         └───────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### PRICING CARDS (3 Tiers)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│         Planos transparentes. Sem surpresas.                    │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │    BÁSICO     │  │ PROFISSIONAL  │  │    PREMIUM    │       │
│  │               │  │  ★ POPULAR    │  │               │       │
│  │    R$49       │  │    R$99       │  │    R$199      │       │
│  │   /mês        │  │   /mês        │  │   /mês        │       │
│  │               │  │               │  │               │       │
│  │ ✓ 100 aptos   │  │ ✓ 300 aptos   │  │ ✓ Ilimitado   │       │
│  │ ✓ 2 usuários  │  │ ✓ 5 usuários  │  │ ✓ 10 usuários │       │
│  │ ✓ WhatsApp    │  │ ✓ Relatórios  │  │ ✓ API Access  │       │
│  │               │  │               │  │               │       │
│  │  [Começar]    │  │  [Começar]    │  │  [Fale Conosco│       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Popular Card (Centro):**
- Scale: 1.05
- Border: gradient cyan→violet
- Badge "POPULAR" com glow

---

### TESTIMONIALS CAROUSEL

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  "Reduziu em 80% as reclamações sobre encomendas       │   │
│  │   perdidas. O WhatsApp automático é game-changer."     │   │
│  │                                                         │   │
│  │       [Avatar] Maria Silva                              │   │
│  │       Síndica, Cond. Vila Nova - SP                     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                     ○ ● ○ ○                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### CTA FINAL (Full Width)

```
┌─────────────────────────────────────────────────────────────────┐
│  ████████████████████████████████████████████████████████████  │
│  █                                                            █ │
│  █    Pronto para transformar a portaria?                     █ │
│  █                                                            █ │
│  █              [Começar Teste Grátis]                        █ │
│  █                                                            █ │
│  █    14 dias grátis. Sem cartão. Cancele quando quiser.     █ │
│  █                                                            █ │
│  ████████████████████████████████████████████████████████████  │
└─────────────────────────────────────────────────────────────────┘
```

**Background:** Gradient mesh animado + noise texture sutil

---

### FOOTER (Minimal)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [Logo]                                                         │
│                                                                 │
│  Produto        Empresa        Legal           Contato          │
│  Features       Sobre          Termos          contato@...      │
│  Pricing        Blog           Privacidade     WhatsApp         │
│  Changelog      Carreiras      LGPD                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  © 2024 CondoTrack     [Twitter] [LinkedIn] [Instagram]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Micro-Interações & Animações

### Hover Effects
```css
/* Card Hover - Glow Border */
.bento-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.bento-card:hover {
  transform: translateY(-4px);
  border-color: rgba(6, 182, 212, 0.4);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.3),
    inset 0 0 30px rgba(6, 182, 212, 0.05);
}

/* Button Hover - Glow Expand */
.btn-primary:hover {
  box-shadow: 0 0 30px rgba(6, 182, 212, 0.4);
  transform: translateY(-2px);
}
```

### Scroll Animations
- **Fade In Up**: Elementos aparecem subindo 20px com fade
- **Stagger**: Cards do Bento Grid aparecem em sequência (delay: 100ms cada)
- **Parallax sutil**: Background mesh move mais lento que conteúdo

### Loading States
- Skeleton loaders com shimmer gradient
- Botões com spinner minimalista

---

## 5. Copywriting - Tom de Voz

### Headline Principal
❌ "A melhor solução de gestão de encomendas do mercado"
✅ "Controle total. Zero esforço."

### Subheadline
❌ "Nós oferecemos um sistema completo para gestão de encomendas"
✅ "Gestão inteligente de encomendas que seu condomínio merece."

### Features
❌ "Sistema de notificação por WhatsApp"
✅ "WhatsApp automático. Morador notificado em segundos."

### CTAs
❌ "Cadastre-se agora"
✅ "Começar Grátis" | "Ver Demo ao Vivo"

### Pricing
❌ "Entre em contato para saber mais"
✅ "Planos transparentes. Sem surpresas."

### Final CTA
❌ "Não perca essa oportunidade"
✅ "Pronto para transformar a portaria?"

---

## 6. Responsive Strategy

### Breakpoints
- **Desktop**: 1280px+ (Full Bento Grid)
- **Tablet**: 768px-1279px (Grid 2 colunas)
- **Mobile**: <768px (Stack vertical, cards full width)

### Mobile Adaptations
- Hero headline: 40-48px
- Bento Grid → Stack vertical
- Navbar → Hamburger menu glass
- Stats → 2x2 grid
- Pricing → Carousel horizontal

---

## 7. Performance Considerations

### Otimizações
- Lazy load para imagens do dashboard
- CSS containment para cards
- `will-change: transform` apenas em hover
- Intersection Observer para scroll animations
- Mesh gradients como CSS (não imagem)

### Lighthouse Targets
- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 100
