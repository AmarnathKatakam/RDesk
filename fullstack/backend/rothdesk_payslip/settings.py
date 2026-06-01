"""
RothDesk HRMS - Django Settings
================================
Central configuration for the entire backend.
All sensitive values are loaded from the .env file via python-decouple.
"""

import os
from pathlib import Path
from decouple import Config, RepositoryEnv
import dj_database_url

# Base directory of the project (one level above this file)
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Load .env file
# ---------------------------------------------------------------------------
# python-decouple reads from .env when present, falls back to environment vars
env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    config = Config(RepositoryEnv(env_file))
else:
    from decouple import config

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = config("SECRET_KEY", default="django-insecure-placeholder")

DEBUG = str(config("DEBUG", default="True")).strip().lower() in ("true", "1", "yes", "on")

# Comma-separated list of allowed hostnames (e.g. "localhost,myserver.com")
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="*",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

# ---------------------------------------------------------------------------
# Installed Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party packages
    "rest_framework",           # Django REST Framework — API layer
    "corsheaders",              # CORS headers for cross-origin frontend requests
    "django_filters",           # Filtering support for DRF querysets

    # RothDesk local apps (each app = one domain of the system)
    "authentication",           # Admin/HR users, employee login, leave, documents, notifications
    "departments",              # Department master data
    "employees",                # Employee profiles, salary structures, leave policies
    "attendance",               # Shifts, punch-in/out, GPS, holiday calendars
    "payslip_generation",       # Payroll runs, payslip PDF generation, reports
    "employee_finance",         # Bank accounts, ESI, PF details
    "payroll_config",           # Salary components, templates, statutory config, tax
]

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",                            # Must be first — adds CORS headers
    "django.middleware.security.SecurityMiddleware",                    # Security headers (HTTPS, XSS, etc.)
    "django.contrib.sessions.middleware.SessionMiddleware",             # Session support (used by employee login)
    "django.middleware.common.CommonMiddleware",                        # URL normalisation
    "django.middleware.csrf.CsrfViewMiddleware",                        # CSRF protection
    "rothdesk_payslip.middleware.CSRFMiddleware",                       # Custom CSRF exemption for /api/* routes
    "django.contrib.auth.middleware.AuthenticationMiddleware",          # Attaches user to request
    "django.contrib.messages.middleware.MessageMiddleware",             # Flash messages
    "django.middleware.clickjacking.XFrameOptionsMiddleware",           # Clickjacking protection
]

ROOT_URLCONF = "rothdesk_payslip.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "rothdesk_payslip.wsgi.application"

# ---------------------------------------------------------------------------
# Database — MySQL
# ---------------------------------------------------------------------------
# Credentials come from .env so they are never hard-coded here
DATABASE_URL = str(config("DATABASE_URL", default="")).strip()

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=DATABASE_URL.startswith("postgres://")
            or DATABASE_URL.startswith("postgresql://"),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
# ---------------------------------------------------------------------------
# Custom User Model
# ---------------------------------------------------------------------------
# AdminUser (in authentication app) replaces Django's default User model
AUTH_USER_MODEL = "authentication.AdminUser"

# ---------------------------------------------------------------------------
# Password Validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"   # IST — all timestamps stored/displayed in Indian time
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media Files
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")   # collectstatic output dir

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")           # uploaded files (docs, payslips, photos)

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",  # Admin/HR — JWT tokens
        "rothdesk_payslip.authentication.CSRFExemptSessionAuthentication",  # Employees/session cookies without API CSRF blocking
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",   # All endpoints require login by default
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",   # Required for file uploads
    ],
    # Rate limiting — protects download and API endpoints from abuse
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/minute",
        "user": "200/minute",
        "payslip_download": "30/minute",   # scoped throttle for download_payslip view
    },
}

# ---------------------------------------------------------------------------
# CORS & CSRF
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True   # Required for session-based employee auth

# Trusted origins for CSRF (must include every frontend URL)
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://localhost:5173",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
CSRF_COOKIE_SECURE = False
CSRF_COOKIE_HTTPONLY = False    # Frontend JS needs to read the CSRF cookie

# ---------------------------------------------------------------------------
# Celery — Async Task Queue (payslip emails, bulk operations)
# ---------------------------------------------------------------------------
CELERY_BROKER_URL      = config("CELERY_BROKER_URL",      default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND  = config("CELERY_RESULT_BACKEND",  default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT  = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE        = TIME_ZONE

# ---------------------------------------------------------------------------
# File Upload Limits
# ---------------------------------------------------------------------------
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10 MB

# ---------------------------------------------------------------------------
# Frontend URL (used in email links — activation, payslip, etc.)
# ---------------------------------------------------------------------------
FRONTEND_URL = str(config("FRONTEND_URL", default="http://localhost:5173")).strip()

# ---------------------------------------------------------------------------
# Email Configuration
# ---------------------------------------------------------------------------
EMAIL_HOST          = str(config("EMAIL_HOST",     default="smtp.gmail.com")).strip()
EMAIL_PORT          = int(str(config("EMAIL_PORT", default="587")).strip())
EMAIL_USE_TLS       = str(config("EMAIL_USE_TLS",  default="True")).strip().lower() in ("true", "1", "yes")
EMAIL_HOST_USER     = str(config("EMAIL_HOST_USER",     default="")).strip()
EMAIL_HOST_PASSWORD = str(config("EMAIL_HOST_PASSWORD", default="")).strip()

# Auto-select backend: use SMTP when credentials exist, console otherwise (dev only)
_configured_backend = str(config("EMAIL_BACKEND", default="")).strip()
if _configured_backend:
    EMAIL_BACKEND = _configured_backend
elif EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = (
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    )

DEFAULT_FROM_EMAIL = str(
    config("DEFAULT_FROM_EMAIL", default=(EMAIL_HOST_USER or "noreply@rothdesk.in"))
).strip()
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# ---------------------------------------------------------------------------
# Logging — writes to logs/django.log and console
# ---------------------------------------------------------------------------
os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": os.path.join(BASE_DIR, "logs", "django.log"),
            "formatter": "verbose",
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": True,
        },
        # Payslip generation has its own logger for payroll audit trails
        "payslip_generation": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": True,
        },
        "employees": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": True,
        },
    },
}
