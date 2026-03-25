/**
 * Component: components\GeneratePayslipsButton.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useMemo, useState } from 'react';
import { payslipAPI, employeeAPI } from '@/services/api';

type GeneratePayslipsButtonProps = {
  selectedEmployeeIds?: number[];
  defaultMonth?: string;
  defaultYear?: number;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

const MONTHS = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];

export default function GeneratePayslipsButton({
  selectedEmployeeIds,
  defaultMonth,
  defaultYear,
  onSuccess,
  onError,
}: GeneratePayslipsButtonProps) {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<string>(defaultMonth || MONTHS[now.getMonth()]);
  const [year, setYear] = useState<number>(defaultYear || now.getFullYear());
  const [loading, setLoading] = useState<boolean>(false);
  const [ids, setIds] = useState<string>('');

  const effectiveIds: number[] = useMemo(() => {
    if (selectedEmployeeIds && selectedEmployeeIds.length > 0) return selectedEmployeeIds;
    return ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
  }, [selectedEmployeeIds, ids]);

  async function handleGenerate() {
    if (!effectiveIds.length) {
      onError?.('Please provide at least one employee ID');
      return;
    }
    setLoading(true);
    try {
      await payslipAPI.bulkGenerate({
        employee_ids: effectiveIds,
        pay_period: { month, year },
        salary_method: 'SALARY',
      });
      onSuccess?.('Payslips generated and emailed successfully');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to generate payslips';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!selectedEmployeeIds && (
        <input
          type="text"
          className="border px-2 py-1 rounded"
          placeholder="Employee IDs (comma separated)"
          value={ids}
          onChange={(e) => setIds(e.target.value)}
        />
      )}
      <div className="flex gap-2 items-center">
        <select
          className="border px-2 py-1 rounded"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          className="border px-2 py-1 rounded w-24"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <button
          disabled={loading}
          onClick={handleGenerate}
          className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60"
        >
          {loading ? 'Generating…' : 'Generate & Email Payslips'}
        </button>
      </div>
      <p className="text-xs text-gray-600">Emails are sent automatically by the backend after generation.</p>
    </div>
  );
}



