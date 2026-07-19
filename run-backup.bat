@echo off
:: Navigate to project directory
cd /d "C:\Users\kpand\.gemini\antigravity\scratch\school-grading-app"

:: Execute Node.js backup script and log output with timestamps
echo ---------------------------------------------------- >> backup.log
echo [%%DATE%% %%TIME%%] Starting scheduled backup run >> backup.log
node scripts/backup.js >> backup.log 2>&1
echo [%%DATE%% %%TIME%%] Backup run ended >> backup.log
echo ---------------------------------------------------- >> backup.log
