# RDesk Payslip Management System

A comprehensive full-stack payslip management system with QR code verification, built with Django REST API and React frontend.

## 🚀 Features

### Core Functionality
- **Payslip Generation**: Generate professional PDF payslips with company branding
- **QR Code Verification**: Each payslip includes a QR code with verified tick symbol, Employee ID, and payslip month/year
- **Bulk Processing**: Generate payslips for multiple employees simultaneously
- **Email Integration**: Send payslips directly to employees via email
- **Complete Employee Management**: Full CRUD operations (Create, Read, Update, Delete) for employee data
- **Welcome Email System**: Automated welcome emails with login credentials for new employees
- **Dual Email Support**: Separate system login email and personal email for communication
- **Excel Import/Export**: Bulk employee management with Excel templates
- **Salary Data Management**: Handle monthly salary calculations and adjustments

### QR Code Format
```
✓ Verified|EmpID:EMP001|Month:January|Year:2025
```

### Employee Management Features
- **Complete CRUD Operations**: Full Create, Read, Update, Delete functionality
- **Dual Email System**: 
  - System Email: For login credentials
  - Personal Email: For welcome messages and communication
- **Welcome Email Automation**: Professional HTML emails with login credentials
- **Excel Integration**: Bulk import/export with password support
- **Interactive UI**: Action buttons, modals, and intuitive forms
- **Data Validation**: Comprehensive form validation and error handling

### Technology Stack
- **Backend**: Django 4.2, Django REST Framework, Celery
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Database**: MySQL (configurable for PostgreSQL/SQLite)
- **PDF Generation**: Playwright, ReportLab
- **QR Code**: qrcode library
- **Email**: SMTP integration

## 📁 Project Structure

```
RDesk Payslip System/
├── fullstack/
│   ├── backend/                 # Django API
│   │   ├── authentication/     # User authentication
│   │   ├── departments/        # Department management
│   │   ├── employees/          # Employee management
│   │   ├── payslip_generation/ # Payslip generation logic
│   │   └── payslips/          # Payslip models
│   └── frontend/               # React application
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── contexts/       # React contexts
│       │   ├── services/       # API services
│       │   └── types/          # TypeScript types
│       └── public/             # Static assets
├── .gitignore
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- Git

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd fullstack/backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start development server**
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd fullstack/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

### Quick Start (Windows)
```bash
# Run the full system
cd fullstack
start-full-system.bat
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in `fullstack/backend/`:

```env
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=mysql://user:password@localhost:3306/payslip_db
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Database Configuration
The system uses MySQL by default. To use PostgreSQL or SQLite, update the database settings in `RDesk_payslip/settings.py`.

## 📱 Usage

### 1. Employee Management
- **Create**: Add new employees with complete details and optional welcome email
- **Read**: View detailed employee information in organized modal
- **Update**: Edit employee information with pre-populated forms
- **Delete**: Remove employees with confirmation dialog
- **Excel Import**: Bulk import employees via Excel template with password support
- **Excel Export**: Download template with all required fields
- **Dual Email System**: Separate system login and personal communication emails
- **Welcome Emails**: Automated professional welcome emails with login credentials

### 2. Payslip Generation
- Select employees and pay period
- Choose salary calculation method
- Generate individual or bulk payslips
- Preview payslips before generation

### 3. QR Code Verification
- Each payslip includes a QR code
- QR code contains: ✓ Verified, Employee ID, Month, Year
- Scan QR code to verify payslip authenticity

### 4. Email Distribution
- Send payslips directly to employees
- **Welcome Email System**: Professional HTML and text email templates
- **Dual Email Support**: System login email + personal communication email
- **Automated Credentials**: Send login credentials to new employees
- Configure SMTP settings for email delivery
- Track email delivery status

## 🔐 Authentication

The system includes:
- User authentication with JWT tokens
- Role-based access control
- Protected routes and API endpoints
- Secure password handling

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout

### Employees
- `GET /api/employees/` - List all employees
- `POST /api/employees/` - Create new employee with welcome email
- `PUT /api/employees/{id}/` - Update employee information
- `DELETE /api/employees/{id}/` - Delete employee
- `POST /api/employees/import/` - Import employees from Excel
- `POST /api/employees/{id}/send-welcome-email/` - Send welcome email to employee

### Payslips
- `POST /api/payslips/generate/` - Generate payslips
- `GET /api/payslips/` - List generated payslips
- `GET /api/payslips/{id}/` - Get specific payslip

## 🎨 Frontend Features

- **Modern UI**: Built with Tailwind CSS and shadcn/ui components
- **Responsive Design**: Works on desktop and mobile devices
- **Complete CRUD Interface**: View, Edit, Delete operations with intuitive modals
- **Real-time Updates**: Live status updates for payslip generation
- **Interactive Forms**: User-friendly forms with validation and pre-population
- **PDF Preview**: Preview payslips before generation
- **Action Buttons**: Quick access to view, edit, and delete operations
- **Modal System**: Organized modals for viewing and editing employee details
- **Excel Integration**: Download templates and bulk import functionality
- **Email Management**: Dual email system with welcome email options

## 🔒 Security Features

- **Data Protection**: Sensitive data is properly encrypted
- **File Security**: Media files are excluded from version control
- **Environment Variables**: Sensitive configuration is externalized
- **Input Validation**: All user inputs are validated and sanitized

## 📈 Performance

- **Bulk Processing**: Efficient batch processing for large datasets
- **Async Operations**: Background tasks for payslip generation
- **Optimized Queries**: Database queries are optimized for performance
- **Caching**: Implemented caching for frequently accessed data

## 🧪 Testing

### Backend Testing
```bash
cd fullstack/backend
python manage.py test
```

### Frontend Testing
```bash
cd fullstack/frontend
npm test
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Development**: BlackRoth Software Solutions Pvt. Ltd.
- **Contact**: info@blackroth.com

## 🆘 Support

For support and questions:
- Email: info@blackroth.com
- Documentation: Check the `/docs` folder
- Issues: Create an issue in the repository

## 🔄 Version History

### v1.1.0 (Current)
- **Complete CRUD Operations**: Full Create, Read, Update, Delete functionality for employees
- **Welcome Email System**: Automated professional welcome emails with login credentials
- **Dual Email Support**: Separate system login and personal communication emails
- **Enhanced UI**: Action buttons, modals, and improved user experience
- **Excel Integration**: Enhanced import/export with password support
- **Email Templates**: Professional HTML and text email templates
- **Database Enhancements**: Added password and personal email fields
- **API Improvements**: New endpoints for welcome email functionality

### v1.0.0
- Initial release
- Complete payslip management system
- QR code verification with verified tick symbol
- Email integration
- Bulk processing capabilities
- Modern React frontend
- Django REST API backend

## 🚀 Deployment

### Production Deployment
1. Configure production database
2. Set up environment variables
3. Configure SMTP settings
4. Deploy backend to your preferred hosting service
5. Build and deploy frontend
6. Set up domain and SSL certificates

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

---

**BlackRoth Software Solutions Pvt. Ltd.**  
13th FLOOR, MANJEERA TRINITY CORPORATE, JNTU - HITECH CITY ROAD, 3/d PHASE, KPHB, KUKATPALLY, HYDERABAD - 500072

*Built with ❤️ for efficient payslip management*
