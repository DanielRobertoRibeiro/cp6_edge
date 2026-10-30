# O que a equipe precisa operar na apresentação

1. **Antes de sair:** confirmar com o professor a autorização e o acesso ao FIWARE, carregar o ESP32 e levar protoboard, DHT11, LDR, resistor de 10 kΩ para o LDR (e outro se o DHT11 for avulso), jumpers, cabo USB, computador e rede Wi-Fi de 2,4 GHz.
2. **Montar:** DHT11 em GPIO 4 e LDR com divisor de 10 kΩ em GPIO 34, conforme o README. Conferir GND comum e alimentação 3V3.
3. **Configurar localmente:** criar `firmware/cp06_vinheria/config.h` a partir do exemplo, preencher Wi-Fi e confirmar broker. O `dashboard/config.json` já está pronto para o servidor da turma. Guardar a senha fora do ZIP.
4. **Completar o cadastro CP06:** serviço, dispositivo e assinatura já foram criados no servidor da turma em 29/10. Após a primeira publicação, executar `provisionar-cp06.ps1 -Server '3.135.234.101'` de novo para completar os atributos da entidade. Não executar o script do CP05.
5. **Mostrar dados reais:** abrir `firmware/cp06_vinheria/cp06_vinheria.ino` no Arduino IDE, carregar no ESP32, abrir o Monitor Serial a 115200, esperar Wi-Fi, NTP e MQTT; confirmar `Publicado: ... ts|...`.
6. **Abrir dashboard:** rodar `node .\dashboard\server.js`, abrir `http://127.0.0.1:3000`, conferir os três valores e selecionar histórico. Mostrar atualização após variar a luz no LDR.
7. **Comprovar armazenamento:** executar `verificar-cp06.ps1`, mostrar amostras STH e exportar o CSV no dashboard.

Se o dashboard indicar leitura antiga, confira a última publicação no Monitor Serial. Se houver publicação mas não houver entidade no Orion, confira tópico, cadastro do dispositivo e cabeçalhos FIWARE. Se houver entidade mas não houver histórico, confira a assinatura Orion → STH-Comet. A verificação real das portas depende da rede usada na apresentação.
