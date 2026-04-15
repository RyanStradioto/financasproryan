cd C:\Users\amara\financasproryan
# Run the first migration (profiles, expenses, income) with IF NOT EXISTS workaround
$sql1 = Get-Content "supabase\migrations\20260313111646_13fe578d-9578-4c82-b8c5-94734aa7192e.sql" -Raw
npx supabase db query $sql1 --linked 2>&1 | Select-Object -Last 10
