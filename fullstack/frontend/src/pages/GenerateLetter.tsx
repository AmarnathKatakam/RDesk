/**
 * Page: GenerateLetter.tsx
 * Multi-step letter generation: General → Select Employees → Preview → Publish/Download
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, ChevronRight, Download, Edit2, FileText, Search, X } from 'lucide-react';
import { letterAPI } from '@/services/api';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterType { value: string; label: string; }
interface Signatory { id: number; name: string; position: string; employee_id: string; }
interface EmployeeRow { id: number; name: string; employee_id: string; position: string; department: { department_name: string } | null; }
interface LetterPreview {
  employee_id: number; employee_code: string; employee_name: string;
  position: string; department: string; doj: string; location: string;
  letter_type: string; letter_label: string;
  signatory_name: string; signatory_position: string; generated_date: string;
}

// ─── Template registry ────────────────────────────────────────────────────────

const LETTER_TEMPLATES: LetterType[] = [
  { value: 'APPOINTMENT_ORDER',   label: 'Appointment Order'   },
  { value: 'CONFIRMATION_LETTER', label: 'Confirmation Letter' },
  { value: 'RELIEVING_LETTER',    label: 'Relieving Letter'    },
  { value: 'EXPERIENCE_LETTER',   label: 'Experience Letter'   },
  { value: 'OFFER_LETTER',        label: 'Offer Letter'        },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['General', 'Select Employees', 'Preview', 'Publish / Download'];

const StepBar: React.FC<{ current: number }> = ({ current }) => (
  <div className="flex items-center gap-0 mb-8">
    {STEPS.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1 min-w-[90px]">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
              done ? 'bg-emerald-500 border-emerald-500 text-white'
                   : active ? 'bg-blue-900 border-blue-900 text-white'
                   : 'bg-white border-slate-300 text-slate-400'
            }`}>
              {done ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium text-center leading-tight ${active ? 'text-blue-900' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-5 mx-1 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Summary panel ────────────────────────────────────────────────────────────

interface SummaryProps {
  letterType: LetterType | null;
  signatory: Signatory | null;
  selectedCount: number;
  onEditSignatory: () => void;
}

const SummaryPanel: React.FC<SummaryProps> = ({ letterType, signatory, selectedCount, onEditSignatory }) => (
  <div className="w-64 shrink-0">
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 sticky top-4">
      <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Letter Template</p>
          <p className="text-sm font-medium text-slate-800">{letterType?.label || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Authorised Signatory</p>
          {signatory ? (
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-sm font-medium text-slate-800">{signatory.name}</p>
                <p className="text-xs text-slate-500">{signatory.position}</p>
              </div>
              <button onClick={onEditSignatory} className="text-slate-400 hover:text-blue-600 mt-0.5">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Not selected</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Employees Selected</p>
          <p className="text-sm font-medium text-slate-800">{selectedCount > 0 ? selectedCount : '—'}</p>
        </div>
      </div>
    </div>
  </div>
);

// ─── Step 1: General ──────────────────────────────────────────────────────────

interface Step1Props {
  letterType: LetterType | null;
  setLetterType: (t: LetterType) => void;
  signatory: Signatory | null;
  setSignatory: (s: Signatory | null) => void;
  signatories: Signatory[];
  onNext: () => void;
}

const Step1General: React.FC<Step1Props> = ({ letterType, setLetterType, signatory, setSignatory, signatories, onNext }) => {
  const [sigSearch, setSigSearch] = useState('');
  const [showSigList, setShowSigList] = useState(false);
  const sigRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (sigRef.current && !sigRef.current.contains(e.target as Node)) setShowSigList(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredSig = signatories.filter(s =>
    s.name.toLowerCase().includes(sigSearch.toLowerCase()) ||
    s.position.toLowerCase().includes(sigSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Letter Template *</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LETTER_TEMPLATES.map(t => (
            <button
              key={t.value}
              onClick={() => setLetterType(t)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                letterType?.value === t.value
                  ? 'border-blue-900 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className={`h-5 w-5 shrink-0 ${letterType?.value === t.value ? 'text-blue-900' : 'text-slate-400'}`} />
              <span className="text-sm font-medium">{t.label}</span>
              {letterType?.value === t.value && <CheckCircle className="h-4 w-4 ml-auto text-blue-900" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Authorised Signatory / Approver</label>
        <div ref={sigRef} className="relative max-w-sm">
          <div
            className="h-10 rounded-xl border border-slate-200 px-3 flex items-center gap-2 cursor-pointer bg-white hover:border-slate-300"
            onClick={() => setShowSigList(v => !v)}
          >
            {signatory ? (
              <>
                <span className="text-sm text-slate-800 flex-1">{signatory.name}</span>
                <button onClick={(e) => { e.stopPropagation(); setSignatory(null); setSigSearch(''); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <span className="text-sm text-slate-400 flex-1">Select signatory…</span>
            )}
          </div>
          {showSigList && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white rounded-xl border border-slate-200 shadow-lg">
              <div className="p-2 border-b border-slate-100">
                <div className="flex items-center gap-2 h-8 px-2 rounded-lg bg-slate-50">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    autoFocus
                    value={sigSearch}
                    onChange={e => setSigSearch(e.target.value)}
                    placeholder="Search…"
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {filteredSig.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-3">No results</p>
                ) : filteredSig.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSignatory(s); setShowSigList(false); setSigSearch(''); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.position}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!letterType}
          className="h-9 px-5 rounded-xl bg-blue-900 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 hover:bg-blue-800 transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Step 2: Select Employees ─────────────────────────────────────────────────

interface Step2Props {
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  employees: EmployeeRow[];
  loadingEmployees: boolean;
  onNext: () => void;
  onBack: () => void;
}

const Step2SelectEmployees: React.FC<Step2Props> = ({ selectedIds, setSelectedIds, employees, loadingEmployees, onNext, onBack }) => {
  const [search, setSearch] = useState('');

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    (e.department?.department_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(e => e.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <span className="text-xs text-slate-500">{selectedIds.length} selected</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <input
            type="checkbox"
            checked={filtered.length > 0 && selectedIds.length === filtered.length}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-slate-300 accent-blue-900"
          />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Employee</span>
        </div>
        {loadingEmployees ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No employees found</div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {filtered.map(emp => (
              <label key={emp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(emp.id)}
                  onChange={() => toggle(emp.id)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-900"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                  <p className="text-xs text-slate-500">{emp.employee_id} · {emp.position} · {emp.department?.department_name || '—'}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="h-9 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedIds.length === 0}
          className="h-9 px-5 rounded-xl bg-blue-900 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 hover:bg-blue-800 transition-colors"
        >
          Preview <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Step 3: Preview ──────────────────────────────────────────────────────────

interface Step3Props {
  previews: LetterPreview[];
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
}

const LetterPreviewCard: React.FC<{ preview: LetterPreview }> = ({ preview }) => {
  const today = new Date(preview.generated_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const body: Record<string, string> = {
    APPOINTMENT_ORDER: `Dear ${preview.employee_name},\n\nWe are pleased to appoint you as ${preview.position} in our ${preview.department} department, effective ${preview.doj}.\n\nYou will be based at our ${preview.location} office. This appointment is subject to the terms and conditions of employment as communicated to you.\n\nWe look forward to your valuable contribution to the organisation.`,
    CONFIRMATION_LETTER: `Dear ${preview.employee_name},\n\nWe are pleased to confirm your employment as ${preview.position} in the ${preview.department} department with effect from ${preview.doj}.\n\nYour performance during the probation period has been satisfactory and we are happy to confirm you as a permanent employee of the organisation.`,
    RELIEVING_LETTER: `Dear ${preview.employee_name},\n\nThis is to certify that ${preview.employee_name} (Employee ID: ${preview.employee_code}) has been employed with us as ${preview.position} in the ${preview.department} department since ${preview.doj}.\n\nWe wish ${preview.employee_name} all the best in future endeavours.`,
    EXPERIENCE_LETTER: `To Whom It May Concern,\n\nThis is to certify that ${preview.employee_name} (Employee ID: ${preview.employee_code}) has worked with us as ${preview.position} in the ${preview.department} department from ${preview.doj}.\n\nDuring this period, ${preview.employee_name} has demonstrated excellent professional skills and dedication. We wish them continued success.`,
    OFFER_LETTER: `Dear ${preview.employee_name},\n\nWe are delighted to offer you the position of ${preview.position} in our ${preview.department} department at our ${preview.location} office.\n\nThis offer is subject to the terms and conditions discussed during the interview process. Please sign and return a copy of this letter as your acceptance.`,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 font-serif text-sm text-slate-800">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-base text-slate-900">BlackRoth Technologies</p>
          <p className="text-xs text-slate-500">HR Department</p>
        </div>
        <p className="text-xs text-slate-500">{today}</p>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="font-semibold text-center text-base underline mb-4">{preview.letter_label}</p>
        <p className="whitespace-pre-line leading-relaxed">{body[preview.letter_type] || `Letter content for ${preview.letter_label}.`}</p>
      </div>
      {preview.signatory_name && (
        <div className="border-t border-slate-100 pt-4 mt-6">
          <p className="text-xs text-slate-500">Authorised Signatory</p>
          <p className="font-semibold mt-1">{preview.signatory_name}</p>
          <p className="text-xs text-slate-500">{preview.signatory_position}</p>
        </div>
      )}
    </div>
  );
};

const Step3Preview: React.FC<Step3Props> = ({ previews, loading, onNext, onBack }) => (
  <div className="space-y-4">
    {loading ? (
      <div className="py-16 text-center text-sm text-slate-400">Generating preview…</div>
    ) : (
      <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
        {previews.map(p => <LetterPreviewCard key={p.employee_id} preview={p} />)}
      </div>
    )}
    <div className="flex justify-between pt-2">
      <button onClick={onBack} className="h-9 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
        Back
      </button>
      <button
        onClick={onNext}
        disabled={loading || previews.length === 0}
        className="h-9 px-5 rounded-xl bg-blue-900 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 hover:bg-blue-800 transition-colors"
      >
        Publish / Download <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

// ─── Step 4: Publish / Download ───────────────────────────────────────────────

interface Step4Props {
  previews: LetterPreview[];
  letterLabel: string;
  onBack: () => void;
  onReset: () => void;
}

const Step4Publish: React.FC<Step4Props> = ({ previews, letterLabel, onBack, onReset }) => {
  const downloadAll = () => {
    previews.forEach(p => {
      const content = [
        `${letterLabel.toUpperCase()}`,
        ``,
        `Employee: ${p.employee_name} (${p.employee_code})`,
        `Position: ${p.position}`,
        `Department: ${p.department}`,
        `Date of Joining: ${p.doj}`,
        `Generated: ${p.generated_date}`,
        ``,
        `Authorised Signatory: ${p.signatory_name || 'N/A'}`,
        `Designation: ${p.signatory_position || 'N/A'}`,
      ].join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${letterLabel.replace(/\s+/g, '_')}_${p.employee_code}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Letters ready</p>
          <p className="text-sm text-emerald-700 mt-0.5">{previews.length} {letterLabel} {previews.length === 1 ? 'letter' : 'letters'} generated successfully.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Generated Letters</p>
        </div>
        <div className="divide-y divide-slate-50">
          {previews.map(p => (
            <div key={p.employee_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{p.employee_name}</p>
                <p className="text-xs text-slate-500">{p.employee_code} · {p.position}</p>
              </div>
              <button
                onClick={() => {
                  const content = [`${letterLabel.toUpperCase()}`, ``, `Employee: ${p.employee_name} (${p.employee_code})`, `Position: ${p.position}`, `Department: ${p.department}`, `Date of Joining: ${p.doj}`, `Generated: ${p.generated_date}`, ``, `Authorised Signatory: ${p.signatory_name || 'N/A'}`, `Designation: ${p.signatory_position || 'N/A'}`].join('\n');
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${letterLabel.replace(/\s+/g, '_')}_${p.employee_code}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="h-9 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Back
        </button>
        <div className="flex gap-2">
          <button onClick={downloadAll} className="h-9 px-5 rounded-xl border border-blue-200 text-blue-900 text-sm font-medium inline-flex items-center gap-2 hover:bg-blue-50">
            <Download className="h-4 w-4" /> Download All
          </button>
          <button onClick={onReset} className="h-9 px-5 rounded-xl bg-blue-900 text-white text-sm font-medium hover:bg-blue-800 transition-colors">
            Generate Another
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const GenerateLetterPage: React.FC = () => {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [letterType, setLetterType] = useState<LetterType | null>(null);
  const [signatory, setSignatory] = useState<Signatory | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);

  // Step 2 state
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Step 3 state
  const [previews, setPreviews] = useState<LetterPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load signatories on mount
  useEffect(() => {
    letterAPI.getSignatories().then(res => {
      setSignatories(res.data?.signatories || []);
    }).catch(() => {});
  }, []);

  // Load employees when entering step 2
  useEffect(() => {
    if (step !== 1) return;
    setLoadingEmployees(true);
    api.get('/employees/').then(res => {
      const data = res.data;
      setEmployees(Array.isArray(data) ? data : (data?.results || data?.employees || []));
    }).catch(() => {}).finally(() => setLoadingEmployees(false));
  }, [step]);

  // Load preview when entering step 3
  useEffect(() => {
    if (step !== 2 || !letterType || selectedIds.length === 0) return;
    setLoadingPreview(true);
    letterAPI.previewLetter({
      letter_type: letterType.value,
      employee_ids: selectedIds,
      signatory_id: signatory?.id ?? null,
    }).then(res => {
      setPreviews(res.data?.previews || []);
    }).catch(() => setPreviews([])).finally(() => setLoadingPreview(false));
  }, [step]);

  const reset = useCallback(() => {
    setStep(0);
    setLetterType(null);
    setSignatory(null);
    setSelectedIds([]);
    setPreviews([]);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Generate Letter</h1>
        <p className="text-sm text-slate-500">Create and download HR letters for employees.</p>
      </div>

      <StepBar current={step} />

      <div className="flex gap-6 items-start">
        {/* Main content */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {step === 0 && (
            <Step1General
              letterType={letterType}
              setLetterType={setLetterType}
              signatory={signatory}
              setSignatory={setSignatory}
              signatories={signatories}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Step2SelectEmployees
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              employees={employees}
              loadingEmployees={loadingEmployees}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <Step3Preview
              previews={previews}
              loading={loadingPreview}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step4Publish
              previews={previews}
              letterLabel={letterType?.label || ''}
              onBack={() => setStep(2)}
              onReset={reset}
            />
          )}
        </div>

        {/* Summary panel */}
        <SummaryPanel
          letterType={letterType}
          signatory={signatory}
          selectedCount={selectedIds.length}
          onEditSignatory={() => setStep(0)}
        />
      </div>
    </div>
  );
};

export default GenerateLetterPage;
