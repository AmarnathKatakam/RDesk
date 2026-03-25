/**
 * Component: pages\Payroll.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Employee, PayPeriod, SalaryMethod } from '@/types';
import BulkEmployeeSelector from '@/components/BulkEmployeeSelector';
import PeriodSelector from '@/components/PeriodSelector';
import SalaryMethodSelector from '@/components/SalaryMethodSelector';
import BulkPayslipGenerator from '@/components/BulkPayslipGenerator';
import MonthlySalaryUpload from '@/components/MonthlySalaryUpload';
import ActualSalaryUpload from '@/components/ActualSalaryUpload';
import SendPayslipsPanel from '@/components/SendPayslipsPanel';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { employeeAPI, monthlySalaryAPI } from '@/services/api';

interface PayrollRow {
  id: string | number;
  employee_id?: string;
  employee_name?: string;
  month?: string;
  year?: number;
  total_earnings?: number;
  total_deductions?: number;
  net_pay?: number;
}

const monthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const normalizeList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const PayrollPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [payPeriod, setPayPeriod] = useState<PayPeriod>({
    month: monthOptions[new Date().getMonth()],
    year: String(new Date().getFullYear()),
  });
  const [salaryMethod, setSalaryMethod] = useState<SalaryMethod>('SALARY');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [loadingTable, setLoadingTable] = useState(false);

  useEffect(() => {
    const initializeSelectedEmployees = async () => {
      try {
        const selectedIds: number[] = JSON.parse(
          sessionStorage.getItem('rd_selected_employees') || '[]'
        );
        if (!selectedIds.length) return;
        const response = await employeeAPI.getAll();
        const allEmployees = normalizeList<Employee>(response.data);
        setSelectedEmployees(
          allEmployees.filter((employee) => selectedIds.includes(Number(employee.id)))
        );
        sessionStorage.removeItem('rd_selected_employees');
      } catch (error) {
        // ignore
      }
    };

    void initializeSelectedEmployees();
  }, []);

  useEffect(() => {
    void loadPayrollTable();
  }, [payPeriod.month, payPeriod.year]);

  const loadPayrollTable = async () => {
    try {
      setLoadingTable(true);
      const response = await monthlySalaryAPI.getByMonthYear(
        payPeriod.month,
        Number(payPeriod.year)
      );
      setPayrollRows(normalizeList<PayrollRow>(response.data));
    } catch (error) {
      setPayrollRows([]);
    } finally {
      setLoadingTable(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!departmentFilter) return payrollRows;
    return payrollRows.filter((row: any) =>
      String(row.department_id || row.department || '').includes(departmentFilter)
    );
  }, [payrollRows, departmentFilter]);

  const tableColumns: DataTableColumn<PayrollRow>[] = [
    { key: 'employee_id', header: 'Employee ID', render: (row) => row.employee_id || '-' },
    { key: 'employee_name', header: 'Name', render: (row) => row.employee_name || '-' },
    { key: 'month', header: 'Month', render: (row) => row.month || '-' },
    { key: 'year', header: 'Year', render: (row) => row.year || '-' },
    {
      key: 'total_earnings',
      header: 'Earnings',
      render: (row) =>
        `Rs ${Number(row.total_earnings || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'total_deductions',
      header: 'Deductions',
      render: (row) =>
        `Rs ${Number(row.total_deductions || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'net_pay',
      header: 'Net Pay',
      render: (row) => `Rs ${Number(row.net_pay || 0).toLocaleString('en-IN')}`,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payroll Management</h1>
        <p className="text-sm text-slate-500">Generate, upload, and distribute payroll data.</p>
      </div>

      <div className="saas-card saas-section">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={payPeriod.month}
            onChange={(event) =>
              setPayPeriod((prev) => ({ ...prev, month: event.target.value }))
            }
            className="h-10 rounded-xl border border-slate-200 px-3 bg-white text-sm"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={payPeriod.year}
            onChange={(event) =>
              setPayPeriod((prev) => ({ ...prev, year: event.target.value }))
            }
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="Year"
          />
          <input
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="Department filter"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="generate">Generate Payslips</TabsTrigger>
          <TabsTrigger value="upload">Upload Salary</TabsTrigger>
          <TabsTrigger value="actual">Actual Salary</TabsTrigger>
          <TabsTrigger value="send">Send Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <BulkEmployeeSelector
                selectedEmployees={selectedEmployees}
                onSelectionChange={setSelectedEmployees}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PeriodSelector payPeriod={payPeriod} onPeriodChange={setPayPeriod} />
                <SalaryMethodSelector
                  salaryMethod={salaryMethod}
                  onMethodChange={setSalaryMethod}
                />
              </div>
            </div>
            <div>
              <BulkPayslipGenerator
                selectedEmployees={selectedEmployees}
                payPeriod={payPeriod}
                salaryMethod={salaryMethod}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <MonthlySalaryUpload />
        </TabsContent>

        <TabsContent value="actual">
          <ActualSalaryUpload
            selectedEmployees={selectedEmployees}
            payPeriod={payPeriod}
          />
        </TabsContent>

        <TabsContent value="send">
          <div className="saas-card saas-section">
            <SendPayslipsPanel />
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Employee Payroll Table</h2>
        <DataTable
          columns={tableColumns}
          rows={filteredRows}
          keyExtractor={(row, index) => row.id || index}
          loading={loadingTable}
          emptyText="No payroll data found for selected period."
        />
      </div>
    </div>
  );
};

export default PayrollPage;

