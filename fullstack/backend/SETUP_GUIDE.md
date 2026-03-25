# 🚀 RDesk Payslip System - Complete Setup Guide

## 📋 Prerequisites

Before starting, ensure you have the following installed:

### Required Software
- **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
- **MySQL 8.0+** - [Download MySQL](https://dev.mysql.com/downloads/mysql/)
- **Redis** - [Download Redis](https://redis.io/download)
- **Node.js 16+** (for frontend) - [Download Node.js](https://nodejs.org/)

### Optional but Recommended
- **Git** - [Download Git](https://git-scm.com/downloads)
- **VS Code** - [Download VS Code](https://code.visualstudio.com/)

## 🏗️ Backend Setup (Django)

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Database Setup

#### Create MySQL Database
```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE RDesk_payslip;
exit
```

#### Configure Environment
```bash
# Copy environment template
cp env_example.txt .env

# Edit .env file with your database credentials
# Update DB_PASSWORD with your MySQL password
```

### Step 4: Run Setup Script
```bash
python setup.py
```

This script will:
- ✅ Install dependencies
- ✅ Create environment configuration
- ✅ Run database migrations
- ✅ Create admin user
- ✅ Collect static files

### Step 5: Start Services

#### Option A: Use the Service Manager (Recommended)
```bash
python start_services.py
```

#### Option B: Manual Start
```bash
# Terminal 1: Django Server
python manage.py runserver

# Terminal 2: Celery Worker
celery -A camelq_payslip worker --loglevel=info
```

### Step 6: Test API Endpoints
```bash
python test_api.py
```

## 🌐 Frontend Setup (React)

### Step 1: Navigate to Frontend Directory
```bash
cd ../camelq-payslip-v1
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Development Server
```bash
npm run dev
```

## 🔧 Configuration Details

### Environment Variables (.env)
```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DB_NAME=RDesk_payslip
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_HOST=localhost
DB_PORT=3306

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@blackroth.com
ADMIN_PASSWORD=admin123
```

### Service URLs
- **Django Admin**: http://localhost:8000/admin/
- **API Endpoints**: http://localhost:8000/api/
- **Frontend**: http://localhost:3000

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login/` - Admin login
- `POST /api/auth/logout/` - Admin logout
- `GET /api/auth/profile/` - Get admin profile

### Departments
- `GET /api/departments/` - List departments
- `POST /api/departments/` - Create department
- `GET /api/departments/{id}/` - Get department
- `PUT /api/departments/{id}/` - Update department
- `DELETE /api/departments/{id}/` - Delete department

### Employees
- `GET /api/employees/` - List employees
- `POST /api/employees/` - Create employee
- `POST /api/employees/import/` - Import from Excel
- `GET /api/employees/{id}/` - Get employee
- `PUT /api/employees/{id}/` - Update employee
- `DELETE /api/employees/{id}/` - Delete employee

### Payslips
- `POST /api/payslips/generate/` - Generate payslips
- `GET /api/payslips/` - List payslips
- `GET /api/payslips/{id}/download/` - Download payslip
- `GET /api/payslips/task/{task_id}/` - Get task status

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Error
```bash
# Check MySQL is running
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # macOS

# Test connection
mysql -u root -p -e "SHOW DATABASES;"
```

#### 2. Redis Connection Error
```bash
# Check Redis is running
redis-cli ping
# Should return "PONG"

# Start Redis if not running
redis-server
```

#### 3. Python Dependencies Error
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

#### 4. Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000  # Linux/macOS
netstat -ano | findstr :8000  # Windows

# Kill process
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows
```

### Logs and Debugging

#### Django Logs
```bash
# Run with verbose output
python manage.py runserver --verbosity=2

# Check logs
tail -f logs/django.log
```

#### Celery Logs
```bash
# Run with debug output
celery -A camelq_payslip worker --loglevel=debug
```

## 🚀 Production Deployment

### Environment Setup
```bash
# Set production environment
export DEBUG=False
export ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

### Database Migration
```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

### Start Production Services
```bash
# Using Gunicorn
gunicorn camelq_payslip.wsgi:application --bind 0.0.0.0:8000

# Using systemd (Linux)
sudo systemctl start camelq-payslip
sudo systemctl enable camelq-payslip
```

## 📞 Support

If you encounter any issues:

1. **Check the logs** for error messages
2. **Verify all services** are running (MySQL, Redis, Django, Celery)
3. **Check database connections** and credentials
4. **Review environment configuration**
5. **Run the test script** to verify API endpoints

### Useful Commands

```bash
# Check Django configuration
python manage.py check

# Create superuser manually
python manage.py createsuperuser

# Reset migrations (if needed)
python manage.py migrate --fake-initial

# Clear Celery tasks
celery -A camelq_payslip purge

# Check Celery status
celery -A camelq_payslip inspect active
```

## 🎯 Next Steps

After successful setup:

1. **Access the admin panel** at http://localhost:8000/admin/
2. **Create departments** and **add employees**
3. **Test payslip generation** with a small batch
4. **Integrate with your frontend** application
5. **Configure email settings** for notifications
6. **Set up monitoring** and logging

Your RDesk Payslip System is now ready for production use! 🎉

