// ==================================================================================
// SUPABASE EDGE FUNCTION: check-plan-expiry
//
// Descrição:
// Edge Function para ser executada via cron que verifica planos vencidos
// e atualiza subscription_status para 'expired' automaticamente.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - CRON_SECRET (opcional, para segurança)
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  // Tratar requisição OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ✅ Opcional: Validar secret do cron (segurança)
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret) {
      const providedSecret = req.headers.get('authorization')?.replace('Bearer ', '');
      if (providedSecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ✅ Inicializar cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[check-plan-expiry] 🔍 Verificando planos vencidos...');

    // ✅ Buscar condomínios com plan_end_date no passado e subscription_status = 'active'
    const { data: expiredCondos, error: selectError } = await supabaseAdmin
      .from('condos')
      .select('id, name, plan_end_date, subscription_status')
      .eq('subscription_status', 'active')
      .not('plan_end_date', 'is', null)
      .lt('plan_end_date', new Date().toISOString());

    if (selectError) {
      console.error('[check-plan-expiry] ❌ Erro ao buscar condomínios:', selectError);
      throw selectError;
    }

    if (!expiredCondos || expiredCondos.length === 0) {
      console.log('[check-plan-expiry] ✅ Nenhum plano vencido encontrado');
      return new Response(
        JSON.stringify({
          success: true,
          expiredCount: 0,
          message: 'Nenhum plano vencido encontrado'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`[check-plan-expiry] ⚠️ Encontrados ${expiredCondos.length} planos vencidos`);

    // ✅ Atualizar subscription_status para 'expired'
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
      console.error('[check-plan-expiry] ❌ Erro ao atualizar condomínios:', updateError);
      throw updateError;
    }

    console.log(`[check-plan-expiry] ✅ ${updatedCondos?.length || 0} condomínios atualizados para 'expired'`);

    return new Response(
      JSON.stringify({
        success: true,
        expiredCount: updatedCondos?.length || 0,
        condos: updatedCondos,
        message: `Atualizados ${updatedCondos?.length || 0} condomínios para 'expired'`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na Edge Function check-plan-expiry:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro interno do servidor',
        details: error?.details || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error?.status || 500,
      }
    );
  }
});
