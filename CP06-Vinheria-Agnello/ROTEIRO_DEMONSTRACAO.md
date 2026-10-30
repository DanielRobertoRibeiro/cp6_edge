# Demonstração ao professor — CP06

## Preparar antes de entrar na sala

- Levar ESP32, DHT11, LDR, resistor de 10 kΩ para o divisor do LDR (mais um de 10 kΩ se o DHT11 for avulso), protoboard, jumpers, cabo USB, notebook e alimentação. Conferir a montagem e deixar o sketch carregado.
- Garantir uma rede Wi-Fi de **2,4 GHz com internet, sem portal de login**; testar que o notebook alcança o FIWARE e que o ESP32 alcança o broker. Levar alternativa de conexão se a rede da sala falhar.
- Abrir o Arduino IDE no Monitor Serial a **115200 baud** e iniciar o dashboard com `node .\dashboard\server.js`. Abrir `http://127.0.0.1:3000`.
- Deixar o ZIP final e o README acessíveis para entregar. Não incluir `config.h` com senha pessoal no arquivo enviado.
- Produzir algumas leituras reais **antes** da apresentação para que o gráfico e a tabela tenham histórico. Executar `provisionar-cp06.ps1` novamente após a primeira publicação.

## Sequência sugerida (3 a 5 minutos)

1. **Montagem:** apontar o DHT11 ligado ao GPIO 4 e o divisor LDR/10 kΩ ligado ao GPIO 34 do ESP32. Dizer que são sensores físicos, conforme o CP06.
2. **Captura e envio:** mostrar no Monitor Serial os três valores e a linha `Publicado: t|...|h|...|l|...|ts|...`. O `ts` mostra o timestamp UTC; o Wi-Fi e o MQTT transportam a leitura ao FIWARE.
3. **Dashboard:** mostrar temperatura, umidade relativa e luminosidade na página. Apontar o horário da leitura e o indicador de atualização.
4. **Mudança em tempo real:** iluminar e cobrir o LDR para alterar o valor; aguardar a próxima publicação e a atualização da página. Se possível, provocar uma pequena mudança segura no DHT11 e mostrar os outros campos.
5. **Histórico e exportação:** trocar a variável do gráfico, mostrar os registros recentes, clicar em **Exportar CSV** e abrir o arquivo. Explicar que o Orion guarda o valor atual e o STH-Comet armazena as amostras históricas.
6. **Reprodução:** abrir o README, apontar as ligações, os arquivos do firmware, os comandos do dashboard e o script de verificação. Mostrar que os identificadores CP06 são separados dos do CP05.

## Se algo não atualizar

1. Confirmar no Monitor Serial: leitura do DHT11 → Wi-Fi → NTP → MQTT → `Publicado`.
2. Executar `.\verificar-cp06.ps1 -Server '3.135.234.101'`. Se a entidade ainda não existir, conferir cadastro e tópico; se há entidade sem histórico, conferir a assinatura STH.
3. No dashboard, clicar **Atualizar** e conferir o horário da última leitura. Não apresentar dados simulados como se fossem medições físicas.
