/**
 * Component: pages\EmployeeDetails.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { employeeAPI } from '@/services/api';

const toDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-IN') : '-');
const toTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
const toFixedHours = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

const EmployeeDetailsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        setLoading(true);
        if (!id) return;
        const response = await employeeAPI.getOverview(id);
        if (response.data?.employee) {
          setOverview(response.data);
        } else {
          setOverview({
            employee: response.data,
            current_month_summary: null,
            shift_assignments: [],
            attendance: [],
          });
        }
      } catch (error) {
        console.error('Failed to load employee details:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadEmployee();
  }, [id]);

  if (loading) {
    return <div className="saas-card saas-section text-slate-500">Loading employee details...</div>;
  }

  if (!overview?.employee) {
    return (
      <div className="saas-card saas-section">
        <p className="text-slate-600">Employee not found.</p>
      </div>
    );
  }

  const employee = overview.employee;
  const summary = overview.current_month_summary;
  const shiftAssignments: any[] = Array.isArray(overview.shift_assignments) ? overview.shift_assignments : [];
  const attendanceRows: any[] = Array.isArray(overview.attendance) ? overview.attendance : [];

  const profileRows: Array<[string, string]> = [
    ['Employee ID', employee.employee_id || '-'],
    ['Name', employee.name || '-'],
    ['Email', employee.email || '-'],
    ['Personal Email', employee.personal_email || '-'],
    ['Department', employee.department?.department_name || '-'],
    ['Position', employee.position || '-'],
    ['Location', employee.location || '-'],
    ['Assigned Shift', employee.shift_name || employee.shift?.name || 'Not Assigned'],
    ['Shift Status', employee.shift_assignment_status || 'Not Assigned'],
    ['Date of Joining', toDate(employee.doj)],
    ['Date of Birth', toDate(employee.dob)],
    ['PAN', employee.pan || '-'],
    ['Pay Mode', employee.pay_mode || '-'],
    ['LPA', employee.lpa ? String(employee.lpa) : '-'],
    ['Status', employee.is_active ? 'Active' : 'Inactive'],
  ];

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/admin/employees')}
        className="h-9 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="saas-card saas-section">
        <h1 className="text-2xl font-semibold text-slate-900">{employee.name}</h1>
        <p className="text-sm text-slate-500 mt-1">Employee profile, shift assignments, and attendance snapshot</p>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Present Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary.present_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Late Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary.late_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Leave Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary.leave_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Absent Days</p>
            <p className="text-lg font-semibold text-slate-900">{summary.absent_days || 0}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Work Hours</p>
            <p className="text-lg font-semibold text-slate-900">{toFixedHours(summary.total_working_hours)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Overtime</p>
            <p className="text-lg font-semibold text-slate-900">{toFixedHours(summary.overtime_hours)}</p>
          </div>
        </div>
      ) : null}

      <div className="saas-card overflow-hidden">
        <div className="divide-y divide-slate-200">
          {profileRows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="sm:col-span-2 text-sm text-slate-900 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Shift Assignment History</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Shift</th>
                <th className="px-2 py-2">Office</th>
                <th className="px-2 py-2">Policy</th>
                <th className="px-2 py-2">Effective From</th>
                <th className="px-2 py-2">Effective To</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {shiftAssignments.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={6}>No shift assignments found.</td>
                </tr>
              ) : (
                shiftAssignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{assignment.shift_name || '-'}</td>
                    <td className="px-2 py-2">{assignment.office_location || '-'}</td>
                    <td className="px-2 py-2">{assignment.policy || '-'}</td>
                    <td className="px-2 py-2">{toDate(assignment.effective_from)}</td>
                    <td className="px-2 py-2">{assignment.effective_to ? toDate(assignment.effective_to) : 'Open'}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          assignment.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent Attendance (Current Month)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Shift</th>
                <th className="px-2 py-2">In</th>
                <th className="px-2 py-2">Out</th>
                <th className="px-2 py-2">Hours</th>
                <th className="px-2 py-2">Overtime</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={7}>No attendance records for this month.</td>
                </tr>
              ) : (
                attendanceRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{toDate(row.date)}</td>
                    <td className="px-2 py-2">{row.shift_name || '-'}</td>
                    <td className="px-2 py-2">{toTime(row.punch_in_time)}</td>
                    <td className="px-2 py-2">{toTime(row.punch_out_time)}</td>
                    <td className="px-2 py-2">{toFixedHours(row.working_hours)}</td>
                    <td className="px-2 py-2">{toFixedHours(row.overtime_hours)}</td>
                    <td className="px-2 py-2">{row.status || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsPage;

