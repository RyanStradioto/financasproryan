# Faz login no projeto antigo e chama a funcao de email com o JWT do usuario
# O JWT do projeto antigo sera usado pela funcao para buscar dados de la

$oldProjectUrl = "https://eohnperxrykjzoofhfqu.supabase.co"
$oldAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvaG5wZXJ4cnlranpvb2ZoZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzOTEyMjIsImV4cCI6MjA4ODk2NzIyMn0.LAddtFvyfXA1nWdpgjiJM87hg6oi7z_it58NjVEElwc"

# Caminho 1: Testa com a sessao armazenada no localStorage do browser (nao possivel no PS)
# Caminho 2: Usa a API de signin para obter um JWT
# Para teste vamos tentar o signin diretamente

Write-Host "Insira o email do usuario (amaralstradiotoryan@gmail.com):"
$email = "amaralstradiotoryan@gmail.com"
Write-Host "Insira a senha:"
$password = Read-Host -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Login no projeto antigo
$loginBody = @{ email = $email; password = $plainPassword } | ConvertTo-Json
$loginHeaders = @{
    "apikey" = $oldAnonKey
    "Content-Type" = "application/json"
}

try {
    $loginResponse = Invoke-WebRequest -Uri "$oldProjectUrl/auth/v1/token?grant_type=password" -Method POST -Headers $loginHeaders -Body $loginBody -UseBasicParsing
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $userJwt = $loginData.access_token

    if ($userJwt) {
        Write-Host "`nLogin OK! Chamando weekly-summary com dados reais..."
        
        $funcUri = "https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/weekly-summary"
        $funcHeaders = @{
            "Authorization" = "Bearer $userJwt"
            "Content-Type" = "application/json"
        }
        
        $funcResponse = Invoke-WebRequest -Uri $funcUri -Method POST -Headers $funcHeaders -Body "{}" -UseBasicParsing
        Write-Host "RESULTADO: $($funcResponse.Content)"
        
        Write-Host "`nChamando monthly-summary..."
        $funcUri2 = "https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary"
        $funcResponse2 = Invoke-WebRequest -Uri $funcUri2 -Method POST -Headers $funcHeaders -Body "{}" -UseBasicParsing
        Write-Host "RESULTADO: $($funcResponse2.Content)"
    } else {
        Write-Host "JWT nao encontrado na resposta de login"
        Write-Host $loginResponse.Content
    }
} catch {
    Write-Host "ERROR: $($_.ErrorDetails.Message)"
    Write-Host $_.Exception.Message
}
