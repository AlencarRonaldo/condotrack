// ==================================================================================
// SUPABASE EDGE FUNCTION: ocr-label
//
// Descricao:
// Recebe uma imagem base64 de etiqueta de encomenda, envia para Google Vision API
// (TEXT_DETECTION), parseia o texto para extrair campos relevantes e opcionalmente
// cruza com moradores cadastrados no condominio.
//
// Variaveis de Ambiente Obrigatorias:
// - GOOGLE_VISION_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// --- Tipos ---
interface OcrRequest {
  imageBase64: string;  // base64-encoded image (sem prefixo data URI)
  condoId?: string;     // opcional: para cruzar com moradores
}

interface ParsedResult {
  unit: string | null;
  recipient: string | null;
  phone: string | null;
  type: string | null;
  description: string | null;
  confidence: 'high' | 'medium' | 'low';
}

// ==================================================================================
// FUNCOES DE PARSING
// ==================================================================================

function parseOcrText(text: string): ParsedResult {
  const result: ParsedResult = {
    unit: null,
    recipient: null,
    phone: null,
    type: null,
    description: null,
    confidence: 'low',
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // =====================================================================
  // 1. EXTRAIR APARTAMENTO/UNIDADE
  // Somente quando ha keyword explicita (APTO, AP, APARTAMENTO, BLOCO, SALA)
  // NAO pega numeros soltos para evitar falsos positivos com numero de rua/CEP
  // =====================================================================
  const unitPatterns = [
    // "BLOCO A APTO 101", "BL B AP 202", "BLOCO C, APTO 12"
    /(?:BLOCO?\s*\.?\s*[A-Z]?\s*[,\s]*)?(?:APTO?\.?|APT\.?|APARTAMENTO)\s*[:\-,]?\s*(\d{1,4}\s*[\-]?\s*[A-Za-z]?)\b/i,
    // "SALA 12", "SL. 12"
    /(?:SALA|SL\.?)\s*[:\-]?\s*(\d{1,4}\s*[\-]?\s*[A-Za-z]?)\b/i,
    // Dentro de endereco com virgula: ", APTO 45" ou ". APTO 45"
    /[,\.]\s*(?:APTO?\.?|APT\.?|APARTAMENTO)\s*[:\-]?\s*(\d{1,4}\s*[\-]?\s*[A-Za-z]?)\b/i,
    // Barra em endereco SOMENTE se precedida por numero de rua: "1682/45" -> apto 45
    /\b\d{1,5}\s*\/\s*(?:APTO?\.?\s*)?(\d{1,4}[A-Za-z]?)\b/i,
  ];

  for (const pattern of unitPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const unit = match[1].replace(/\s/g, '').toUpperCase();
      // Ignorar se parece CEP (5 digitos) ou numero de rua muito grande
      if (unit.length <= 5 && !/^\d{5}$/.test(unit)) {
        result.unit = unit;
        result.confidence = 'medium';
        break;
      }
    }
  }

  // =====================================================================
  // 2. EXTRAIR TELEFONE BRASILEIRO
  // =====================================================================
  const phonePattern = /\(?\d{2}\)?\s*9\d{4}[\-\s]?\d{4}/;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/\D/g, '');
  }

  // =====================================================================
  // 3. EXTRAIR DESTINATARIO (NOME DO CLIENTE)
  // Abordagem: identificar a secao do destinatario na etiqueta e extrair o nome
  // =====================================================================

  // Palavras que NUNCA fazem parte do nome do destinatario
  const noiseWords = /\b(?:AVISO\s*DE|RECEBIMENTO|SIGEP|CONTRATO|TENTATIVAS?\s*DE\s*ENTREGA|UNIDADE\s*DE\s*ENTREGA|REMETENTE|ENDERE[CÇ]O\s*PARA\s*DEVOLU[CÇ][AÃ]O|DECLARA[CÇ][AÃ]O\s*DE\s*CONTE[UÚ]DO|ASSINATURA\s*DO\s*RECEBEDOR|MOTIVO\s*DE\s*DEVOLU[CÇ][AÃ]O|RUBRICA|MATR[IÍ]CULA|CARTEIRO|DATA\s*DE\s*ENTREGA|NOME\s*LEG[IÍ]VEL|DOC\s*DE\s*IDENTIDADE|CORREIOS|SEDEX|PAC\b|PLP|VOLUME|PESO|DOCUMENTO|FRETE|NF\b|NOTA\s*FISCAL)\b/i;

  // Palavras que indicam inicio de endereco (fim do nome)
  const addressStart = /\b(?:RUA|R\.|AV\.|AVENIDA|ALAMEDA|AL\.|RODOVIA|ROD\.|TRAVESSA|TV\.|ESTRADA|EST\.|PRAC?[AÇ]|LARGO)\b/i;

  // Estrategia 1: label explicito "DESTINATÁRIO", "PARA:", "A/C", "NOME:"
  const nameLabels = [
    /(?:DESTINAT[AÁ]RIO)\s*[:\-]?\s*/i,
    /(?:ENTREGAR\s*(?:PARA|A))\s*[:\-]?\s*/i,
    /\bA\/C\s*[:\-]?\s*/i,
  ];

  for (const labelPattern of nameLabels) {
    const labelMatch = text.match(labelPattern);
    if (labelMatch && labelMatch.index !== undefined) {
      // Pegar o texto DEPOIS do label
      const afterLabel = text.substring(labelMatch.index + labelMatch[0].length).trim();
      // Pegar ate a proxima quebra de linha ou inicio de endereco
      let name = afterLabel.split(/\n/)[0].trim();
      // Cortar no inicio do endereco
      const addrMatch = name.match(addressStart);
      if (addrMatch && addrMatch.index !== undefined && addrMatch.index > 0) {
        name = name.substring(0, addrMatch.index).trim();
      }
      // Cortar em palavras de ruido
      const noiseMatch = name.match(noiseWords);
      if (noiseMatch && noiseMatch.index !== undefined && noiseMatch.index > 0) {
        name = name.substring(0, noiseMatch.index).trim();
      }
      // Limpar pontuacao final e espacos
      name = name.replace(/[:\-,\.]+$/, '').trim();
      // Validar
      if (name.length >= 3 && name.length <= 80 && !noiseWords.test(name) && !addressStart.test(name)) {
        result.recipient = titleCase(name);
        result.confidence = 'medium';
        break;
      }
    }
  }

  // Estrategia 2: buscar por posicao na etiqueta
  // Em etiquetas Correios/transportadoras, o nome do destinatario e tipicamente
  // a primeira sequencia de 2+ palavras que nao e cabecalho, endereco ou ruido
  if (!result.recipient) {
    const skipPattern = /(?:aviso\s*de|recebimento|sigep|correios|contrato|tentativa|entrega|remetente|devolu|declara|assinatura|recebedor|motivo|rubrica|carteiro|matr[ií]cula|identidade|leg[ií]vel|rua\b|av\b|avenida|alameda|rodovia|travessa|estrada|pra[cç]a|largo|ltda|s\.a\b|eireli|me\b|cnpj|cpf|cep|bairro|cidade|estado|brasil|melhor\s*envio|skyhub|plp|volume|peso|documento|frete|nota\s*fiscal|shopee|mercado\s*livre|amazon|submarino|magalu|sedex|pac\b|complemento|telefone|fone|n[uú]mero)/i;

    for (const line of lines) {
      // Limpar a linha: remover numeros e caracteres especiais
      const cleaned = line.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
      const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

      // Candidato a nome: 2 a 6 palavras, nao contem palavras de ruido
      if (words.length >= 2 && words.length <= 6 && cleaned.length >= 5 && cleaned.length <= 80) {
        if (!skipPattern.test(line) && !skipPattern.test(cleaned)) {
          result.recipient = titleCase(cleaned);
          result.confidence = 'low';
          break;
        }
      }
    }
  }

  // =====================================================================
  // 4. DETECTAR TIPO DE ENCOMENDA
  // =====================================================================
  result.type = detectPackageType(text);

  return result;
}

