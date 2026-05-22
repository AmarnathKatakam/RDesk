/**
 * Component: pages\Employees.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, FileText, Trash2, Eye, Pencil, KeyRound, Copy, Mail, Download } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { attendanceAPI, departmentAPI, employeeAPI, employeeActivationAPI, employeeAdminAPI } from '@/services/api';
import EmployeeDashboardView from '@/components/employees/EmployeeDashboardView';
import EmployeeModuleNav from '@/components/employees/EmployeeModuleNav';

interface DepartmentOption {
  id: number;
  department_name: string;
}

interface ShiftOption {
  id: number;
  name: string;
}

interface EmployeeRow {
  id: number;
  employee_id: string;
  name: string;
  email?: string;
  personal_email?: string;
  doj?: string;
  department?: { id: number; department_name: string } | null;
  shift?: { id: number; name: string } | null;
  shift_name?: string | null;
  shift_assignment_status?: string;
  location: string;
  is_active: boolean;
  account_activated?: boolean;
  onboarding_completed?: boolean;
  position?: string;
  pay_mode?: string;
  dob?: string;
  pan?: string;
  pf_number?: string | null;
  bank_account?: string;
  bank_ifsc?: string;
  health_card_no?: string | null;
  lpa?: string | number | null;
}

type EmployeeFormState = Record<string, string>;
type PasswordRegenMode = 'view' | 'mail';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const initialForm: EmployeeFormState = {
  employee_id: '',
  name: '',
  email: '',
  personal_email: '',
  position: '',
  department_id: '',
  shift_id: '',
  dob: '',
  doj: '',
  pan: '',
  pf_number: '',
  bank_account: '',
  bank_ifsc: '',
  pay_mode: 'NEFT',
  health_card_no: '',
  lpa: '',
  location: '',
};

const locationOptions = ['Hyderabad', 'Bangalore', 'Chennai', 'Mumbai', 'Pune', 'Remote'];
const payModeOptions = ['NEFT', 'Bank Transfer', 'Cheque', 'Cash'];

const normalizeList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const humanizeFieldName = (field: string): string =>
  field
    .replace(/^non_field_errors$/, 'Form')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const flattenValidationErrors = (errors: any, prefix = ''): string[] => {
  if (!errors) return [];

  if (Array.isArray(errors)) {
    return errors.flatMap((item) => flattenValidationErrors(item, prefix));
  }

  if (typeof errors === 'object') {
    return Object.entries(errors).flatMap(([field, value]) => {
      const fieldName = prefix ? `${prefix}.${field}` : field;
      return flattenValidationErrors(value, fieldName);
    });
  }

  const label = prefix ? `${humanizeFieldName(prefix)}: ` : '';
  return [`${label}${String(errors)}`];
};

const getSaveEmployeeErrorMessage = (error: any): string => {
  const payload = error?.response?.data;
  const status = error?.response?.status;
  const statusText = error?.response?.statusText;

  if (!payload) {
    const statusLabel = status ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}` : '';
    return [statusLabel, error?.message, 'No JSON error body was returned by the API.'].filter(Boolean).join('\n');
  }

  if (typeof payload === 'string') {
    const statusLabel = status ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}` : 'API error';
    return `${statusLabel}: ${payload}`;
  }

  const fieldErrors = flattenValidationErrors(payload.errors);
  if (fieldErrors.length > 0) {
    return `Employee validation failed:\n- ${fieldErrors.join('\n- ')}`;
  }

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    const statusLabel = status ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}` : 'API error';
    return `${statusLabel}: ${payload.detail}`;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  return `Unable to save employee${status ? ` (HTTP ${status})` : ''}. Check browser console and backend logs for details.`;
};

const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeEmployeeId, setActiveEmployeeId] = useState<number | null>(null);
  const [formData, setFormData] = useState<EmployeeFormState>(initialForm);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<EmployeeRow | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [regeneratingMode, setRegeneratingMode] = useState<PasswordRegenMode | null>(null);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [pageView, setPageView] = useState<'dashboard' | 'table'>('dashboard');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeeResponse, departmentResponse, shiftResponse] = await Promise.allSettled([
        employeeAPI.getAll(),
        departmentAPI.getAll(),
        attendanceAPI.getShifts(),
      ]);

      if (employeeResponse.status === 'fulfilled') {
        setEmployees(normalizeList<EmployeeRow>(employeeResponse.value.data));
      }
      if (departmentResponse.status === 'fulfilled') {
        setDepartments(normalizeList<DepartmentOption>(departmentResponse.value.data));
      }
      if (shiftResponse.status === 'fulfilled') {
        setShifts(Array.isArray(shiftResponse.value.data?.shifts) ? shiftResponse.value.data.shifts : []);
      }

      if (employeeResponse.status === 'rejected' || departmentResponse.status === 'rejected' || shiftResponse.status === 'rejected') {
        setToastState({
          type: 'error',
          message: 'Some form options could not be loaded. Please refresh.',
        });
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!toastState) return;
    const timer = window.setTimeout(() => setToastState(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastState]);

  const filteredRows = useMemo(() => {
    return employees.filter((employee) => {
      const q = query.toLowerCase();
      const matchesSearch =
        !q ||
        employee.name?.toLowerCase().includes(q) ||
        employee.employee_id?.toLowerCase().includes(q) ||
        (employee.email || '').toLowerCase().includes(q);
      const matchesDepartment =
        !departmentFilter ||
        String(employee.department?.id || '') === departmentFilter;
      const matchesLocation =
        !locationFilter ||
        (employee.location || '').toLowerCase().includes(locationFilter.toLowerCase());

      return matchesSearch && matchesDepartment && matchesLocation;
    });
  }, [employees, query, departmentFilter, locationFilter]);

  const allLocations = useMemo(() => {
    const values = new Set<string>();
    for (const employee of employees) {
      if (employee.location) values.add(employee.location);
    }
    return Array.from(values).sort();
  }, [employees]);

  const toggleRow = (employeeId: number) => {
    setSelectedRows((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRows.length === filteredRows.length) {
      setSelectedRows([]);
      return;
    }
    setSelectedRows(filteredRows.map((employee) => employee.id));
  };

  const resetForm = () => {
    setIsEditing(false);
    setActiveEmployeeId(null);
    setFormData(initialForm);
  };

  const openCreateForm = () => {
    resetForm();
    setOpenForm(true);
  };

  const openEditForm = (employee: EmployeeRow) => {
    setIsEditing(true);
    setActiveEmployeeId(employee.id);
    setFormData({
      ...initialForm,
      employee_id: employee.employee_id || '',
      name: employee.name || '',
      email: employee.email || '',
      personal_email: employee.personal_email || '',
      position: employee.position || '',
      department_id: employee.department?.id ? String(employee.department.id) : '',
      shift_id: employee.shift?.id ? String(employee.shift.id) : '',
      dob: employee.dob || '',
      pan: employee.pan || '',
      pf_number: employee.pf_number || '',
      bank_account: employee.bank_account || '',
      bank_ifsc: employee.bank_ifsc || '',
      pay_mode: employee.pay_mode || 'NEFT',
      health_card_no: employee.health_card_no || '',
      lpa: employee.lpa !== null && employee.lpa !== undefined ? String(employee.lpa) : '',
      location: employee.location || '',
      doj: employee.doj || '',
    });
    setOpenForm(true);
  };

  const openPasswordModal = (employee: EmployeeRow) => {
    setPasswordTarget(employee);
    setGeneratedPassword('');
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordTarget(null);
    setGeneratedPassword('');
    setRegeneratingMode(null);
  };

  const regeneratePassword = async (mode: PasswordRegenMode) => {
    if (!passwordTarget) return;

    const confirmMessage =
      mode === 'view'
        ? `Regenerate password for ${passwordTarget.name}? This will save the new password immediately and show it only once.`
        : `Regenerate password for ${passwordTarget.name}? This will save the new password immediately and email it to ${passwordTarget.email || 'employee email'}.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setRegeneratingMode(mode);
      const response = await employeeAPI.regeneratePassword(String(passwordTarget.id), mode);
      if (mode === 'view') {
        setGeneratedPassword(response.data?.password || '');
        setToastState({
          type: 'success',
          message: 'Password generated. It will only be shown once in this view.',
        });
      } else {
        setGeneratedPassword('');
        setToastState({
          type: 'success',
          message: response.data?.message || 'Password generated and emailed to employee.',
        });
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to regenerate password.';
      setToastState({ type: 'error', message });
    } finally {
      setRegeneratingMode(null);
    }
  };

  const copyGeneratedPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setToastState({ type: 'success', message: 'Password copied to clipboard.' });
    } catch (error) {
      setToastState({ type: 'error', message: 'Failed to copy password.' });
    }
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const normalizedEmployeeId = formData.employee_id.trim().toUpperCase();
      const normalizedEmail = formData.email.trim().toLowerCase();
      const normalizedPersonalEmail = formData.personal_email.trim().toLowerCase();
      const normalizedPan = formData.pan.trim().toUpperCase();
      const normalizedBankIfsc = formData.bank_ifsc.trim().toUpperCase();

      if (!/^[A-Z0-9]+$/.test(normalizedEmployeeId)) {
        alert('Employee ID must contain only uppercase letters and numbers.');
        return;
      }

      if (!normalizedEmail.endsWith('@blackroth.in')) {
        alert('Official email must end with @blackroth.in');
        return;
      }
      if (!normalizedPersonalEmail) {
        alert('Personal email is required.');
        return;
      }
      if (normalizedPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) {
        alert('PAN must be in format ABCDE1234F.');
        return;
      }
      if (normalizedBankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedBankIfsc)) {
        alert('IFSC must be in format ABCD0123456.');
        return;
      }
      if (!formData.department_id) {
        alert('Department is required.');
        return;
      }
      if (!formData.shift_id) {
        alert('Shift is required.');
        return;
      }

      if (!isEditing) {
        const duplicate = employees.some(
          (employee) => employee.employee_id?.toUpperCase() === normalizedEmployeeId
        );
        if (duplicate) {
          alert('Employee ID already exists.');
          return;
        }
      }

      const payload = {
        employee_id: normalizedEmployeeId,
        name: formData.name.trim(),
        email: normalizedEmail,
        personal_email: normalizedPersonalEmail,
        position: formData.position.trim() || 'Employee',
        department_id: Number(formData.department_id),
        shift_id: Number(formData.shift_id),
        dob: formData.dob || null,
        location: formData.location.trim(),
        doj: formData.doj,
        pan: normalizedPan,
        pf_number: formData.pf_number.trim(),
        bank_account: formData.bank_account.trim(),
        bank_ifsc: normalizedBankIfsc,
        pay_mode: formData.pay_mode || 'NEFT',
        health_card_no: formData.health_card_no.trim(),
        lpa: formData.lpa ? Number(formData.lpa) : null,
      };

      console.info('Create/Update employee payload:', payload);

      if (isEditing && activeEmployeeId) {
        await employeeAPI.update(String(activeEmployeeId), payload);
        setToastState({ type: 'success', message: 'Employee updated successfully.' });
      } else {
        await employeeAPI.create(payload);
        setToastState({ type: 'success', message: 'Employee created successfully.' });
      }
      setOpenForm(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to save employee:', error);
      console.error('Employee save API response:', (error as any)?.response?.data);
      const message = getSaveEmployeeErrorMessage(error);
      setToastState({ type: 'error', message });
      alert(message);
    }
  };

  const sendInvitation = async (employeeId: number) => {
    try {
      const response = await employeeActivationAPI.sendInvitation(employeeId);
      const data = response.data;

      if (!data?.success) {
        alert(data?.message || 'Failed to send invitation');
        return;
      }

      if (data.email_sent === false) {
        const activationLink = data?.activation_link ? `\nActivation link: ${data.activation_link}` : '';
        const deliveryHint = data?.delivery_hint ? `\nReason: ${data.delivery_hint}` : '';
        alert(`Invitation created, but email was not delivered automatically.${deliveryHint}${activationLink}`);
        return;
      }

      alert(data.message || 'Invitation sent successfully');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation');
    }
  };

  const releasePayslip = async (employeeId: number) => {
    try {
      const response = await employeeAdminAPI.bulkReleasePayslips({
        month: new Date().toLocaleString('default', { month: 'long' }),
        year: new Date().getFullYear(),
        selected_employees: [employeeId],
      });
      const data = response.data;
      alert(data.message || 'Payslip action completed');
    } catch (error) {
      console.error('Failed to release payslip:', error);
      alert('Failed to release payslip');
    }
  };

  const deleteEmployee = async (employeeId: number) => {
    if (!window.confirm('Delete this employee record?')) return;
    try {
      await employeeAPI.delete(String(employeeId));
      await loadData();
      setToastState({ type: 'success', message: 'Employee deleted successfully.' });
    } catch (error) {
      setToastState({ type: 'error', message: 'Failed to delete employee.' });
    }
  };

  const sendBulkInvites = async () => {
    for (const employeeId of selectedRows) {
      // eslint-disable-next-line no-await-in-loop
      await sendInvitation(employeeId);
    }
  };

  const openPayrollWithSelection = () => {
    sessionStorage.setItem('rd_selected_employees', JSON.stringify(selectedRows));
    navigate('/admin/payroll');
  };

  const exportCsv = () => {
    const rows = filteredRows.map((employee) => ({
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email || '',
      department: employee.department?.department_name || '',
      location: employee.location || '',
      status: employee.is_active ? 'Active' : 'Inactive',
    }));
    const csv = [
      Object.keys(rows[0] || {}).join(','),
      ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employees.csv');
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={filteredRows.length > 0 && selectedRows.length === filteredRows.length}
          onChange={toggleSelectAll}
          aria-label="Select all"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedRows.includes(row.id)}
          onChange={() => toggleRow(row.id)}
          aria-label={`Select ${row.name}`}
        />
      ),
    },
    { key: 'employee_id', header: 'Employee ID', render: (row) => row.employee_id },
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'email', header: 'Email', render: (row) => row.email || '-' },
    {
      key: 'department',
      header: 'Department',
      render: (row) => row.department?.department_name || '-',
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (row) => row.shift_name || row.shift?.name || 'Not Assigned',
    },
    { key: 'location', header: 'Location', render: (row) => row.location || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            row.is_active
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => navigate(`/admin/employees/${row.id}`)} className="h-8 px-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => openEditForm(row)} className="h-8 px-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => openPasswordModal(row)}
            className="h-8 px-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
            title="Regenerate Password"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button onClick={() => void sendInvitation(row.id)} className="h-8 px-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">
            <Send className="h-4 w-4" />
          </button>
          <button onClick={() => void releasePayslip(row.id)} className="h-8 px-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <FileText className="h-4 w-4" />
          </button>
          <button onClick={() => void deleteEmployee(row.id)} className="h-8 px-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {toastState && (
        <div
          className={`fixed right-4 top-4 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toastState.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {toastState.message}
        </div>
      )}

      <EmployeeModuleNav
        pageView={pageView}
        onViewChange={setPageView}
        onAddEmployee={openCreateForm}
      />

      {/* ── Dashboard view ── */}
      {pageView === 'dashboard' && (
        <EmployeeDashboardView
          employees={employees}
          loading={loading}
          departmentFilter={departmentFilter}
          locationFilter={locationFilter}
          onDepartmentChange={setDepartmentFilter}
          onLocationChange={setLocationFilter}
          departments={departments}
          locations={allLocations}
        />
      )}

      {/* ── Table view ── */}
      {pageView === 'table' && (<>

      <div className="saas-card saas-section">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees"
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.department_name}
              </option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
          >
            <option value="">All locations</option>
            {allLocations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="h-10 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={selectedRows.length === 0}
          onClick={() => void sendBulkInvites()}
          className="h-9 px-3 rounded-lg border border-blue-200 text-blue-700 disabled:opacity-50"
        >
          Send Invitations
        </button>
        <button
          disabled={selectedRows.length === 0}
          onClick={openPayrollWithSelection}
          className="h-9 px-3 rounded-lg border border-indigo-200 text-indigo-700 disabled:opacity-50"
        >
          Generate Payslips
        </button>
        {selectedRows.length > 0 && (
          <span className="text-sm text-slate-600">{selectedRows.length} selected</span>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyText="No employees found."
      />
      </>)}

      <Modal
        title={isEditing ? 'Edit Employee' : 'Add Employee'}
        open={openForm}
        onClose={() => setOpenForm(false)}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Employee ID</label>
              <input
                type="text"
                value={formData.employee_id || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, employee_id: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="EMP001"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Employee Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Official Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="name@blackroth.in"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Personal Email</label>
              <input
                type="email"
                value={formData.personal_email || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, personal_email: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="personal@example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Position</label>
              <input
                type="text"
                value={formData.position || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, position: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="Employee"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Date of Birth</label>
              <input
                type="date"
                value={formData.dob || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, dob: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Department</label>
              <select
                value={formData.department_id || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, department_id: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
                required
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.department_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Shift</label>
              <select
                value={formData.shift_id || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, shift_id: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
                required
              >
                <option value="">Select shift</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Location</label>
              <select
                value={formData.location || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, location: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
                required
              >
                <option value="">Select location</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Date of Joining</label>
              <input
                type="date"
                value={formData.doj || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, doj: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">PAN</label>
              <input
                type="text"
                value={formData.pan || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, pan: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm uppercase"
                placeholder="ABCDE1234F"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">PF Number</label>
              <input
                type="text"
                value={formData.pf_number || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, pf_number: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="PF account number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Bank Account</label>
              <input
                type="text"
                value={formData.bank_account || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, bank_account: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="Account number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Bank IFSC</label>
              <input
                type="text"
                value={formData.bank_ifsc || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, bank_ifsc: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm uppercase"
                placeholder="ABCD0123456"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Pay Mode</label>
              <select
                value={formData.pay_mode || 'NEFT'}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, pay_mode: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
              >
                {payModeOptions.map((payMode) => (
                  <option key={payMode} value={payMode}>
                    {payMode}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Health Card No</label>
              <input
                type="text"
                value={formData.health_card_no || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, health_card_no: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">LPA</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.lpa || ''}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, lpa: event.target.value }))
                }
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="4.50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpenForm(false)}
              className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700"
            >
              Cancel
            </button>
            <button type="submit" className="h-10 px-4 rounded-xl bg-blue-900 text-white">
              {isEditing ? 'Update' : 'Create'} Employee
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Regenerate Password"
        open={passwordModalOpen}
        onClose={closePasswordModal}
        widthClassName="max-w-xl"
      >
        {passwordTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Employee Name</p>
                <p className="font-medium text-slate-900">{passwordTarget.name}</p>
              </div>
              <div>
                <p className="text-slate-500">Employee ID</p>
                <p className="font-medium text-slate-900">{passwordTarget.employee_id}</p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-medium text-slate-900">{passwordTarget.email || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Joined Date</p>
                <p className="font-medium text-slate-900">
                  {passwordTarget.doj ? new Date(passwordTarget.doj).toLocaleDateString('en-IN') : '-'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Generated password will be shown only once.
            </div>

            {generatedPassword && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">Temporary Password</p>
                  <button
                    type="button"
                    onClick={() => void copyGeneratedPassword()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <p className="mt-2 font-mono text-base font-semibold tracking-wide text-slate-900 break-all">
                  {generatedPassword}
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => void regeneratePassword('view')}
                disabled={regeneratingMode !== null}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4" />
                {regeneratingMode === 'view' ? 'Generating...' : 'Generate & View'}
              </button>
              <button
                type="button"
                onClick={() => void regeneratePassword('mail')}
                disabled={regeneratingMode !== null}
                className="h-10 px-4 rounded-xl border border-blue-200 text-blue-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {regeneratingMode === 'mail' ? 'Sending...' : 'Generate & Mail'}
              </button>
              <button
                type="button"
                onClick={closePasswordModal}
                className="h-10 px-4 rounded-xl bg-slate-900 text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeesPage;

