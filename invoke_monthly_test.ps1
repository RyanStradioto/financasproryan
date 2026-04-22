$uri = "https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary"
$headers = @{
    "Authorization" = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
    "Content-Type" = "application/json"
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    throw "Set SUPABASE_SERVICE_ROLE_KEY before running this script."
}
try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body "{}" -UseBasicParsing
    Write-Host "SUCCESS: $($response.Content)"
} catch {
    Write-Host "ERROR $($_.Exception.Response.StatusCode): $($_.ErrorDetails.Message)"
}
