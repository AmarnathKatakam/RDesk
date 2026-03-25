# 🚀 RDesk Payslip System - Django Backend

## 📋 Overview

This is the Django backend for the RDesk Payslip System, a comprehensive bulk payslip generation system designed to handle 200-500 employees with advanced features including Excel import, bulk generation, progress tracking, and file organization.

## 🏗️ Architecture

- **Framework**: Django 4.2.7 with Django REST Framework
- **Database**: MySQL
- **Task Queue**: Celery with Redis
- **File Storage**: Local file system with organized structure
- **PDF Generation**: ReportLab
- **Excel Processing**: pandas + openpyxl

## 📁 Project Structure

```
backend/
├── camelq_payslip/          # Main RDesk Django project
│   ├── settings.py          # Django settings
│   ├── urls.py             # Main URL configuration
│   ├── celery.py           # Celery configuration
│   └── wsgi.py             # WSGI configuration
├── authentication/         # Authentication app
│   ├── models.py           # AdminUser model
│   ├── views.py            # Authentication views
│   ├── urls.py             # Authentication URLs
│   └── admin.py            # Admin configuration
├── departments/            # Department management
│   ├── models.py           # Department model
│   ├── views.py            # Department views
│   ├── urls.py             # Department URLs
│   └── admin.py            # Admin configuration
├── employees/              # Employee management
│   ├── models.py           # Employee & SalaryStructure models
│   ├── views.py            # Employee views
│   ├── urls.py             # Employee URLs
│   └── admin.py            # Admin configuration
├── payslip_generation/     # Payslip generation
│   ├── models.py           # Payslip & Task models
│   ├── views.py            # Payslip views
│   ├── urls.py             # Payslip URLs
│   ├── tasks.py            # Celery tasks
│   ├── utils.py            # PDF generation utilities
│   └── admin.py            # Admin configuration
├── requirements.txt        # Python dependencies
└── manage.py              # Django management script
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- MySQL 8.0+
- Redis (for Celery)

### Installation

1. **Clone the repository and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   ```bash
   # Copy the example environment file
   cp env_example.txt .env
   
   # Edit .env with your configuration
   # Set database credentials, Redis URL, etc.
   ```

5. **Database Setup**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE RDesk_payslip;
   
   # Run migrations
   python manage.py makemigrations
   python manage.py migrate
   ```

6. **Create Admin User**
   ```bash
   python manage.py create_admin
   # Or with custom credentials:
   python manage.py create_admin --username admin --email admin@blackroth.com --password admin123 --full-name "System Administrator"
   ```

7. **Start Development Server**
   ```bash
   python manage.py runserver
   ```

8. **Start Celery Worker** (in a separate terminal)
   ```bash
   celery -A camelq_payslip worker --loglevel=info
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

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
```

### Database Configuration

The system is configured to use MySQL by default. Update the database settings in `settings.py` if needed.

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login/` - Admin login
- `POST /api/auth/logout/` - Admin logout
- `GET /api/auth/profile/` - Get user profile
- `PUT /api/auth/profile/update/` - Update profile
- `POST /api/auth/change-password/` - Change password

### Departments
- `GET /api/departments/` - List departments
- `POST /api/departments/` - Create department
- `GET /api/departments/{id}/` - Get department
- `PUT /api/departments/{id}/` - Update department
- `DELETE /api/departments/{id}/` - Delete department
- `GET /api/departments/stats/` - Department statistics

### Employees
- `GET /api/employees/` - List employees
- `POST /api/employees/` - Create employee
- `GET /api/employees/{id}/` - Get employee
- `PUT /api/employees/{id}/` - Update employee
- `DELETE /api/employees/{id}/` - Delete employee
- `POST /api/employees/import-excel/` - Import employees from Excel
- `GET /api/employees/stats/` - Employee statistics
- `GET /api/employees/by-department/{id}/` - Get employees by department

### Salary Structures
- `GET /api/employees/salary-structures/` - List salary structures
- `POST /api/employees/salary-structures/` - Create salary structure
- `GET /api/employees/salary-structures/{id}/` - Get salary structure
- `PUT /api/employees/salary-structures/{id}/` - Update salary structure
- `DELETE /api/employees/salary-structures/{id}/` - Delete salary structure

### Payslips
- `GET /api/payslips/payslips/` - List payslips
- `GET /api/payslips/payslips/{id}/` - Get payslip
- `GET /api/payslips/payslips/{id}/download/` - Download payslip PDF
- `POST /api/payslips/bulk-generate/` - Start bulk payslip generation
- `GET /api/payslips/tasks/{task_id}/status/` - Get generation status
- `GET /api/payslips/download-monthly/{year}/{month}/` - Download monthly payslips
- `GET /api/payslips/files/{year}/{month}/` - Get payslip files
- `GET /api/payslips/stats/` - Payslip statistics

## 🔄 Celery Tasks

### Bulk Payslip Generation

The system uses Celery for asynchronous bulk payslip generation:

1. **Task Coordination**: `generate_all_payslips` - Coordinates the entire bulk generation process
2. **Batch Processing**: `generate_payslip_batch` - Processes employees in batches of 25
3. **Progress Tracking**: `check_completion` - Monitors task completion

### Task Flow

1. Frontend sends bulk generation request
2. Backend creates `PayslipGenerationTask` record
3. Celery task splits employees into batches
4. Each batch is processed asynchronously
5. Progress is tracked and updated in real-time
6. Frontend polls for status updates

## 📁 File Organization

### Payslip Files

Generated payslips are organized in the following structure:

```
media/payslips/
├── 2025/
│   ├── January/
│   │   ├── payslip_ajay_january.pdf
│   │   ├── payslip_priya_january.pdf
│   │   └── ...
│   ├── February/
│   └── ...
└── 2024/
    └── ...
