-- ==================================================================================
-- MIGRAÇÃO: DADOS DE DOCUMENTO PARA CONDOMÍNIO DE TESTE
-- ==================================================================================
-- Adiciona CPF/CNPJ ao condomínio de teste para Asaas
-- ==================================================================================

UPDATE condos
SET
  document_type = 'CNPJ',
  document_number = '12345678000199'
WHERE id = 'condo-test-prod';