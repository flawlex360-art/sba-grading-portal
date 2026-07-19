$TaskName = "SBA_Portal_Daily_Backup"
$BatchPath = "C:\Users\kpand\.gemini\antigravity\scratch\school-grading-app\run-backup.bat"

# Check if task already exists and remove it to avoid conflicts
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task '$TaskName'." -ForegroundColor Yellow
}

# Create Scheduled Task Action (executes the batch file)
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatchPath`""

# Create Scheduled Task Trigger (Daily at 6:00 PM / 18:00)
$Trigger = New-ScheduledTaskTrigger -Daily -At 6:00PM

# Create Scheduled Task Settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register Scheduled Task under current user context
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Automated Daily Backup of Firebase Database to Supabase for the SBA Grading Portal"

Write-Host "Successfully registered daily automated backup scheduled task!" -ForegroundColor Green
Write-Host "Task Name: $TaskName"
Write-Host "Runs: Every day at 6:00 PM"
Write-Host "Batch path: $BatchPath"
