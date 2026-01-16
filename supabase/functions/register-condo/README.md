# Edge Function: register-condo

Função para registro de novos condomínios e administradores.

## Deploy

```bash
npx supabase functions deploy register-condo --project-ref SEU_PROJECT_REF
```

## Uso

Endpoint: `POST /functions/v1/register-condo`

### Request Body

```json
{
  "condoName": "Nome do Condomínio",
  "condoDocument": "00000000000191",
  "condoCep": "00000-000",
  "condoStreet": "Rua Exemplo",
  "condoNumber": "123",
  "condoComplement": "Apto 101",
  "condoNeighborhood": "Centro",
  "condoCity": "São Paulo",
  "condoState": "SP",
  "adminName": "Nome do Admin",
  "adminEmail": "admin@email.com",
  "adminPassword": "senha123",
  "planType": "basic"
}
```

### Response

```json
{
  "success": true,
  "condoId": "uuid-do-condominio",
  "username": "admin@email.com",
  "trialEndDate": "2025-01-30",
  "condoName": "Nome do Condomínio"
}
```

## Notas

- A senha é armazenada temporariamente em plain text e será migrada para hash bcrypt no primeiro login
- A função usa `service_role` para bypassar RLS
- Cria automaticamente o condomínio, admin e settings
