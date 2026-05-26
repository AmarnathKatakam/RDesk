import React, { useState, useCallback } from 'react';
import { payrollReportsAPI } from '../services/api';
import PayrollNav from '../components/PayrollNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterRow {
  employee_id: string;
  employee_name: string;
  department: string;
  position: string;
  pan: string;
  pf_number: string;
  bank_account: string;
  bank_ifsc: string;
  pay_mode: string;
  lop_days: number;
  work_days: number;
  payable_days: number;
  days_in_month: number;
  gross_earnings: number;
  total_deductions: number;
  employer_contributions: number;
  net_pay: number;
  pf_employee: number;
  esi_employee: number;
  professional_tax: number;
  pf_employer: number;
  esi_employer: number;
  calculation_source: string;
  earnings_breakdown: Record<string, number>;
  deductions_breakdown: Record<string, number>;
}

interface BankRow {
  employee_id: string;
  employee_name: string;
  department: string;
  bank_account: string;
  bank_ifsc: string;
  pay_mode: string;
  net_pay: number;
}

interface DeptRow {
  department: string;
  employee_count: number;
  total_gross: number;
  total_deductions: number;
  total_employer_contributions: number;
  total_net: number;
}

interface VarianceRow {
  employee_id: string;
  employee_name: string;
  department: string;
  current_net: number;
  previous_net: number | null;
  change_amount: number | null;
  change_pct: number | null;
  flagged: boolean;
  is_new: boolean;
}

type TabKey = 'register' | 'bank' | 'department' | 'variance' | 'ytd';

interface YTDRow {
  employee_id: string;
  employee_name: string;
  department: string;
  monthly: Record<string, {
    month: string;
    year: number;
    gross: number;
    deductions: number;
    net: number;
    pf_employee: number;
    tds: number;
  }>;
  ytd_gross: number;
  ytd_deductions: number;
  ytd_net: number;
  ytd_pf_employee: number;
  ytd_tds: number;
  months_count: number;
}

interface YTDData {
  rows: YTDRow[];
  period: {
    start_month: string;
    start_year: number;
    end_month: string;
    end_year: number;
    months: number;
  };
  monthly_columns: { month: string; year: number }[];
  employee_count: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_pf_employee: number;
  total_tds: number;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number | null | undefined) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

