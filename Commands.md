cd C:\Users\iBraHeeM\Projects\discord-scraper\backend
node src/bot/index.js

Step 3 — Terminal 2 (API Server)
Open a new PowerShell window:

cd C:\Users\iBraHeeM\Projects\discord-scraper\backend
node src/index.js

Step 4 — Terminal 3 (Commands)
Open a new PowerShell window:

cd C:\Users\iBraHeeM\Projects\discord-scraper\backend

Then Login : 
$response = Invoke-WebRequest -Uri "http://localhost:4000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@test.com","password":"admin123"}' -UseBasicParsing
$token = ($response.Content | ConvertFrom-Json).token

Test AI trends:
Invoke-WebRequest -Uri "http://localhost:4000/api/analytics/trends" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"scope":"channel","targetId":"1501557198453735507","targetName":"general","days":7}' -UseBasicParsing

Summary — 3 Terminals Always Running
TerminalWhat runsCommand1Discord Botnode src/bot/index.js2API Servernode src/index.js3Your commandsAPI calls


descord chanel chat extractor

debug commands 
 node src/debug-subnets.js   
 node src/run-subnets-now.js   