function detectPackageType(text: string): string | null {
  const upper = text.toUpperCase();
  if (/MERCADO\s*LIVRE|MELI\b|ML\b/.test(upper)) return 'Mercado Livre/Shopee';
  if (/SHOPEE/.test(upper)) return 'Mercado Livre/Shopee';
  if (/AMAZON/.test(upper)) return 'Caixa';
  if (/MAGALU|MAGAZINE\s*LUIZA/.test(upper)) return 'Caixa';
  if (/IFOOD|I\s*FOOD|RAPPI|UBER\s*EATS/.test(upper)) return 'Delivery / Comida';
  if (/CORREIOS|SEDEX|PAC\b/.test(upper)) return 'Pacote';
  if (/ENVELOPE|CARTA|DOCUMENT/.test(upper)) return 'Envelope';
  return null;
}

function matchResident(
  parsed: { recipient: string | null; unit: string | null },
  residents: Array<{ name: string; unit: string; phone: string }>
): { name: string; unit: string; phone: string } | null {
  // Tentar match exato por unidade
  if (parsed.unit) {
    const unitLower = parsed.unit.toLowerCase();
    const byUnit = residents.filter(r =>
      String(r.unit || '').toLowerCase() === unitLower
    );
    if (byUnit.length === 1) return byUnit[0];

    // Se multiplos moradores na mesma unidade, tentar match por nome
    if (byUnit.length > 1 && parsed.recipient) {
      const nameLower = parsed.recipient.toLowerCase();
      const nameMatch = byUnit.find(r =>
        r.name && (r.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(r.name.toLowerCase()))
      );
      if (nameMatch) return nameMatch;
      return byUnit[0];
    }
  }

  // Tentar match fuzzy por nome
  if (parsed.recipient) {
    const nameLower = parsed.recipient.toLowerCase();
    const nameMatch = residents.find(r =>
      r.name && (
        r.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(r.name.toLowerCase())
      )
    );
    if (nameMatch) return nameMatch;
  }

  return null;
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(
    /(?:^|\s)\S/g,
    match => match.toUpperCase()
  );
}

