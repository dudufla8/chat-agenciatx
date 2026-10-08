# Script para empacotar o projeto pronto para envio ao servidor
$filesToZip = Get-ChildItem -Path . -Exclude "node_modules", ".next", "*.zip", "build-deploy-package.ps1"
Compress-Archive -Path $filesToZip -DestinationPath "chat-agenciatx.zip" -Force
Write-Host "✅ Pacote 'chat-agenciatx.zip' gerado com sucesso!" -ForegroundColor Green
Get-Item "chat-agenciatx.zip" | Select-Object Name, Length