const PayrollReports: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('register');
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(currentYear);
  const [salaryType, setSalaryType] = useState('SALARY');
  const [varianceThreshold, setVarianceThreshold] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Data state
  const [registerData, setRegisterData] = useState<{
    rows: RegisterRow[];
    summary: any;
    columns: { earning_codes: string[]; deduction_codes: string[] };
    run_status: string | null;
    employee_count: number;
  } | null>(null);

  const [bankData, setBankData] = useState<{
    rows: BankRow[];
    total_transfer_amount: number;
    employee_count: number;
  } | null>(null);

  const [deptData, setDeptData] = useState<{
    departments: DeptRow[];
    totals: any;
  } | null>(null);

  const [varianceData, setVarianceData] = useState<{
    rows: VarianceRow[];
    flagged_count: number;
    new_employees: number;
    current_period: any;
    previous_period: any;
    employee_count: number;
  } | null>(null);

  const [ytdData, setYtdData] = useState<YTDData | null>(null);

  const params = { month, year, salary_type: salaryType };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'register') {
        const resp = await payrollReportsAPI.getRegister(params);
        setRegisterData(resp.data);
      } else if (tab === 'bank') {
        const resp = await payrollReportsAPI.getBankTransfer(params);
        setBankData(resp.data);
      } else if (tab === 'department') {
        const resp = await payrollReportsAPI.getDepartmentSummary(params);
        setDeptData(resp.data);
      } else if (tab === 'variance') {
        const resp = await payrollReportsAPI.getVariance({ ...params, threshold: varianceThreshold });
        setVarianceData(resp.data);
      } else if (tab === 'ytd') {
        const resp = await payrollReportsAPI.getYTD(params);
        setYtdData(resp.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [tab, month, year, salaryType, varianceThreshold]);

  const handleExport = async () => {
    if (!canExport) return;
    
    setExporting(true);
    try {
      let blob: Blob;
      let filename: string;
      
      if (tab === 'register') {
        const resp = await payrollReportsAPI.exportRegister(params);
        blob = new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = `Payroll_Register_${month}_${year}.xlsx`;
      } else {
        const resp = await payrollReportsAPI.exportBankTransfer(params);
        blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8;' });
        filename = `Bank_Transfer_${month}_${year}.csv`;
      }
      
      downloadBlob(blob, filename);
    } catch (err: any) {
      setError(`Export failed: ${err?.response?.data?.message || err.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const canExport = tab === 'register' || tab === 'bank';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif', color: '#1e293b' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 600 }}>Payroll Reports</h2>
      <PayrollNav />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
        {([
          ['register', 'Payroll Register'],
          ['bank', 'Bank Transfer'],
          ['department', 'Department Summary'],
          ['variance', 'Variance Report'],
          ['ytd', 'Year to Date'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? '#3b82f6' : '#64748b',
              background: 'none',
              borderBottom: tab === key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <select value={month} onChange={e => setMonth(e.target.value)} style={selectStyle}>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={salaryType} onChange={e => setSalaryType(e.target.value)} style={selectStyle}>
          <option value="SALARY">Salary</option>
          <option value="STIPEND">Stipend</option>
        </select>
        {tab === 'variance' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            Flag threshold:
            <input
              type="number"
              value={varianceThreshold}
              onChange={e => setVarianceThreshold(Number(e.target.value))}
              style={{ ...selectStyle, width: '70px' }}
            />
            %
          </label>
        )}
        <button onClick={load} style={btnStyle('#3b82f6')} disabled={loading}>
          {loading ? 'Loading...' : 'Load Report'}
        </button>
        {canExport && (
          <button onClick={handleExport} style={btnStyle('#22c55e')} disabled={exporting || loading}>
            {exporting ? 'Exporting...' : tab === 'register' ? '⬇ Export Excel' : '⬇ Export CSV'}
          </button>
        )}
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {/* ── Register Tab ── */}
      {tab === 'register' && registerData && (
        <div>
          <SummaryCards data={[
            { label: 'Employees', value: registerData.employee_count.toString() },
            { label: 'Total Gross', value: fmt(registerData.summary.total_gross) },
            { label: 'Total Deductions', value: fmt(registerData.summary.total_deductions) },
            { label: 'Total Net Pay', value: fmt(registerData.summary.total_net), highlight: true },
            { label: 'Employer Cost', value: fmt(registerData.summary.total_employer_contributions) },
            { label: 'Run Status', value: registerData.run_status || 'No Run' },
          ]} />
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Emp ID', 'Name', 'Dept', 'LOP', 'Payable Days',
                    ...registerData.columns.earning_codes.map(c => `E:${c}`),
                    'Gross', 'Deductions', 'Net Pay', 'PF Emp', 'ESI Emp', 'PT', 'PF Employer',
                  ].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registerData.rows.map((row, i) => (
                  <tr key={row.employee_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={tdStyle}>{row.employee_id}</td>
                    <td style={tdStyle}>{row.employee_name}</td>
                    <td style={tdStyle}>{row.department}</td>
                    <td style={{ ...tdStyle, color: row.lop_days > 0 ? '#ef4444' : '#334155' }}>{row.lop_days}</td>
                    <td style={tdStyle}>{row.payable_days}/{row.days_in_month}</td>
                    {registerData.columns.earning_codes.map(code => (
                      <td key={code} style={tdStyle}>{fmt(row.earnings_breakdown[code] ?? 0)}</td>
                    ))}
                    <td style={tdStyle}>{fmt(row.gross_earnings)}</td>
                    <td style={tdStyle}>{fmt(row.total_deductions)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#15803d' }}>{fmt(row.net_pay)}</td>
                    <td style={tdStyle}>{fmt(row.pf_employee)}</td>
                    <td style={tdStyle}>{fmt(row.esi_employee)}</td>
                    <td style={tdStyle}>{fmt(row.professional_tax)}</td>
                    <td style={tdStyle}>{fmt(row.pf_employer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Bank Transfer Tab ── */}
      {tab === 'bank' && bankData && (
        <div>
          <SummaryCards data={[
            { label: 'Employees', value: bankData.employee_count.toString() },
            { label: 'Total Transfer', value: fmt(bankData.total_transfer_amount), highlight: true },
          ]} />
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Emp ID', 'Name', 'Department', 'Bank Account', 'IFSC', 'Pay Mode', 'Net Pay'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bankData.rows.map((row, i) => (
                  <tr key={row.employee_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={tdStyle}>{row.employee_id}</td>
                    <td style={tdStyle}>{row.employee_name}</td>
                    <td style={tdStyle}>{row.department}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.bank_account}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.bank_ifsc}</td>
                    <td style={tdStyle}>{row.pay_mode}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#15803d' }}>{fmt(row.net_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Department Summary Tab ── */}
      {tab === 'department' && deptData && (
        <div>
          <SummaryCards data={[
            { label: 'Departments', value: deptData.departments.length.toString() },
            { label: 'Total Employees', value: deptData.totals.employee_count.toString() },
            { label: 'Total Gross', value: fmt(deptData.totals.total_gross) },
            { label: 'Total Net', value: fmt(deptData.totals.total_net), highlight: true },
          ]} />
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Department', 'Employees', 'Total Gross', 'Total Deductions', 'Employer Cost', 'Total Net'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptData.departments.map((row, i) => (
                  <tr key={row.department} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{row.department}</td>
                    <td style={tdStyle}>{row.employee_count}</td>
                    <td style={tdStyle}>{fmt(row.total_gross)}</td>
                    <td style={tdStyle}>{fmt(row.total_deductions)}</td>
                    <td style={tdStyle}>{fmt(row.total_employer_contributions)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#15803d' }}>{fmt(row.total_net)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <td style={tdStyle}>TOTAL</td>
                  <td style={tdStyle}>{deptData.totals.employee_count}</td>
                  <td style={tdStyle}>{fmt(deptData.totals.total_gross)}</td>
                  <td style={tdStyle}>{fmt(deptData.totals.total_deductions)}</td>
                  <td style={tdStyle}>—</td>
                  <td style={{ ...tdStyle, color: '#15803d' }}>{fmt(deptData.totals.total_net)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Variance Tab ── */}
      {tab === 'variance' && varianceData && (
        <div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            Comparing {varianceData.current_period.month} {varianceData.current_period.year} vs{' '}
            {varianceData.previous_period.month} {varianceData.previous_period.year}
          </div>
          <SummaryCards data={[
            { label: 'Employees', value: varianceData.employee_count.toString() },
            { label: 'Flagged (>{varianceThreshold}%)', value: varianceData.flagged_count.toString(), highlight: varianceData.flagged_count > 0 },
            { label: 'New Employees', value: varianceData.new_employees.toString() },
          ]} />
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Emp ID', 'Name', 'Department', 'Current Net', 'Previous Net', 'Change', 'Change %', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {varianceData.rows.map((row, i) => {
                  const isIncrease = (row.change_amount ?? 0) > 0;
                  const isDecrease = (row.change_amount ?? 0) < 0;
                  return (
                    <tr key={row.employee_id} style={{
                      background: row.flagged ? '#fef9c3' : i % 2 === 0 ? '#fff' : '#f8fafc',
                    }}>
                      <td style={tdStyle}>{row.employee_id}</td>
                      <td style={tdStyle}>{row.employee_name}</td>
                      <td style={tdStyle}>{row.department}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(row.current_net)}</td>
                      <td style={tdStyle}>{row.previous_net != null ? fmt(row.previous_net) : '—'}</td>
                      <td style={{
                        ...tdStyle,
                        color: isIncrease ? '#15803d' : isDecrease ? '#ef4444' : '#334155',
                        fontWeight: 500,
                      }}>
                        {row.change_amount != null ? fmt(row.change_amount) : '—'}
                      </td>
                      <td style={{
                        ...tdStyle,
                        color: isIncrease ? '#15803d' : isDecrease ? '#ef4444' : '#334155',
                        fontWeight: 500,
                      }}>
                        {pct(row.change_pct)}
                      </td>
                      <td style={tdStyle}>
                        {row.is_new ? (
                          <span style={badge('#dbeafe', '#1d4ed8')}>New</span>
                        ) : row.flagged ? (
                          <span style={badge('#fef9c3', '#92400e')}>⚠ Flagged</span>
                        ) : (
                          <span style={badge('#f0fdf4', '#15803d')}>OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ytd' && ytdData && (
        <div>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            Year-to-date totals from {ytdData.period.start_month} {ytdData.period.start_year} through {ytdData.period.end_month} {ytdData.period.end_year} ({ytdData.period.months} months)
          </div>
          <SummaryCards data={[
            { label: 'Employees', value: ytdData.employee_count.toString() },
            { label: 'Total Gross', value: fmt(ytdData.total_gross) },
            { label: 'Total Deductions', value: fmt(ytdData.total_deductions) },
            { label: 'Total Net', value: fmt(ytdData.total_net), highlight: true },
            { label: 'PF Employee YTD', value: fmt(ytdData.total_pf_employee) },
            { label: 'TDS YTD', value: fmt(ytdData.total_tds) },
          ]} />
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Emp ID', 'Name', 'Department',
                    ...ytdData.monthly_columns.map(col => `${col.month.substring(0, 3)} ${col.year}`),
                    'YTD Net'
                  ].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ytdData.rows.map((row, i) => (
                  <tr key={row.employee_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={tdStyle}>{row.employee_id}</td>
                    <td style={tdStyle}>{row.employee_name}</td>
                    <td style={tdStyle}>{row.department}</td>
                    {ytdData.monthly_columns.map(col => {
                      const monthKey = `${col.month}_${col.year}`;
                      const monthData = row.monthly[monthKey];
                      return (
                        <td key={monthKey} style={{ ...tdStyle, fontWeight: 600, color: '#15803d' }}>
                          {monthData ? fmt(monthData.net) : '—'}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#15803d' }}>{fmt(row.ytd_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !registerData && !bankData && !deptData && !varianceData && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' }}>
          Select a period and click "Load Report" to view data.
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCards: React.FC<{ data: { label: string; value: string; highlight?: boolean }[] }> = ({ data }) => (
  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
    {data.map(card => (
      <div key={card.label} style={{
        background: card.highlight ? '#1e3a5f' : '#f8fafc',
        color: card.highlight ? '#fff' : '#334155',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 20px',
        minWidth: '140px',
      }}>
        <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {card.label}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>{card.value}</div>
      </div>
    ))}
  </div>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
  fontSize: '13px', background: '#fff', cursor: 'pointer',
};

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', borderRadius: '6px',
  padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
});

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '12px',
  border: '1px solid #e2e8f0',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: '11px',
  fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: '12px', color: '#334155',
  borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
};

const badge = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, padding: '2px 8px', borderRadius: '12px',
  fontSize: '11px', fontWeight: 500,
});

export default PayrollReports;
