# Ativar o banco do AquaMonitor

O aplicativo funciona sem credenciais em **modo demonstração**, identificado na visão geral. O painel já consulta Supabase quando as duas variáveis públicas estiverem preenchidas. Não foi criado nenhum projeto remoto.

1. Crie seu projeto Supabase.
2. Execute o conteúdo de `supabase/schema.sql` no SQL Editor de um projeto novo (uma vez). O SQL cria pontos, leituras, índices, uma visão com a leitura mais recente e políticas de acesso.
3. Copie `.env.example` para `.env.local` na raiz de `Aquaonitor` e preencha:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
   ```

4. Cadastre um ponto pelo SQL Editor. Não são inseridos dados fictícios no banco automaticamente:

   ```sql
   insert into public.monitoring_points (name, location, attention_cm, critical_cm, published)
   values ('Meu ponto', 'Juazeiro do Norte, CE', 60, 100, true)
   returning id;
   ```

5. Para validar com uma leitura real ou de teste, use o UUID retornado:

   ```sql
   insert into public.water_readings (point_id, level_cm)
   values ('UUID-DO-PONTO', 25);
   ```

6. Reinicie `npm run dev` na raiz de `Aquaonitor`. Em **Configurações → Conexão de dados → Testar conexão**, confirme a consulta. Pontos publicados aparecem na visão geral; clique em um para ver o histórico.

## Comportamento

- A visão geral consulta até 200 pontos a cada 30 segundos. O histórico carrega até as 500 leituras mais recentes do período de 24 horas ou 7 dias. Não é agregação histórica completa.
- O resumo utiliza a leitura mais recente por ponto, limites cadastrados e validade de 5 minutos. Leituras ausentes ou vencidas aparecem como “Sem leitura”.
- Sem credenciais: exemplos locais. Com credenciais, erro de conexão ou tabela ausente: mensagem de falha e botão para tentar novamente, sem substituir por exemplos.
- Com banco vazio: estado vazio. O modo ESP32 continua exibindo a telemetria MQTT na visão geral e na simulação.
- Esta etapa conecta pontos e histórico da **visão geral**. Mapa, ocorrências, preferências e histórico geral continuam com os fluxos locais existentes. Autenticação e persistência de notificações não foram implementadas.

## Ingestão dos sensores

O navegador tem acesso somente de leitura a pontos publicados e suas leituras. `published` começa como `false`; publique apenas informações ambientais adequadas para acesso público. Dados pessoais não devem entrar nessas tabelas.

Um serviço confiável no backend deverá consumir MQTT, validar o dispositivo e gravar em `water_readings`. A telemetria MQTT atual não é gravada automaticamente pelo navegador. Configure a chave secreta exclusivamente nesse futuro backend, nunca em `VITE_*`.

A visão `monitoring_overview` usa `security_invoker` e respeita RLS. Escritas para `anon` e `authenticated` não são permitidas. Referência: [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Validação após criar o banco

- Verifique que um ponto não publicado fica invisível ao cliente público.
- Publique o ponto e confirme que só suas leituras aparecem.
- Tente uma escrita com a chave pública: deve falhar.
- Deixe uma leitura vencer e confirme “Sem leitura” após a atualização do painel.
- Teste a conexão com uma chave incorreta e confirme a mensagem de falha.