// ==================================================================================
// HANDLER PRINCIPAL
// ==================================================================================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Metodo nao permitido' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // 1. Validar apikey
    const apikey = req.headers.get('apikey') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key nao fornecida' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Parse body
    const { imageBase64, condoId }: OcrRequest = await req.json();
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 e obrigatorio' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Validar tamanho (max ~4MB base64)
    if (imageBase64.length > 4 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Imagem muito grande. Maximo 4MB.' }),
        { status: 413, headers: corsHeaders }
      );
    }

    // 4. Verificar API key do Google Vision
    const googleApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!googleApiKey) {
      console.error('[ocr-label] GOOGLE_VISION_API_KEY nao configurada');
      return new Response(
        JSON.stringify({ error: 'OCR nao configurado no servidor.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 5. Chamar Google Vision API TEXT_DETECTION
    console.log('[ocr-label] Chamando Google Vision API...');
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errBody = await visionResponse.text();
      console.error('[ocr-label] Google Vision erro:', errBody);
      return new Response(
        JSON.stringify({ error: 'Erro no servico de OCR.' }),
        { status: 502, headers: corsHeaders }
      );
    }

    const visionData = await visionResponse.json();
    const annotations = visionData.responses?.[0]?.textAnnotations;
    const rawText: string = annotations?.[0]?.description || '';

    // 6. Se nenhum texto encontrado
    if (!rawText) {
      return new Response(
        JSON.stringify({
          success: true,
          rawText: '',
          parsed: { unit: null, recipient: null, phone: null, type: null, description: null, confidence: 'low' },
          message: 'Nenhum texto encontrado na imagem.',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log('[ocr-label] Texto detectado:', rawText.substring(0, 200));

    // 7. Parsear texto OCR
    const parsed = parseOcrText(rawText);

    // 8. Cruzar com moradores cadastrados (opcional)
    if (condoId && (parsed.recipient || parsed.unit)) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: residents } = await supabaseAdmin
          .from('residents')
          .select('name, unit, phone')
          .eq('condo_id', condoId)
          .eq('is_active', true);

        if (residents && residents.length > 0) {
          const match = matchResident(parsed, residents);
          if (match) {
            parsed.unit = match.unit || parsed.unit;
            parsed.recipient = match.name || parsed.recipient;
            parsed.phone = match.phone || parsed.phone;
            parsed.confidence = 'high';
            console.log('[ocr-label] Match com morador:', match.name, match.unit);
          }
        }
      } catch (dbErr) {
        console.error('[ocr-label] Erro ao buscar moradores:', dbErr);
        // Nao falhar - retornar resultado sem match
      }
    }

    // 9. Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        rawText,
        parsed,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[ocr-label] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor.' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
