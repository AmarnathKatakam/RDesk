@echo off
echo 🚀 Starting RDesk Payslip System
echo ==================================

echo.
echo 📋 Starting both frontend and backend services...
echo.

REM Start Django backend in a new window
echo 🔧 Starting Django backend...
start "Django Backend" cmd /k "cd backend && python manage.py runserver"

REM Wait a moment for Django to start
timeout /t 3 /nobreak >nul

REM Start React frontend in a new window
echo 🌐 Starting React frontend...
start "React Frontend" cmd /k "cd camelq-payslip-v1 && npm run dev"

echo.
echo ✅ Both services are starting...
echo.
echo 📊 Service URLs:
echo • Frontend: http://localhost:5173
echo • Backend: http://localhost:8000
echo • Admin: http://localhost:8000/admin/
echo.
echo 🔑 Default Login:
echo • Username: admin
echo • Password: admin123
echo.
echo Press any key to exit...
pause >nul

