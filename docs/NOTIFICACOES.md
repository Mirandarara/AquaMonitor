# Notificações da estação

O dashboard mostra notificações na interface para eventos confirmados: nível em atenção (≥18 cm), crítico (≥26 cm), retorno à faixa normal (<18 cm), acionamento/desligamento da drenagem e do circuito de reúso, alarmes e normalização, perda e retorno da telemetria.

No ESP32/Wokwi, os eventos usam somente o JSON validado do serviço MQTT compartilhado. Alterar uma entrada virtual não cria um aviso de bomba: o aviso só aparece quando a telemetria confirma o novo estado. Nenhum outro cliente MQTT foi criado. Ausência de telemetria não é interpretada como desligamento de bomba. Na primeira leitura ou após recuperação, uma bomba já ligada é descrita como “em operação”, sem inventar quando foi acionada.

Os avisos são gerados por mudanças de faixa/estado; pacotes repetidos não repetem a mesma notificação. Alarmes usam o código enviado pelo ESP32. A simulação offline também produz eventos, identificados como “Simulação local”. Mudar de fonte não transforma um estado local em uma suposta mudança física.

## Interface

- Sino no desktop e no cabeçalho móvel, com número de notificações não lidas.
- Avisos temporários na tela, por até 8 segundos; fechar um aviso não apaga seu histórico.
- Central com horário, origem, prioridade e opção de marcar uma ou todas como lidas. Escape fecha a central.
- Os cinco eventos mais recentes aparecem em “Alertas recentes” no dashboard.
- A página Alertas apresenta o histórico, com filtros Todas / Não lidas. No modo local, os cenários urbanos anteriores continuam identificados como dados de demonstração.
- Histórico de até 100 eventos em memória, preservado ao navegar entre páginas e reiniciado ao recarregar. Não há gravação de credenciais ou telemetria no armazenamento do navegador. As notificações são da interface aberta; não há push para celular ou aviso do sistema com a aplicação fechada.

## Testar

1. Conecte o dashboard ao ESP32/Wokwi e aguarde telemetria recente.
2. Ative entradas virtuais. Solicite 22 cm: confira avisos de atenção e drenagem acionada somente após a confirmação do ESP32.
3. Solicite 28 cm: confira aviso crítico, sem repetir a cada pacote.
4. Solicite 12 cm: confira nível normalizado e drenagem desligada. Teste a solicitação de reúso com a boia de vazio desativada.
5. Desmarque Sensor operacional e confirme o alarme. Restaure o sensor e confira normalização.
6. Abra o sino, marque todas como lidas e confira contador zero, sem apagar o histórico. Navegue até Alertas e filtre Não lidas.
7. Interrompa o Wokwi: após 15 segundos sem telemetria válida deve surgir o aviso de indisponibilidade, sem afirmar que uma bomba desligou. Reinicie para observar recuperação.
8. Volte ao sensor ao terminar. Para testar offline, escolha simulação local e use tempestade/proteções na página Simulação.

`npm run build`, `npm run lint` e `npm test` validam a aplicação. A suíte `tests/notifications.test.mjs` verifica transições de nível, bombas, alarmes, ausência de repetição, perda de dados, troca de fonte, leitura, descarte do aviso temporário, limite de histórico e limpeza da assinatura.

Nesta implementação foram conferidos no navegador com Wokwi real os avisos de atenção a 22 cm, nível crítico a 28 cm, bomba ligada/desligada, falha de sensor, normalização e contador de não lidas. O caso de indisponibilidade também é coberto por teste automatizado.

## Arquivos

- Novos: `src/features/notifications/notificationStore.ts`, `useNotifications.ts`, `Notifications.tsx`, `notifications.css` e `tests/notifications.test.mjs`.
- Integração: `src/features/simulation/components/SimulationProvider.tsx`, `src/components/layout/AppShell.tsx`, `src/features/dashboard/pages/DashboardPage.tsx`, `src/features/alerts/pages/AlertsPage.tsx`.
- Documentação: este arquivo e README.md.

A funcionalidade pertence ao React e usa o estado já compartilhado com a maquete. As duas cenas Three.js e seu adaptador Dashboard foram preservados; não houve alteração do protótipo ou do firmware para gerar notificações.

## Notificações do navegador e placa física

A central oferece **Ativar notificações** para pedir permissão no navegador. Com a permissão concedida, novos eventos confirmados do ESP32 aparecem no sistema, inclusive com outra aba em foco. O Dashboard precisa continuar aberto em localhost ou HTTPS. Eventos antigos e da simulação local não são reenviados. A preferência é salva localmente; as credenciais MQTT continuam apenas em memória.

O painel de conexão na Visão geral atende ao ESP32 físico e ao Wokwi. Para configurar Wi-Fi e gravar na placa, consulte `firmware-wokwi/README.md`. Os testes `browserNotifications.test.mjs` verificam a entrega única, o descarte de histórico/local e a preservação dos alertas do Dashboard quando o navegador rejeita a entrega.
