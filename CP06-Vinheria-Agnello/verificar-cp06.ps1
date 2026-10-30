# Consulta somente leitura. Executar na rede que alcança o servidor FIWARE.
param([Parameter(Mandatory = $true)][string]$Server)
$ErrorActionPreference = 'Stop'
$headers = @{ 'Fiware-Service'='vinheria571746cp06'; 'Fiware-ServicePath'='/' }
$entity = [uri]::EscapeDataString('urn:ngsi-ld:Device:vinheria-cp06-571746')
Write-Host 'Orion:'
Invoke-RestMethod -Uri "http://${Server}:1026/version" -TimeoutSec 8 | ConvertTo-Json -Depth 5
Write-Host 'Dispositivo no IoT Agent:'
Invoke-RestMethod -Uri "http://${Server}:4041/iot/devices/esp32cp06_571746" -Headers $headers -TimeoutSec 8 | ConvertTo-Json -Depth 6
Write-Host 'Leitura atual no Orion:'
Invoke-RestMethod -Uri "http://${Server}:1026/v2/entities/${entity}" -Headers $headers -TimeoutSec 8 | ConvertTo-Json -Depth 8
Write-Host 'Histórico de temperatura no STH-Comet:'
Invoke-RestMethod -Uri "http://${Server}:8666/STH/v2/entities/${entity}/attrs/temperature?type=Device&lastN=3" -Headers $headers -TimeoutSec 8 | ConvertTo-Json -Depth 8
