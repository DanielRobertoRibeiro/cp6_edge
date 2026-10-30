#include <WiFi.h>
#include <PubSubClient.h>
#include <DHTesp.h>
#include <time.h>
#include <math.h>
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

// CP06 usa identificadores distintos do CP05.
const char* MQTT_CLIENT_ID = "vinheria-cp06-esp32-571746";
const char* TELEMETRY_TOPIC = "/ul/cp06vinheria571746/esp32cp06_571746/attrs";

const int DHT_PIN = 4;
const int LDR_PIN = 34;
const unsigned long PUBLISH_INTERVAL_MS = 10000;
const float SUPPLY_V = 3.3f;
const float FIXED_RESISTOR_OHM = 10000.0f;

// Valores iniciais de referência. Calibre para o LDR físico utilizado.
const float LDR_RL10_OHM = 50000.0f;
const float LDR_GAMMA = 0.7f;

DHTesp dht;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastPublish = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
bool ntpStarted = false;

String utcTimestamp() {
  struct tm now;
  if (!getLocalTime(&now, 1000) || now.tm_year + 1900 < 2025) return "";
  char text[25];
  strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &now);
  return String(text);
}

float readApproxLux() {
  // Divisor: 3V3 -> LDR -> GPIO34 -> resistor 10 kOhm -> GND.
  // A tensão sobe quando há mais luz. A fórmula depende dos parâmetros reais do LDR.
  float voltage = analogReadMilliVolts(LDR_PIN) / 1000.0f;
  voltage = constrain(voltage, 0.01f, SUPPLY_V - 0.01f);
  float ldrOhm = FIXED_RESISTOR_OHM * (SUPPLY_V / voltage - 1.0f);
  float lux = powf(LDR_RL10_OHM * powf(10.0f, LDR_GAMMA) / ldrOhm, 1.0f / LDR_GAMMA);
  return isfinite(lux) ? constrain(lux, 0.0f, 100000.0f) : 0.0f;
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (lastWifiAttempt && millis() - lastWifiAttempt < 10000) return;
  lastWifiAttempt = millis();
  Serial.println("Conectando ao Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void ensureMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  if (lastMqttAttempt && millis() - lastMqttAttempt < 3000) return;
  lastMqttAttempt = millis();
  if (mqtt.connect(MQTT_CLIENT_ID)) Serial.println("MQTT conectado");
  else Serial.printf("MQTT indisponivel; estado=%d\n", mqtt.state());
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(LDR_PIN, INPUT);
  analogSetPinAttenuation(LDR_PIN, ADC_11db);
  dht.setup(DHT_PIN, DHTesp::DHT11);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(256);
  ensureWiFi();
}

void loop() {
  ensureWiFi();
  if (WiFi.status() == WL_CONNECTED && !ntpStarted) {
    Serial.print("Wi-Fi conectado: "); Serial.println(WiFi.localIP());
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    ntpStarted = true;
  }
  ensureMqtt();
  if (mqtt.connected()) mqtt.loop();

  if (millis() - lastPublish < PUBLISH_INTERVAL_MS) return;
  lastPublish = millis();
  TempAndHumidity reading = dht.getTempAndHumidity();
  if (isnan(reading.temperature) || isnan(reading.humidity)) {
    Serial.println("Falha na leitura do DHT11; confira alimentação, pino e pull-up");
    return;
  }
  float lux = readApproxLux();
  Serial.printf("DHT11 %.1f C | %.1f %% | LDR %.1f lux aprox.\n", reading.temperature, reading.humidity, lux);
  if (!mqtt.connected()) { Serial.println("Aguardando MQTT"); return; }
  String timestamp = utcTimestamp();
  if (timestamp.isEmpty()) { Serial.println("Aguardando sincronizacao NTP"); return; }

  String payload = "t|" + String(reading.temperature, 1)
                 + "|h|" + String(reading.humidity, 1)
                 + "|l|" + String(lux, 1)
                 + "|ts|" + timestamp;
  if (mqtt.publish(TELEMETRY_TOPIC, payload.c_str()))
    Serial.println("Publicado: " + payload);
  else Serial.println("Falha ao publicar MQTT");
}
