# Cria apenas os recursos CP06 em uma instalação FIWARE existente.
# Não executa instalação do broker, Orion, IoT Agent ou STH-Comet.
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$OrionInternalUrl = 'http://orion:1026',
  [string]$SthNotifyUrl = 'http://sth-comet:8666/notify'
)

$ErrorActionPreference = 'Stop'
$service = 'vinheria571746cp06'
$apiKey = 'cp06vinheria571746'
$deviceId = 'esp32cp06_571746'
$entityId = 'urn:ngsi-ld:Device:vinheria-cp06-571746'
$headers = @{ 'Fiware-Service' = $service; 'Fiware-ServicePath' = '/' }
$iotAgent = "http://${Server}:4041"
$orion = "http://${Server}:1026"

Invoke-RestMethod -Uri "${orion}/version" -TimeoutSec 8 | Out-Null
Invoke-RestMethod -Uri "${iotAgent}/iot/about" -TimeoutSec 8 | Out-Null

$group = Invoke-RestMethod -Uri "${iotAgent}/iot/services?apikey=${apiKey}&resource=%2Fiot%2Fd" -Headers $headers
if ($group.count -eq 0) {
  $body = @{ services = @(@{
    apikey = $apiKey; cbroker = $OrionInternalUrl; entity_type = 'Device'; resource = '/iot/d'
  }) } | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Method Post -Uri "${iotAgent}/iot/services" -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
  Write-Host 'Grupo CP06 criado.'
} else { Write-Host 'Grupo CP06 existente.' }

$deviceExists = $true
try { Invoke-RestMethod -Uri "${iotAgent}/iot/devices/${deviceId}" -Headers $headers | Out-Null }
catch {
  if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) { throw }
  $deviceExists = $false
}
if (-not $deviceExists) {
  $body = @{ devices = @(@{
    device_id = $deviceId
    entity_name = $entityId
    entity_type = 'Device'
    apikey = $apiKey
    protocol = 'PDI-IoTA-UltraLight'
    transport = 'MQTT'
    attributes = @(
      @{ object_id='t'; name='temperature'; type='Number' },
      @{ object_id='h'; name='relativeHumidity'; type='Number' },
      @{ object_id='l'; name='illuminance'; type='Number' },
      @{ object_id='ts'; name='dateObserved'; type='DateTime' }
    )
  }) } | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Method Post -Uri "${iotAgent}/iot/devices" -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
  Write-Host 'Dispositivo CP06 criado.'
} else { Write-Host 'Dispositivo CP06 existente.' }

$encodedId = [uri]::EscapeDataString($entityId)
$entityUri = "${orion}/v2/entities/${encodedId}"
$entity = $null
try { $entity = Invoke-RestMethod -Uri $entityUri -Headers $headers }
catch {
  if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404) { throw }
  Write-Warning 'A entidade ainda não existe. Publique a primeira leitura pelo ESP32 e execute este script novamente.'
}
if ($entity) {
  $modelAttrs = @{}
  if (-not $entity.PSObject.Properties['controlledProperty']) {
    $modelAttrs.controlledProperty = @{ type='StructuredValue'; value=@('temperature','relativeHumidity','illuminance') }
  }
  if (-not $entity.PSObject.Properties['deviceCategory']) {
    $modelAttrs.deviceCategory = @{ type='StructuredValue'; value=@('sensor') }
  }
  if ($modelAttrs.Count) {
    $body = $modelAttrs | ConvertTo-Json -Depth 8
    Invoke-RestMethod -Method Post -Uri "${entityUri}/attrs" -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
    Write-Host 'Atributos do Smart Data Model Device acrescentados.'
  }
}

$subscriptions = @(Invoke-RestMethod -Uri "${orion}/v2/subscriptions" -Headers $headers)
$existing = $subscriptions | Where-Object { $_.description -eq 'CP06 Vinheria 571746 historical readings' }
if (-not $existing) {
  $body = @{
    description = 'CP06 Vinheria 571746 historical readings'
    subject = @{
      entities = @(@{ id=$entityId; type='Device' })
      condition = @{ attrs=@('temperature','relativeHumidity','illuminance','dateObserved') }
    }
    notification = @{
      http = @{ url=$SthNotifyUrl }
      attrs = @('temperature','relativeHumidity','illuminance','dateObserved')
      attrsFormat = 'legacy'
    }
  } | ConvertTo-Json -Depth 10
  Invoke-RestMethod -Method Post -Uri "${orion}/v2/subscriptions" -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
  Write-Host 'Assinatura histórica CP06 criada.'
} else { Write-Host 'Assinatura histórica CP06 existente.' }

Write-Host 'Provisionamento CP06 verificado; CP05 não foi alterado.'
