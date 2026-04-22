$key = $env:SUPABASE_SERVICE_ROLE_KEY
$url = "https://gashcjenhwamgxrrmbsa.supabase.co/functions/v1/monthly-summary"

if (-not $key) {
    throw "Set SUPABASE_SERVICE_ROLE_KEY before running this script."
}

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
