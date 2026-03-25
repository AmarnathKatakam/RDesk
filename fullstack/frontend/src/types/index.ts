export type EntityId = number;

// Department Types
export interface Department {
  id: EntityId;
  department_code: string;
  department_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// Employee Types
export interface Employee {
  id: EntityId;
  employee_id: string;
  name: string;
  position: string;
  department: Department;
  dob: string;
  doj: string;
  pan: string;
  pf_number: string;
  bank_account: string;
  bank_ifsc: string;
  pay_mode: 'Bank Transfer' | 'NEFT' | 'Cheque' | 'Cash';
  location: string;
  health_card_no?: string;
  email?: string;
  personal_email?: string;
  password?: string;
  password_changed?: boolean;
  password_set_date?: string;
  lpa?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Salary Structure Types
export interface SalaryStructure {
  id: EntityId;
  employee: EntityId;
  salary_type: 'SALARY' | 'STIPEND';
  annual_ctc: number;
  effective_from: string;
  is_active: boolean;
}

// Monthly Salary Data Types
export interface MonthlySalaryData {
  id: EntityId;
  employee: EntityId;
  employee_name: string;
  employee_id: string;
  month: string;
  year: number;
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  special_allowance: number;
  pf_employee: number;
  professional_tax: number;
  pf_employer: number;
  other_deductions: number;
  salary_advance: number;
  work_days: number;
  days_in_month: number;
  lop_days: number;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
  uploaded_at: string;
  uploaded_by: EntityId;
  uploaded_by_name: string;
}

// Payslip Types
export interface Payslip {
  id: EntityId;
  employee: Employee;
  pay_period_month: string;
  pay_period_year: number;
  salary_type: 'SALARY' | 'STIPEND';
  work_days: number;
  days_in_month: number;
  lop_days: number;
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  special_allowance: number;
  pf_employee: number;
  total_earnings: number;
  professional_tax: number;
  pf_employer: number;
  other_deductions: number;
  salary_advance: number;
  total_deductions: number;
  net_pay: number;
  pdf_path: string;
  qr_code_data: string;
  generated_at: string;
  generated_by: string;
}

// Pay Period Types
export interface PayPeriod {
  month: string;
  year: string;
}

// Salary Method Types
export type SalaryMethod = 'SALARY' | 'STIPEND';

// Bulk Generation Types
export interface BulkGenerationRequest {
  employee_ids: EntityId[];
  pay_period: PayPeriod;
  salary_method: SalaryMethod;
}

export interface GenerationProgress {
  task_id: string;
  total: number;
  completed: number;
  current_batch: number;
  total_batches: number;
  batch_size: number;
  time_remaining: number;
  errors: string[];
  is_complete: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

// File Management Types
export interface PayslipFile {
  filename: string;
  path: string;
  size: number;
  created_at: string;
  employee_name: string;
  employee_id: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

// Excel Import Types
export interface ExcelImportResult {
  success: boolean;
  imported_count: number;
  errors: string[];
  warnings: string[];
}

export interface MonthlySalaryUploadResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  errors: string[];
  warnings: string[];
}

// Salary Calculation Preview Types
export interface SalaryCalculationPreview {
  employee_id: EntityId;
  employee_name: string;
  employee_id_code: string;
  department: string;
  lpa: number;
  calculated_monthly: number;
  lpa_monthly: number;
  difference: number;
  difference_percentage: number;
  is_nearby: boolean;
}

export interface SalaryPreviewResult {
  success: boolean;
  data: SalaryCalculationPreview[];
  summary: {
    total_employees: number;
    nearby_calculations: number;
    month: string;
    year: number;
  };
}

// Actual Salary Credited Types
export interface ActualSalaryCredited {
  id: EntityId;
  employee_id: EntityId;
  employee_name: string;
  employee_id_code: string;
  month: string;
  year: number;
  actual_salary_credited: number;
  uploaded_at: string;
  uploaded_by: string;
}

export interface ActualSalaryUploadResult {
  success: boolean;
  uploaded_count: number;
  updated_count: number;
  errors: string[];
}

// Form Data Types (for legacy component compatibility)
export interface EmployeeFormData {
  name: string;
  id: string;
  position: string;
  dob: string;
  doj: string;
  pan: string;
  pf: string;
  bankAccNo: string;
  bankIfsc: string;
  payMode: string;
  location: string;
  department: string;
  healthCardNo: string;
  workDays: number;
  daysInMonth: number;
  lop: number;
  arrearDays: number;
  dol: string;
}

export interface SalaryFormData {
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  special: number;
  pfEmployee: number;
}

export interface DeductionFormData {
  professionalTax: number;
  pfEmployer: number;
  otherDeduction: number;
  salaryAdvance: number;
}
