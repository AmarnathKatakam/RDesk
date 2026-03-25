@echo off
echo 🚀 RDesk Payslip System - Windows Setup
echo ==========================================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "manage.py" (
    echo ❌ Please run this script from the backend directory
    pause
    exit /b 1
)

echo ✅ Python is installed
echo.

REM Install dependencies
echo 📦 Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating environment configuration...
    copy env_example.txt .env
    echo ✅ .env file created
    echo ⚠️  Please edit .env file with your database credentials
    echo.
)

REM Run migrations
echo 🗄️ Running database migrations...
python manage.py makemigrations
if errorlevel 1 (
    echo ❌ Failed to create migrations
    pause
    exit /b 1
)

python manage.py migrate
if errorlevel 1 (
    echo ❌ Failed to apply migrations
    pause
    exit /b 1
)

echo ✅ Database migrations completed
echo.

REM Create admin user
echo 👤 Creating admin user...
python manage.py create_admin
if errorlevel 1 (
    echo ❌ Failed to create admin user
    pause
    exit /b 1
)

echo ✅ Admin user created
echo.

REM Collect static files
echo 📁 Collecting static files...
python manage.py collectstatic --noinput
if errorlevel 1 (
    echo ❌ Failed to collect static files
    pause
    exit /b 1
)

echo ✅ Static files collected
echo.

echo 🎉 Setup completed successfully!
echo.
echo 📋 Next Steps:
echo 1. Start the Django server: python manage.py runserver
echo 2. Start Celery worker: celery -A camelq_payslip worker --loglevel=info
echo 3. Access admin panel: http://localhost:8000/admin/
echo 4. API endpoints: http://localhost:8000/api/
echo.
echo 🔗 Frontend Integration:
echo Your frontend should connect to: http://localhost:8000/api/
echo.

pause

