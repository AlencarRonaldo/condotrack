import React, { useState } from 'react';
import { supabase } from './lib/supabase'; // Importe seu cliente Supabase

// Componente simples para exibir o QR Code do PIX
const PixQRCode = ({ qrCodeData }) => {
  // A string do Asaas é o "payload", precisa ser renderizada como QR code.
  // A forma mais fácil é usar uma biblioteca como 'qrcode.react'.
  // Ex: import QRCode from 'qrcode.react';
  // <QRCode value={qrCodeData} size={256} />
  
  // Para este exemplo, apenas exibiremos o código e um link para cópia.
  return (
    <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
      <h4>Pague com PIX</h4>
      <p>Copie o código abaixo ou escaneie o QR Code no seu app de banco:</p>
      <pre style={{ background: '#f4f4f4', padding: '10px', wordBreak: 'break-all' }}>
        {qrCodeData}
      </pre>
      <button onClick={() => navigator.clipboard.writeText(qrCodeData)}>
        Copiar Código PIX
      </button>
      <p style={{marginTop: '10px', fontSize: '0.9em'}}>Após o pagamento, a página será atualizada automaticamente.</p>
    </div>
  );
};


const PaymentComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pixData, setPixData] = useState(null);

  const handlePayment = async (billingType) => {
    setLoading(true);
    setError(null);
    setPixData(null);

    try {
      // Chamar a Edge Function
      const { data, error: funcError } = await supabase.functions.invoke('create-payment', {
        body: {
          planId: 'basic', // Exemplo: poderia vir de um seletor de planos
          billingType: billingType,
        },
      });

      if (funcError) {
        throw new Error(`Erro na função: ${funcError.message}`);
      }
      
      if(data.error){
        // Erro de negócio retornado pela função
        throw new Error(data.error);
      }

      // Tratar a resposta
      if (billingType === 'PIX' && data.pixQrCode) {
        setPixData(data.pixQrCode);
      } else if (data.paymentLink) {
        // Redirecionar para a página de pagamento do Asaas para Boleto ou Cartão
        window.location.href = data.paymentLink;
      } else {
        throw new Error('Resposta inesperada da função de pagamento.');
      }

    } catch (err) {
      console.error('Erro ao processar pagamento:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (pixData) {
    return <PixQRCode qrCodeData={pixData} />;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h3>Escolha a forma de pagamento</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button onClick={() => handlePayment('PIX')} disabled={loading}>
          {loading ? 'Gerando...' : 'Pagar com PIX'}
        </button>
        <button onClick={() => handlePayment('BOLETO')} disabled={loading}>
          {loading ? 'Gerando...' : 'Pagar com Boleto'}
        </button>
        <button onClick={() => handlePayment('CREDIT_CARD')} disabled={loading}>
          {loading ? 'Gerando...' : 'Pagar com Cartão de Crédito'}
        </button>
      </div>

      {error && <p style={{ color: 'red', marginTop: '15px' }}>Erro: {error}</p>}
    </div>
  );
};

export default PaymentComponent;
