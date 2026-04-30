# =============================================
# FinançasPro - Script de Backup Local
# Roda: powershell -File backup.ps1
# =============================================

$SUPABASE_URL = "https://gashcjenhwamgxrrmbsa.supabase.co"
$SUPABASE_KEY = "sb_publishable_n1syzIIBeS53RL9KWwhtJQ_BML0xunY"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupDir = "$PSScriptRoot\backups"
$backupFile = "$backupDir\backup_$timestamp.json"

# Criar pasta de backups se não existe
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Prefer" = "return=representation"
}

$tables = @("categories", "accounts", "income", "expenses", "investments", "investment_transactions", "credit_cards", "credit_card_transactions", "profiles")

$backup = @{
    created_at = (Get-Date).ToString("o")
    tables = @{}
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FinancasPro - Backup Local" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($table in $tables) {
    try {
        $url = "$SUPABASE_URL/rest/v1/$($table)?select=*&limit=10000"
        $response = Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        $backup.tables[$table] = $data
        $count = if ($data -is [Array]) { $data.Count } else { if ($data) { 1 } else { 0 } }
        Write-Host "  [OK] $table : $count registros" -ForegroundColor Green
    } catch {
        Write-Host "  [!!] $table : erro ao exportar" -ForegroundColor Red
        $backup.tables[$table] = @()
    }
}

# Salvar arquivo JSON
$backup | ConvertTo-Json -Depth 10 | Set-Content -Path $backupFile -Encoding UTF8

$fileSize = [math]::Round((Get-Item $backupFile).Length / 1024, 1)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Backup salvo com sucesso!" -ForegroundColor Green
Write-Host "  Arquivo: $backupFile" -ForegroundColor White
Write-Host "  Tamanho: ${fileSize}KB" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
