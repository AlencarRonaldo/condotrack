import React, { useState, useEffect } from 'react';
import {
  Package, ArrowRight, Check, Star, Menu, X,
  Bell, Camera, Shield, Clock, Play,
  Building2, ChevronRight, Sparkles
} from 'lucide-react';

// ============================================================================
// CONDOTRACK - LANDING PAGE V5 - CONVERSION FOCUSED
// Based on: High-converting SaaS research (Linear, Stripe, Notion patterns)
// Principles: Single CTA, Clear value prop, Social proof, Show the product
// ============================================================================

export default function LandingPage({ onNavigateToApp }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white antialiased">

      {/* ===== NAVBAR - Clean & Minimal ===== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/5' : ''
      }`}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-lg">CondoTrack</span>
            </a>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#como-funciona" className="text-sm text-zinc-400 hover:text-white transition-colors">Como funciona</a>
              <a href="#recursos" className="text-sm text-zinc-400 hover:text-white transition-colors">Recursos</a>
              <a href="#precos" className="text-sm text-zinc-400 hover:text-white transition-colors">Preços</a>
            </div>

            {/* Single CTA */}
            <div className="hidden md:block">
              <button
                onClick={onNavigateToApp}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition-colors"
              >
                Começar grátis
              </button>
            </div>

            {/* Mobile Menu */}
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0A0A0B] border-t border-white/5 px-5 py-6 space-y-4">
            <a href="#como-funciona" className="block text-zinc-300">Como funciona</a>
            <a href="#recursos" className="block text-zinc-300">Recursos</a>
            <a href="#precos" className="block text-zinc-300">Preços</a>
            <button
              onClick={onNavigateToApp}
              className="w-full py-3 rounded-lg bg-emerald-500 text-white font-medium mt-4"
            >
              Começar grátis
            </button>
          </div>
        )}
      </nav>

      {/* ===== HERO - Clear Value Proposition ===== */}
      <section className="pt-28 pb-16 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">

            {/* Trust Badge - Above headline */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>+250 condomínios em SP, RJ e MG</span>
            </div>

            {/* Headline - Pain point focused */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              Encomenda perdida é
              <span className="block text-emerald-400">problema do condomínio</span>
            </h1>

            {/* Subtitle - Transformation focused */}
            <p className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto mb-8">
              A lei diz que você responde pelo extravio. Com o CondoTrack, cada entrega tem
              <span className="text-zinc-300"> foto, notificação e assinatura digital.</span> Zero risco.
            </p>

            {/* Single CTA - Primary action */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <button
                onClick={onNavigateToApp}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 text-white font-semibold text-lg hover:bg-emerald-400 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                Testar grátis por 14 dias
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="text-sm text-zinc-500">Sem cartão • Cancele quando quiser</span>
            </div>

            {/* Social Proof - More specific */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>99,8% uptime</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>+50 mil entregas/mês</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
                <span className="ml-1">4.9 (143 avaliações)</span>
              </div>
            </div>
          </div>

          {/* Product Screenshot - Show the product */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="relative">
              {/* Subtle glow */}
              <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/20 to-transparent rounded-2xl blur-2xl opacity-50" />

              {/* Browser frame */}
              <div className="relative rounded-xl border border-white/10 overflow-hidden bg-[#111113]">
                {/* Browser header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#0D0D0F] border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-3 py-1 rounded-md bg-white/5 text-xs text-zinc-500">
                      app.condotrack.com.br
                    </div>
                  </div>
                </div>

                {/* App UI */}
                <div className="p-6 bg-gradient-to-b from-[#111113] to-[#0D0D0F]">
                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { label: 'Pendentes', value: '8', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                      { label: 'Hoje', value: '24', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { label: 'Semana', value: '156', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                      { label: 'Total', value: '2.847', color: 'text-zinc-300', bg: 'bg-white/5' }
                    ].map((stat, i) => (
                      <div key={i} className={`p-4 rounded-lg ${stat.bg} text-center`}>
                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                        <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent packages list */}
                  <div className="rounded-lg border border-white/5 overflow-hidden">
                    <div className="px-4 py-3 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
                      <span className="text-sm font-medium">Encomendas recentes</span>
                      <span className="text-xs text-emerald-400">Ver todas →</span>
                    </div>
                    {[
                      { apt: '1204', name: 'Carlos M.', time: '2 min', status: 'Pendente', color: 'bg-amber-500' },
                      { apt: '507', name: 'Ana Paula', time: '18 min', status: 'Notificado', color: 'bg-blue-500' },
                      { apt: '302', name: 'Roberto L.', time: '1h', status: 'Retirado', color: 'bg-emerald-500' }
                    ].map((item, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                            <Package className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">Apto {item.apt} • {item.name}</div>
                            <div className="text-xs text-zinc-600">{item.time} atrás</div>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${item.color} text-white`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS - Simple 3 steps ===== */}
      <section id="como-funciona" className="py-20 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">De risco jurídico a controle total</h2>
            <p className="text-zinc-400">3 passos. Seu porteiro aprende em 5 minutos.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                icon: Camera,
                title: 'Chegou, registrou',
                desc: 'Foto + apartamento. 10 segundos. Pronto. Sem preencher formulário.'
              },
              {
                step: '2',
                icon: Bell,
                title: 'Morador já sabe',
                desc: 'WhatsApp automático na hora. Ninguém precisa ligar. Ninguém é interrompido.'
              },
              {
                step: '3',
                icon: Shield,
                title: 'Retirou, comprovou',
                desc: 'Assinatura na tela. Se alguém disser "não recebi", você mostra a prova.'
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/10 to-transparent" />
                )}

                <div className="text-center">
                  <div className="relative inline-flex mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <item.icon className="w-7 h-7 text-emerald-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES - Max 4, benefit focused ===== */}
      <section id="recursos" className="py-20 px-5 bg-[#0D0D0F]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Proteção completa para seu condomínio</h2>
            <p className="text-zinc-400">Cada funcionalidade resolve um problema real que você enfrenta hoje.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                icon: Shield,
                title: 'Proteção jurídica',
                desc: 'Foto + assinatura + horário de cada entrega. Se um morador processar por extravio, você tem a prova na mão.',
                highlight: true
              },
              {
                icon: Bell,
                title: 'WhatsApp na hora',
                desc: 'Morador notificado instantaneamente. Acabaram as 15 ligações por dia da portaria. Sua equipe agradece.'
              },
              {
                icon: Clock,
                title: 'Funciona no primeiro dia',
                desc: 'Interface tão simples que porteiro novo já usa sozinho. Zero treinamento. Zero erro. Zero desculpa.'
              },
              {
                icon: Building2,
                title: 'Nada fica esquecido',
                desc: 'Encomenda parada há 3 dias? O sistema avisa. Você manda lembrete com um clique. Problema resolvido.'
              }
            ].map((feature, i) => (
              <div
                key={i}
                className={`p-6 rounded-xl border transition-all ${
                  feature.highlight
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${
                  feature.highlight ? 'bg-emerald-500/20' : 'bg-white/5'
                }`}>
                  <feature.icon className={`w-5 h-5 ${feature.highlight ? 'text-emerald-400' : 'text-zinc-400'}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF - Testimonial ===== */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <blockquote className="text-xl sm:text-2xl font-medium mb-6 leading-relaxed text-zinc-200">
            "Tínhamos 2-3 reclamações de extravio por mês. Um morador até ameaçou processar.
            <span className="text-emerald-400"> Desde o CondoTrack, zero problemas.</span> Tudo documentado, tudo rastreável."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold">
              RC
            </div>
            <div className="text-left">
              <div className="font-medium">Ricardo Costa</div>
              <div className="text-sm text-zinc-500">Síndico profissional • 3 condomínios em SP</div>
            </div>
          </div>

          {/* Second testimonial - smaller */}
          <div className="mt-10 pt-8 border-t border-white/5">
            <p className="text-zinc-400 italic mb-4">
              "O porteiro aprendeu em 10 minutos. Hoje ele registra tudo pelo celular, morador recebe na hora.
              Mudou a rotina da portaria completamente."
            </p>
            <div className="text-sm text-zinc-500">
              <span className="text-zinc-300">Ana Beatriz</span> • Administradora, Condomínio Parque das Flores
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING - Simple & Clear ===== */}
      <section id="precos" className="py-20 px-5 bg-[#0D0D0F]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Quanto custa parar de ouvir reclamação?</h2>
            <p className="text-zinc-400">Menos que um café por dia. Teste 14 dias grátis, sem cartão.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: 'Essencial',
                price: '49',
                desc: 'Condomínios até 100 unidades',
                features: ['WhatsApp automático', '2 porteiros', 'Histórico 6 meses', 'Suporte por email'],
                popular: false
              },
              {
                name: 'Profissional',
                price: '99',
                desc: 'Condomínios até 300 unidades',
                features: ['Tudo do Essencial', '5 porteiros', 'Histórico ilimitado', 'Relatórios completos', 'Suporte prioritário'],
                popular: true
              },
              {
                name: 'Empresarial',
                price: '199',
                desc: 'Sem limites',
                features: ['Tudo do Profissional', 'Porteiros ilimitados', 'API para integração', 'Suporte 24h', 'Gerente dedicado'],
                popular: false
              }
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-xl border ${
                  plan.popular
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-white/[0.02] border-white/5'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-medium">
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-sm text-zinc-500">{plan.desc}</p>
                </div>

                <div className="mb-5">
                  <span className="text-4xl font-bold">R${plan.price}</span>
                  <span className="text-zinc-500">/mês</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={onNavigateToApp}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    plan.popular
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  Testar 14 dias grátis
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA - Single focused action ===== */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Quanto custa uma encomenda perdida?
          </h2>
          <p className="text-zinc-400 mb-8">
            Processo judicial, desgaste com morador, horas de reunião.
            <span className="block text-zinc-300 mt-1">Ou R$49/mês para nunca mais se preocupar.</span>
          </p>

          <button
            onClick={onNavigateToApp}
            className="px-10 py-4 rounded-xl bg-emerald-500 text-white font-semibold text-lg hover:bg-emerald-400 transition-all hover:scale-[1.02] inline-flex items-center gap-2"
          >
            Testar grátis por 14 dias
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              Setup em 5 minutos
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              Suporte por WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* ===== FOOTER - Minimal ===== */}
      <footer className="py-10 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">CondoTrack</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Termos</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="mailto:contato@condotrack.com.br" className="hover:text-white transition-colors">Contato</a>
            </div>

            <div className="text-sm text-zinc-600">
              © 2024 CondoTrack
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
