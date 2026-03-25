#!/usr/bin/env pwsh
# RDesk Payslip System Startup Script

Write-Host "🚀 Starting RDesk Payslip System" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Starting both frontend and backend services..." -ForegroundColor Yellow
Write-Host ""

# Start Django backend
Write-Host "🔧 Starting Django backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python manage.py runserver" -WindowStyle Normal

# Wait for Django to start
Start-Sleep -Seconds 3

# Start React frontend
Write-Host "🌐 Starting React frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd camelq-payslip-v1; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Both services are starting..." -ForegroundColor Green
Write-Host ""
Write-Host "📊 Service URLs:" -ForegroundColor Yellow
Write-Host "• Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "• Backend: http://localhost:8000" -ForegroundColor White
Write-Host "• Admin: http://localhost:8000/admin/" -ForegroundColor White
Write-Host ""
Write-Host "🔑 Default Login:" -ForegroundColor Yellow
Write-Host "• Username: admin" -ForegroundColor White
Write-Host "• Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

