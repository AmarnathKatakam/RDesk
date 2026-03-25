"""
Django settings for RDesk Payslip project.
"""

import os
from pathlib import Path
from decouple import Config, RepositoryEnv

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Load .env file ---
env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    config = Config(RepositoryEnv(env_file))
else:
    from decouple import config

# --- Security ---
SECRET_KEY = config("SECRET_KEY", default="django-insecure-placeholder")

DEBUG = str(config("DEBUG", default="True")).strip().lower() in ("true", "1", "yes", "on")

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="*",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

# --- Applications ---
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third party apps
    "rest_framework",
    "corsheaders",
    "django_filters",

    # Local apps
    "authentication",
    "departments",
    "employees",
    "attendance",
    "payslip_generation",
]

# --- Middleware ---
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "camelq_payslip.middleware.CSRFMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "camelq_payslip.urls"

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

WSGI_APPLICATION = "camelq_payslip.wsgi.application"

# --- Database ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "RDesk",
        "USER": "root",
        "PASSWORD": "Blackroth@9922",
        "HOST": "localhost",
        "PORT": "3306",
    }
}

# --- Password validation ---
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internationalization ---
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static & Media ---
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# --- Custom User ---
AUTH_USER_MODEL = "authentication.AdminUser"

# --- REST Framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

# --- CSRF / CORS ---
CSRF_EXEMPT_URLS = [r"^api/.*$"]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
CSRF_COOKIE_SECURE = False
CSRF_COOKIE_HTTPONLY = False

# --- Celery ---
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# --- File Upload Limits ---
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# --- Frontend URL ---
FRONTEND_URL = str(config("FRONTEND_URL", default="http://localhost:5173")).strip()

# --- Email Configuration ---
EMAIL_HOST = str(config("EMAIL_HOST", default="localhost")).strip()
EMAIL_PORT = int(str(config("EMAIL_PORT", default="587")).strip())
EMAIL_USE_TLS = str(config("EMAIL_USE_TLS", default="True")).strip().lower() in ("true","1","yes","on")
EMAIL_HOST_USER = str(config("EMAIL_HOST_USER", default="")).strip()
EMAIL_HOST_PASSWORD = str(config("EMAIL_HOST_PASSWORD", default="")).strip()
configured_email_backend = str(config("EMAIL_BACKEND", default="")).strip()
if configured_email_backend:
    EMAIL_BACKEND = configured_email_backend
elif EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    # Prefer real SMTP delivery when credentials are available, even in DEBUG mode.
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = (
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    )

# Prevent false-positive "email sent" in non-debug runs caused by console backend overrides.
if not DEBUG and EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

DEFAULT_FROM_EMAIL = str(
    config("DEFAULT_FROM_EMAIL", default=(EMAIL_HOST_USER or "noreply@blackroth.in"))
).strip()
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# --- Logging ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": os.path.join(BASE_DIR, "logs", "django.log"),
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": True,
        },
        "payslip_generation": {
            "handlers": ["file", "console"],
            "level": "INFO",
            "propagate": True,
        },
    },
}

os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)
