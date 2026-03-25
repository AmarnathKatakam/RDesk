/**
 * Component: components\SendPayslipsPanel.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { payslipAPI } from '@/services/api';

type FileItem = {
  id: number;
  filename: string;
  path: string;
  size: number;
  created_at: string;
  employee_name: string;
  employee_id: string;
};

export default function SendPayslipsPanel() {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<string>(
    [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ][now.getMonth()]
  );
  const [year, setYear] = useState<number>(now.getFullYear());
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [overrideEmail, setOverrideEmail] = useState<string>('');
  const [result, setResult] = useState<string>('');

  async function loadFiles() {
    setLoading(true);
    setResult('');
    try {
      const res = await payslipAPI.getPayslipFiles(String(year), month);
      setFiles(res.data?.data || []);
      setSelected(new Set());
    } catch (e: any) {
      setFiles([]);
      setResult(e?.response?.data?.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map(f => f.id)));
    }
  }

  async function sendSelected() {
    if (!selected.size) {
      setResult('Select at least one payslip');
      return;
    }
    setSending(true);
    setResult('');
    try {
      const ids = Array.from(selected);
      const override = overrideEmail ? Object.fromEntries(ids.map(id => [String(id), overrideEmail])) : undefined;
      const res = await payslipAPI.sendSelected(ids, override);
      const { sent, failed } = res.data || {};
      setResult(`Sent: ${sent || 0}, Failed: ${failed || 0}`);
    } catch (e: any) {
      setResult(e?.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <select className="border px-2 py-1 rounded" value={month} onChange={e => setMonth(e.target.value)}>
          {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input type="number" className="border px-2 py-1 rounded w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
        <button disabled={loading} onClick={loadFiles} className="bg-gray-700 text-white px-3 py-1 rounded disabled:opacity-60">{loading ? 'Loading…' : 'Load Files'}</button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleAll} className="border px-2 py-1 rounded">{selected.size === files.length ? 'Unselect All' : 'Select All'}</button>
        <input type="email" className="border px-2 py-1 rounded" placeholder="Override email (optional)" value={overrideEmail} onChange={e => setOverrideEmail(e.target.value)} />
        <button disabled={sending} onClick={sendSelected} className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60">{sending ? 'Sending…' : 'Send Selected'}</button>
      </div>

      {result && <div className="text-sm">{result}</div>}

      <div className="max-h-80 overflow-auto border rounded">
        {files.map(f => {
          const checkboxId = `file-${f.id}`;
          return (
            <div key={f.id} className="flex items-center gap-3 px-3 py-2 border-b">
              <input
                id={checkboxId}
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={() => toggle(f.id)}
              />
              <label
                htmlFor={checkboxId}
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium">{f.filename}</div>
                <div className="text-xs text-gray-600">{f.employee_name} · {new Date(f.created_at).toLocaleString()}</div>
              </label>
              <div className="text-xs text-gray-600">{Math.round((f.size || 0)/1024)} KB</div>
            </div>
          );
        })}
        {!files.length && !loading && (
          <div className="p-3 text-sm text-gray-600">No files for {month} {year}</div>
        )}
      </div>
    </div>
  );
}







