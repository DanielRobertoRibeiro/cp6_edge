# Checkpoint 06 — Vinheria Agnello

**Equipe:** Daniel Roberto (RM 571746), Jecky Cossio (RM 572226) e Felipe Pedrol (RM 569631).

## O que este projeto entrega

Um ESP32 **físico** lê temperatura e umidade com DHT11 e luminosidade com LDR. Envia uma amostra com timestamp UTC a cada 10 segundos por Wi-Fi e MQTT ao IoT Agent do FIWARE. O Orion expõe o valor atual pela API NGSIv2; uma assinatura envia as mudanças ao STH-Comet, que mantém o histórico. Um dashboard próprio, escrito em **HTML, CSS e JavaScript**, lê essas APIs por meio de um pequeno servidor Node.js, mostra valores e gráfico histórico e exporta CSV. O enunciado do CP06 permite JavaScript como tecnologia do dashboard.

```text
DHT11 + LDR → ESP32 físico → Wi-Fi → MQTT broker → IoT Agent → Orion NGSIv2
                                                        └→ STH-Comet (histórico)
                                         Dashboard Node.js ←┘
                                         HTML/CSS/JS no navegador
```

**Estado da entrega (29/10/2026):** código, dashboard, documentação e scripts estão preparados. Orion, IoT Agent e STH-Comet responderam HTTP 200, e a porta MQTT 1883 aceitou conexão TCP. O serviço, dispositivo e assinatura histórica exclusivos do CP06 foram cadastrados e conferidos no servidor da turma. A entidade ainda não existe porque o ESP32 físico ainda não publicou a primeira leitura. A montagem, a configuração do Wi-Fi e a demonstração com dados reais dependem da equipe. A execução ponta a ponta ainda não foi validada. O CP05 original não foi modificado.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `firmware/cp06_vinheria/cp06_vinheria.ino` | Sketch do ESP32 físico com DHT11, LDR, Wi-Fi, NTP e MQTT. A pasta e o arquivo principal têm o mesmo nome para abrir diretamente no Arduino IDE. |
| `firmware/cp06_vinheria/config.example.h` | Modelo da configuração de rede e broker; copiar para `config.h` na mesma pasta. O sketch compila com este modelo se `config.h` ainda não existir, mas só se conectará após preencher uma rede válida. |
| `firmware/cp06_vinheria/libraries.txt` | Bibliotecas Arduino `PubSubClient` e `DHT sensor library for ESPx`. |
| `provisionar-cp06.ps1` | Cria/verifica serviço, dispositivo e assinatura CP06 em FIWARE **já instalado**. |
| `verificar-cp06.ps1` | Consulta de leitura ao Orion, IoT Agent e STH-Comet. |
| `dashboard/server.js` | Servidor JavaScript que consulta FIWARE e serve o dashboard. |
| `dashboard/public/` | Interface HTML, CSS e JavaScript. |
| `dashboard/config.json` | Configuração pública já preenchida para o servidor e a entidade CP06 da turma. |
| `dashboard/config.example.json` | Modelo para replicar em outro servidor. |
| `TUTORIAL_MONTAGEM_FISICA.md` | Montagem física detalhada, configuração e testes por etapa. |
| `GUIA_OPERACAO_PRESENCIAL.md` | Sequência curta para montagem, teste e apresentação. |
| `ROTEIRO_DEMONSTRACAO.md` | Ordem de telas e ações para mostrar ao professor. |

O dashboard usa apenas os módulos internos do Node.js. Não há `npm install`, banco local nem serviço de nuvem adicional. **O histórico é armazenado pelo STH-Comet**, não pelo navegador. Para replicar em outro servidor, é preciso dispor de broker MQTT, IoT Agent UltraLight, Orion e STH-Comet configurados.

## Identificadores CP06

Estes identificadores são diferentes dos do CP05 para preservar o projeto anterior.

| Campo | Valor |
| --- | --- |
| `Fiware-Service` | `vinheria571746cp06` |
| `Fiware-ServicePath` | `/` |
| Chave UltraLight (identificador, não senha) | `cp06vinheria571746` |
| Device ID | `esp32cp06_571746` |
| Entidade NGSIv2 | `urn:ngsi-ld:Device:vinheria-cp06-571746` |
| Client ID MQTT | `vinheria-cp06-esp32-571746` |
| Tópico MQTT | `/ul/cp06vinheria571746/esp32cp06_571746/attrs` |

Payload: `t|13.0|h|70.0|l|100.0|ts|2026-10-30T12:00:00Z`. O IoT Agent mapeia os campos para `temperature`, `relativeHumidity`, `illuminance` e `dateObserved`. A entidade recebe `controlledProperty` e `deviceCategory` do Smart Data Model `Device`. `dateObserved` é a hora medida pelo ESP32; `recvTime` do STH é a hora em que a mudança foi recebida. As duas podem diferir.

## 1. Montagem física

Use ESP32 DevKit, DHT11, LDR, **um resistor de 10 kΩ para o LDR** (e **outro de 10 kΩ se o DHT11 for avulso de 4 pinos**), protoboard, jumpers e cabo USB. Conecte **GND comum**:

| Peça | Ligação |
| --- | --- |
| DHT11 | VCC → 3V3; GND → GND; DATA → GPIO 4. Se for sensor sem módulo, use pull-up de 10 kΩ entre DATA e 3V3. |
| LDR e resistor | 3V3 → LDR → nó de leitura → resistor de 10 kΩ → GND. Nó de leitura → GPIO 34. |

