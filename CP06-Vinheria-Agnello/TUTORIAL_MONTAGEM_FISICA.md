# Tutorial de montagem física — Vinheria Agnello CP06

Este tutorial usa um **ESP32 DevKit clássico**, um **DHT11** e um **LDR avulso**. Monte com o USB desconectado. Se a placa ou o módulo tiver rótulos diferentes, confira o pinout do fabricante antes de alimentar. O CP06 pede captura **física**; a simulação do CP05 não substitui esta etapa.

## 1. Separe o material

| Quantidade | Item | Observação |
| --- | --- | --- |
| 1 | ESP32 DevKit com cabo USB de dados | Alguns cabos só carregam e não criam porta serial. |
| 1 | DHT11 de 3 pinos **ou** sensor DHT11 avulso de 4 pinos | Se for avulso, reserve um resistor extra para o pull-up. |
| 1 | LDR avulso | Recomendado para que o divisor corresponda ao firmware. |
| 1 | Resistor de **10 kΩ** para o LDR | Forma o divisor de tensão. |
| 1, se DHT11 avulso | Resistor de **10 kΩ** para DATA | Pull-up entre DATA e 3V3. |
| 1 | Protoboard e jumpers | Rails de 3V3 e GND. |
| 1 | Notebook com Arduino IDE e Node.js 18+ | Para carregar o sketch e abrir o dashboard. |
| 1 | Wi-Fi de 2,4 GHz com internet | O ESP32 precisa alcançar MQTT e NTP. Evite rede com portal cativo. |

## 2. Entenda as conexões

O sketch define **GPIO 4** para DATA do DHT11 e **GPIO 34** para o LDR. GPIO 34 pertence ao ADC1, que funciona com Wi-Fi; é entrada apenas. O circuito do LDR deve ter esta ordem exata:

```text
ESP32 3V3 ─── LDR ───●─── resistor 10 kΩ ─── ESP32 GND
                    │
                    └───────────────────────── ESP32 GPIO 34

ESP32 3V3 ─────────────────────────────────── DHT11 VCC
ESP32 GND ─────────────────────────────────── DHT11 GND
ESP32 GPIO 4 ──────────────────────────────── DHT11 DATA

Se DHT11 avulso de 4 pinos:
ESP32 3V3 ─── resistor 10 kΩ ─── DHT11 DATA
```

O LDR não tem polaridade. Com essa ordem, mais luz tende a elevar a tensão no GPIO 34. O resistor do divisor e o resistor de pull-up do DHT11 **não são o mesmo componente**.

## 3. Monte, sem energia

1. Coloque o ESP32 sobre a protoboard de modo que os pinos laterais fiquem acessíveis. Leve **3V3** ao rail positivo e **GND** ao rail negativo. Não use o pino `VIN`/`5V` para os sensores nesta montagem.
2. **DHT11 em módulo de 3 pinos:** siga os rótulos impressos `VCC`/`+`, `DATA`/`S` e `GND`/`-`. Ligue VCC a 3V3, GND a GND e DATA ao GPIO 4. A ordem dos pinos varia entre módulos; siga os rótulos, não a posição visual.
3. **DHT11 avulso de 4 pinos:** com a frente perfurada voltada para você, o arranjo usual é pino 1 VCC, pino 2 DATA, pino 3 sem conexão e pino 4 GND. Confirme no datasheet do componente que você tem. Ligue VCC a 3V3, DATA ao GPIO 4, GND a GND e um resistor de 10 kΩ entre DATA e 3V3. Deixe o pino 3 desconectado.
4. Insira o LDR. Ligue uma perna ao rail 3V3. Ligue a outra perna a uma linha livre da protoboard: esse é o **nó de leitura**.
5. Ligue o resistor de 10 kΩ entre o nó de leitura e GND. Ligue um jumper do mesmo nó ao **GPIO 34**. Assim há dois caminhos saindo do nó: resistor → GND e jumper → GPIO 34.
6. Confira que nenhum jumper de 3V3 encosta diretamente em GND. Confira também que o nó de leitura **não** está ligado a `5V`/`VIN`.

Se tiver multímetro, antes de conectar o GPIO 34, meça a tensão do nó em relação ao GND com o ESP32 alimentado por USB. Ela deve permanecer entre 0 e 3,3 V e mudar ao cobrir/iluminar o LDR. Desligue o USB antes de mudar fios.

## 4. Prepare o firmware