```

### File Naming Convention

- Format: `payslip_{employee_name}_{month}.pdf`
- Employee names are converted to lowercase with underscores
- Example: `payslip_ajay_kumar_january.pdf`

## 🧪 Testing

### Run Tests

```bash
python manage.py test
```

### Test Specific Apps

```bash
python manage.py test authentication
python manage.py test employees
python manage.py test payslip_generation
```

## 🚀 Deployment

### Production Settings

1. **Update Environment Variables**
   ```env
   DEBUG=False
   SECRET_KEY=your-production-secret-key
   ALLOWED_HOSTS=your-domain.com
   ```

2. **Database Configuration**
   - Use production MySQL database
   - Set proper database credentials

3. **Static Files**
   ```bash
   python manage.py collectstatic
   ```

4. **Celery Configuration**
   - Set up Redis server
   - Configure Celery workers
   - Set up monitoring

### Docker Deployment

```dockerfile
# Dockerfile example
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "camelq_payslip.wsgi:application"]
```

## 📈 Performance

### Optimization Features

- **Batch Processing**: Employees processed in batches of 25
- **Database Optimization**: Proper indexing and query optimization
- **File Management**: Efficient file storage and cleanup
- **Caching**: Redis-based caching for frequently accessed data

### Scalability

- **Horizontal Scaling**: Multiple Celery workers
- **Database Scaling**: MySQL with proper indexing
- **File Storage**: Organized file structure for easy management

## 🔒 Security

### Security Features

- **Authentication**: Session-based authentication
- **Authorization**: Role-based access control
- **Data Validation**: Comprehensive input validation
- **File Security**: Secure file upload and storage
- **CORS Configuration**: Proper CORS settings for frontend

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check MySQL service status
   - Verify database credentials
   - Ensure database exists

2. **Celery Issues**
   - Check Redis service status
   - Verify Celery worker is running
   - Check task queue status

3. **File Generation Issues**
   - Check file permissions
   - Verify media directory exists
   - Check disk space

### Debug Mode

Enable debug mode by setting `DEBUG=True` in environment variables.

## 📞 Support

For technical support or questions about the backend:

- Check the Django documentation
- Review the API endpoints
- Examine the model definitions
- Test individual components

## 🎉 Conclusion

The Django backend is now fully implemented with all the requested features:

✅ **Authentication System** - Secure admin authentication
✅ **Employee Management** - CRUD operations and Excel import
✅ **Department Management** - Department organization
✅ **Salary Structures** - Employee salary management
✅ **Bulk Payslip Generation** - Asynchronous batch processing
✅ **File Management** - Organized file storage and retrieval
✅ **Progress Tracking** - Real-time generation status
✅ **API Integration** - Complete REST API for frontend

The system is ready for production deployment and can handle the full workflow from employee import to bulk payslip generation for 200-500 employees with proper progress tracking and file organization.