GPIO 34 é entrada ADC1 e pode ser lida enquanto o Wi-Fi está ativo. **Não aplique 5 V ao GPIO 34.** O firmware usa a leitura calibrada em milivolts do ADC, com atenuação de 11 dB. A conversão do LDR para lux é estimada com `RL10=50 kΩ` e `gamma=0,7`; ajuste esses parâmetros no firmware após comparar com as características do componente físico. Se usar um módulo LDR pronto, confirme o circuito e a polaridade da saída analógica antes de aplicar a fórmula. A demonstração pode mostrar a variação de luz mesmo antes de uma calibração absoluta, mas não deve apresentar o lux como medição certificada.

## 2. Preparar FIWARE

Confirme com o professor que o servidor `3.135.234.101` continua autorizado para o CP06 e que as portas 1883, 4041, 1026 e 8666 estão disponíveis a partir da rede da apresentação. Todas responderam na sessão de preparação, mas a disponibilidade pode mudar. O script a seguir **altera somente o namespace CP06** em uma instalação FIWARE existente:

```powershell
.\provisionar-cp06.ps1 -Server '3.135.234.101'
```

O cadastro inicial no servidor da turma **já foi executado** em 29/10 e a repetição é segura. Após a primeira leitura do ESP32, execute novamente para acrescentar os atributos do Smart Data Model à entidade que o IoT Agent criou. Se a instalação própria tiver outros nomes internos, informe `-OrionInternalUrl` e `-SthNotifyUrl`; os padrões são `http://orion:1026` e `http://sth-comet:8666/notify` da configuração anterior. O script não instala serviços, VM ou Docker. Não execute o script do CP05.

## 3. Programar e iniciar o ESP32

1. Instale o suporte **ESP32** no Arduino IDE e as bibliotecas indicadas em `firmware/cp06_vinheria/libraries.txt`.
2. Copie `firmware/cp06_vinheria/config.example.h` para `firmware/cp06_vinheria/config.h`. Preencha SSID e senha da rede Wi-Fi de 2,4 GHz que tenha acesso à internet e confirme `MQTT_HOST`. O exemplo permite verificar a compilação antes disso, mas não estabelece conexão. Não compartilhe `config.h` com senha pessoal.
3. Abra `firmware/cp06_vinheria/cp06_vinheria.ino`, selecione a placa e a porta serial e faça o upload.
4. Abra o Monitor Serial em **115200 baud**. Observe leitura do DHT11, valor aproximado do LDR, conexão Wi-Fi/MQTT e `Publicado: t|...|h|...|l|...|ts|...`.

O firmware aguarda a sincronização NTP antes de publicar, para que toda mensagem tenha `ts`. Se o DHT11 falhar, confira alimentação, DATA e pull-up. Se a rede só funcionar por portal cativo, escolha outra rede; o ESP32 não faz login no portal. Mantenha somente um dispositivo com o Client ID acima conectado.

## 4. Rodar o dashboard

Instale Node.js **18 ou superior** no computador da demonstração. O computador precisa alcançar as portas HTTP 1026 e 8666 do FIWARE. O arquivo `dashboard/config.json` já contém o IP, o serviço e a entidade CP06 da turma; ajuste-o somente se usar outro servidor. No PowerShell, na pasta raiz do projeto:

```powershell
node .\dashboard\server.js
```

Abra `http://127.0.0.1:3000`. A página atualiza a cada 15 segundos. A interface informa quando a leitura tem mais de 2 minutos ou quando uma API está indisponível. O servidor Node.js faz as consultas ao FIWARE, o que evita depender de CORS no navegador. Ele escuta apenas em `127.0.0.1`; não é necessário publicar o dashboard na internet para a apresentação presencial.

O gráfico busca até **300 amostras por variável** dentro do período escolhido. A exportação CSV consulta páginas do STH-Comet e inclui até **10.000 amostras por variável**; um histórico maior exige ampliar o limite ou fazer uma exportação paginada adicional. O arquivo é em formato longo: `timestamp_utc,atributo,valor`. A data é o horário de recebimento do histórico. Ao selecionar 7 ou 30 dias, resultados vazios significam que não há dados naquele intervalo ou que o STH ainda não os armazenou; o dashboard não cria dados fictícios.

## 5. Verificar o fluxo completo

Depois da primeira publicação, execute:

```powershell
.\verificar-cp06.ps1 -Server '3.135.234.101'
```

Confirme `temperature`, `relativeHumidity`, `illuminance` e `dateObserved` no Orion, amostras `recvTime`/`attrValue` no STH e os três números no dashboard. Alterar luz sobre o LDR deve mudar a luminosidade; uma variação segura de temperatura/umidade deve aparecer após nova leitura do DHT11. Clique em **Exportar CSV** e abra o arquivo para comprovar a recuperação do histórico.

## Demonstração e entrega

Mostre na mesa o ESP32 com DHT11 e LDR ligados; no Monitor Serial, uma publicação real com timestamp; no dashboard, os três valores, o gráfico histórico e a exportação CSV. O roteiro de telas está em `ROTEIRO_DEMONSTRACAO.md`. Inclua este README e todos os arquivos listados no ZIP final, exceto `config.h` se contiver senha. O CP06 vale 4 pontos de documentação e 6 de demonstração prática. A atividade foi indicada para **30/10/2026**; confirme horário e turma na plataforma da disciplina.