1. Extraia o ZIP do CP06 mantendo a estrutura das pastas. No Arduino IDE, abra `firmware/cp06_vinheria/cp06_vinheria.ino`. O arquivo principal e a pasta têm o mesmo nome.
2. Instale o suporte à sua placa ESP32 no **Boards Manager**. Para um ESP32 DevKit clássico, selecione a placa ESP32 correspondente, normalmente `ESP32 Dev Module`; confirme o modelo impresso na sua placa.
3. No **Library Manager**, instale `PubSubClient` e `DHT sensor library for ESPx`, conforme `firmware/cp06_vinheria/libraries.txt`.
4. Na mesma pasta do sketch, copie `config.example.h` para `config.h`. Preencha `WIFI_SSID` e `WIFI_PASSWORD` com a rede de 2,4 GHz. O broker do servidor da turma já consta no exemplo; confira com o professor se poderá usá-lo.
5. Selecione a porta serial que aparece ao conectar o ESP32 e clique em **Upload**. Se a gravação não iniciar, confira o cabo e a porta; algumas placas exigem pressionar **BOOT** durante o início do upload.
6. Abra o **Monitor Serial em 115200 baud**. Aguarde `Wi-Fi conectado`, `MQTT conectado` e, a cada cerca de 10 segundos, `DHT11 ... | LDR ...` seguido de `Publicado: t|...|h|...|l|...|ts|...`.

O sketch sem `config.h` usa o arquivo de exemplo para permitir a compilação, mas os valores `NOME_DA_REDE` e `SENHA_DA_REDE` não conectam. Não envie um `config.h` que contenha sua senha pessoal no ZIP da disciplina.

## 5. Teste sensores antes de olhar o dashboard

1. **DHT11:** confirme temperatura em °C e umidade em %. Se aparecer `Falha na leitura do DHT11`, confira 3V3, GND, DATA no GPIO 4 e o pull-up do sensor avulso. Aguarde o próximo ciclo antes de concluir que falhou.
2. **LDR:** cubra o componente com a mão e depois ilumine com a luz ambiente/lanterna sem aquecê-lo. O valor do LDR deve mudar. O número em lux é **estimado**, pois `RL10` e `gamma` dependem do LDR real.
3. **Wi-Fi/NTP/MQTT:** se aparecer `Aguardando MQTT` ou `Aguardando sincronizacao NTP`, confira rede, internet e porta 1883. O firmware não publica leituras sem timestamp válido.

O GPIO 34 usa leitura ADC calibrada em milivolts com atenuação de 11 dB. A faixa útil do ADC não cobre perfeitamente todos os extremos de 0 a 3,3 V; em luz muito intensa a estimativa de lux pode saturar. Para a demonstração, mostre a **variação observada** sem afirmar precisão metrológica.

## 6. Conclua o fluxo FIWARE e abra a solução

O serviço, o dispositivo e a assinatura histórica CP06 foram criados no servidor da turma em 29/10/2026. A primeira mensagem do ESP32 cria a entidade no Orion. **Depois da primeira linha `Publicado`**, abra um PowerShell na raiz do projeto e execute:

```powershell
.\provisionar-cp06.ps1 -Server '3.135.234.101'
.\verificar-cp06.ps1 -Server '3.135.234.101'
node .\dashboard\server.js
```

Abra **http://127.0.0.1:3000** no navegador do mesmo notebook. Você deve ver temperatura, umidade e luminosidade. Aguarde algumas publicações para preencher o gráfico e a tabela. Escolha uma variável no histórico, mude a luz sobre o LDR e clique em **Atualizar**. Por fim, clique em **Exportar CSV** e abra o arquivo.

O dashboard consulta o Orion para a leitura atual e o STH-Comet para o histórico. O STH permite consultar dados por intervalo e paginação; o dashboard usa até 300 amostras por variável no gráfico e até 10.000 por variável no CSV. Se o histórico estiver vazio logo após o primeiro envio, aguarde mais ciclos e confira a assinatura.

## 7. Diagnóstico rápido

| Sintoma | Primeiro ponto a verificar |
| --- | --- |
| Arduino IDE não mostra porta | Cabo USB de dados, driver da placa e outra porta USB. |
| DHT11 retorna falha | Alimentação 3V3/GND, GPIO 4, orientação do sensor e pull-up de 10 kΩ no avulso. |
| LDR não varia | Ordem do divisor e jumper no nó de leitura até GPIO 34. |
| Há leitura local mas não há `Publicado` | Wi-Fi 2,4 GHz, internet, NTP e acesso ao broker MQTT :1883. |
| Há `Publicado` mas dashboard está vazio | Rodar `verificar-cp06.ps1`; conferir identificadores CP06 e IP do servidor. |
| Orion tem valores, mas gráfico está vazio | Confirmar assinatura histórica e acesso ao STH-Comet :8666. |
| Dashboard indica leitura antiga | Observar se novas linhas `Publicado` continuam surgindo no Monitor Serial. |

## Referências para a montagem

- [Espressif: GPIO do ESP32 e restrições de ADC com Wi-Fi](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html).
- [Espressif: leitura ADC calibrada e atenuação no Arduino ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html).
- [Adafruit: pinagem do DHT avulso e resistor de pull-up](https://learn.adafruit.com/dht/connecting-to-a-dhtxx-sensor).
- [FIWARE STH-Comet: consulta paginada do histórico](https://fiware-sth-comet.readthedocs.io/en/latest/raw-data-retrieval.html).
