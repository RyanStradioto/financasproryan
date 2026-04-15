$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdhc2hjamVuaHdhbWd4cnJtYnNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg3ODYzNywiZXhwIjoyMDg5NDU0NjM3fQ.7akyYx2tZfbol2xJHg7X3n5SuyJLbt8CKbl0t1enatI"
$url = "https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/weekly-summary"

try {
    $resp = Invoke-WebRequest -Uri $url -Method POST `
        -Headers @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" } `
        -Body "{}" -ErrorAction Stop
    Write-Output "SUCCESS: $($resp.Content)"
} catch [System.Net.WebException] {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $body = $reader.ReadToEnd()
    Write-Output "ERROR $($_.Exception.Response.StatusCode): $body"
}
