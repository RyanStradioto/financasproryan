$uri = "https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary"
$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdhc2hjamVuaHdhbWd4cnJtYnNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg3ODYzNywiZXhwIjoyMDg5NDU0NjM3fQ.7akyYx2tZfbol2xJHg7X3n5SuyJLbt8CKbl0t1enatI"
    "Content-Type" = "application/json"
}
try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $headers -Body "{}" -UseBasicParsing
    Write-Host "SUCCESS: $($response.Content)"
} catch {
    Write-Host "ERROR $($_.Exception.Response.StatusCode): $($_.ErrorDetails.Message)"
}
