#include <WiFi.h>
#include <PubSubClient.h>
#include <DHTesp.h>
#include <time.h>
#include <math.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const char* MQTT_HOST = "3.135.234.101";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "vinheria-cp06-esp32-571746";
const char* TELEMETRY_TOPIC = "/ul/cp06vinheria571746/esp32cp06_571746/attrs";
const int DHT_PIN = 15;
const int LDR_PIN = 34;
const unsigned long PUBLISH_INTERVAL_MS = 10000;
DHTesp dht;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
WiFiClient demoWifi;
PubSubClient demo(demoWifi);
const char* DEMO_TOPIC = "cp06/wokwi/479312559519499265/telemetry";
const char* REQUEST_TOPIC = "cp06/wokwi/479312559519499265/telemetry/fiware/request";
const char* RESPONSE_TOPIC = "cp06/wokwi/479312559519499265/telemetry/fiware/response";
unsigned long lastDemoAttempt = 0;
void relayFiware(char* topic, byte* payload, unsigned int length) {
  if (String(topic) != REQUEST_TOPIC || length > 1024) return;
  JsonDocument request;
  if (deserializeJson(request, payload, length)) return;
  String id = request["id"] | "";
  if (id.length() != 16) return;
  String kind = request["kind"] | "";
  String base = "http://" + String(MQTT_HOST);
  String entity = "urn:ngsi-ld:Device:vinheria-cp06-571746";
  String url;
  if (kind == "entity") url = base + ":1026/v2/entities/" + entity;
  else if (kind == "history") {
    String attr = request["attr"] | "";
    if (attr != "temperature" && attr != "relativeHumidity" && attr != "illuminance") return;
    String from = request["from"] | "";
    if (from.length() != 24) return;
    for (unsigned int i = 0; i < from.length(); i++) {
      char c = from[i];
      if (!isDigit(c) && c != '-' && c != ':' && c != '.' && c != 'T' && c != 'Z') return;
    }
    int offset = request["offset"] | 0;
    if (offset < 0 || offset > 10000) return;
    url = base + ":8666/STH/v2/entities/" + entity + "/attrs/" + attr
        + "?type=Device&hLimit=100&hOffset=" + String(offset) + "&dateFrom=" + from;
  } else return;
  HTTPClient http;
  http.setTimeout(4000);
  http.begin(url);
  http.addHeader("Fiware-Service", "vinheria571746cp06");
  http.addHeader("Fiware-ServicePath", "/");
  int status = http.GET();
  String body = status > 0 ? http.getString() : "null";
  http.end();
  JsonDocument response;
  response["id"] = id;
  response["status"] = status;
  JsonDocument parsedBody;
  if (!deserializeJson(parsedBody, body)) response["body"] = parsedBody;
  else response["body"] = nullptr;
  String result;
  serializeJson(response, result);
  bool sent = demo.publish(RESPONSE_TOPIC, result.c_str());
  Serial.printf("FIWARE GET %s: HTTP %d | relay %s\n", kind.c_str(), status, sent ? "OK" : "falhou");
}
void ensureDemo() {
  if (WiFi.status() != WL_CONNECTED || demo.connected()) return;
  if (lastDemoAttempt && millis() - lastDemoAttempt < 5000) return;
  lastDemoAttempt = millis();
  if (demo.connect("cp06-wokwi-relay-479312559519499265")) {
    demo.subscribe(REQUEST_TOPIC);
    Serial.println("MQTT demonstracao e relay FIWARE conectados");
  }
}
unsigned long lastPublish = 0, lastWifiAttempt = 0, lastMqttAttempt = 0;
bool ntpStarted = false;
String utcTimestamp() {
  struct tm now;
  if (!getLocalTime(&now, 1000) || now.tm_year + 1900 < 2025) return "";
  char text[25];
  strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &now);
  return String(text);
}
float readApproxLux() {
  // Modulo LDR Wokwi: 3V3 -> 10 kOhm -> AO/GPIO34 -> LDR -> GND.
  float voltage = analogRead(LDR_PIN) / 4095.0f * 3.3f;
  voltage = constrain(voltage, 0.01f, 3.29f);
  float resistance = 10000.0f * voltage / (3.3f - voltage);
  float lux = powf(50000.0f * powf(10.0f, 0.7f) / resistance, 1.0f / 0.7f);
  return isfinite(lux) ? constrain(lux, 0.0f, 100000.0f) : 0.0f;
}
void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (lastWifiAttempt && millis() - lastWifiAttempt < 10000) return;
  lastWifiAttempt = millis();
  Serial.println("Conectando ao Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
}
void ensureMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  if (lastMqttAttempt && millis() - lastMqttAttempt < 30000) return;
  lastMqttAttempt = millis();
  if (mqtt.connect(MQTT_CLIENT_ID)) Serial.println("MQTT conectado");
  else Serial.printf("MQTT indisponivel; estado=%d\n", mqtt.state());
}
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(LDR_PIN, INPUT);
  dht.setup(DHT_PIN, DHTesp::DHT22);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(256);
  mqtt.setSocketTimeout(3);
  wifiClient.setConnectionTimeout(3000);
  demo.setServer("broker.hivemq.com", 1883);
  demo.setBufferSize(32768);
  demo.setSocketTimeout(3);
  demoWifi.setConnectionTimeout(3000);
  demo.setCallback(relayFiware);
  ensureWiFi();
}
void loop() {
  delay(10);
  ensureWiFi();
  if (WiFi.status() == WL_CONNECTED && !ntpStarted) {
    Serial.print("Wi-Fi conectado: "); Serial.println(WiFi.localIP());
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    ntpStarted = true;
  }
  ensureDemo();
  if (demo.connected()) demo.loop();
  ensureMqtt();
  if (mqtt.connected()) mqtt.loop();
  if (millis() - lastPublish < PUBLISH_INTERVAL_MS) return;
  lastPublish = millis();
  TempAndHumidity reading = dht.getTempAndHumidity();
  if (isnan(reading.temperature) || isnan(reading.humidity)) {
    Serial.println("Falha na leitura do DHT22"); return;
  }
  float lux = readApproxLux();
  Serial.printf("DHT22 %.1f C | %.1f %% | LDR %.1f lux aprox.\n", reading.temperature, reading.humidity, lux);
  String timestamp = utcTimestamp();
  if (timestamp.isEmpty()) { Serial.println("Aguardando sincronizacao NTP"); return; }
  String payload = "t|" + String(reading.temperature, 1) + "|h|" + String(reading.humidity, 1) + "|l|" + String(lux, 1) + "|ts|" + timestamp;
  if (mqtt.connected() && mqtt.publish(TELEMETRY_TOPIC, payload.c_str())) Serial.println("Publicado FIWARE: " + payload);
  if (demo.connected() && demo.publish(DEMO_TOPIC, payload.c_str())) Serial.println("Publicado demo: " + payload);
  delay(10);
}
