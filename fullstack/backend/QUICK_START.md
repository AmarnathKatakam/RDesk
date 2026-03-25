# 🚀 RDesk Payslip System - Quick Start Guide

## Prerequisites
- Python 3.8+
- MySQL 8.0+
- Redis (for Celery)
- Node.js 16+ (for frontend)

## 🏃‍♂️ Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Database Setup
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE RDesk_payslip;
exit
```

### 3. Environment Configuration
```bash
# Copy and edit environment file
cp env_example.txt .env
# Edit .env with your database credentials
```

### 4. Run Setup Script
```bash
python setup.py
```

### 5. Start Services
```bash
# Terminal 1: Django Server
python manage.py runserver

# Terminal 2: Celery Worker
celery -A camelq_payslip worker --loglevel=info
```

## 🔧 Manual Setup (Alternative)

### 1. Create Environment File
```bash
cp env_example.txt .env
# Edit .env with your settings
```

### 2. Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Create Admin User
```bash
python manage.py create_admin
```

### 4. Start Services
```bash
python manage.py runserver
celery -A camelq_payslip worker --loglevel=info
```

## 🌐 Access Points

- **Django Admin**: http://localhost:8000/admin/
- **API Endpoints**: http://localhost:8000/api/
- **Frontend**: http://localhost:3000 (if running)

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

1. **Database Connection Error**
   - Check MySQL is running
   - Verify database credentials in .env
   - Ensure database exists

2. **Celery Connection Error**
   - Check Redis is running
   - Verify Redis connection in .env

3. **Import Errors**
   - Ensure all dependencies are installed
   - Check Python version compatibility

4. **Permission Errors**
   - Check file permissions
   - Ensure write access to directories

### Logs and Debugging
```bash
# Django logs
python manage.py runserver --verbosity=2

# Celery logs
celery -A camelq_payslip worker --loglevel=debug
```

## 📁 Project Structure
```
backend/
├── camelq_payslip/          # Main RDesk Django project
├── authentication/          # Admin authentication
├── departments/             # Department management
├── employees/               # Employee management
├── payslip_generation/      # Payslip generation
├── requirements.txt         # Dependencies
├── setup.py                # Setup script
└── manage.py               # Django management
```

## 🔄 Frontend Integration

Your React frontend is already configured to work with this backend:
- API base URL: `http://localhost:8000/api/`
- Authentication endpoints ready
- CORS configured for frontend access
- All data models match frontend types

## 📞 Support

If you encounter any issues:
1. Check the logs for error messages
2. Verify all services are running
3. Check database and Redis connections
4. Review environment configuration

