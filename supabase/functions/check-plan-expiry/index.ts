// ==================================================================================
// SUPABASE EDGE FUNCTION: check-plan-expiry
//
// Cron job que verifica planos vencidos e atualiza subscription_status.
// Segurança: CRON_SECRET obrigatório.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - CRON_SECRET (obrigatório)
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Sem CORS para cron job (não chamado pelo browser)
  const headers = { 'Content-Type': 'application/json' };

  try {
    // 1. CRON_SECRET é obrigatório
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      console.error('[check-plan-expiry] CRON_SECRET não configurado');
      return new Response(
        JSON.stringify({ error: 'CRON_SECRET not configured' }),
        { status: 500, headers }
      );
    }

    const providedSecret = req.headers.get('authorization')?.replace('Bearer ', '');
    if (providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    // 2. Inicializar cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[check-plan-expiry] Verificando planos vencidos...');

    // 3. Buscar condomínios com plano vencido
    const { data: expiredCondos, error: selectError } = await supabaseAdmin
      .from('condos')
      .select('id, name, plan_end_date, subscription_status')
      .eq('subscription_status', 'active')
      .not('plan_end_date', 'is', null)
      .lt('plan_end_date', new Date().toISOString());

    if (selectError) {
      console.error('[check-plan-expiry] Erro ao buscar:', selectError.message);
      throw selectError;
    }

    if (!expiredCondos || expiredCondos.length === 0) {
      console.log('[check-plan-expiry] Nenhum plano vencido');
      return new Response(
        JSON.stringify({ success: true, expiredCount: 0 }),
        { headers, status: 200 }
      );
    }

    console.log(`[check-plan-expiry] ${expiredCondos.length} planos vencidos`);

    // 4. Atualizar para expired
    const condoIds = expiredCondos.map(c => c.id);
    const { data: updatedCondos, error: updateError } = await supabaseAdmin
      .from('condos')
      .update({
        subscription_status: 'expired',
        updated_at: new Date().toISOString()
      })
      .in('id', condoIds)
      .select('id, name');

    if (updateError) {
      console.error('[check-plan-expiry] Erro ao atualizar:', updateError.message);
      throw updateError;
    }

    const count = updatedCondos?.length || 0;
    console.log(`[check-plan-expiry] ${count} condomínios atualizados para 'expired'`);

    return new Response(
      JSON.stringify({ success: true, expiredCount: count }),
      { headers, status: 200 }
    );

  } catch (error: any) {
    console.error('[check-plan-expiry] Erro:', error?.message || error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
