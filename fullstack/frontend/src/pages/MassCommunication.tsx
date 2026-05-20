/**
 * Page: MassCommunication.tsx
 * Admin announcement broadcast — compose and send to all employees.
 * Each employee receives a personalized notification with their name + ID.
 */
import React, { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle, ChevronDown, Megaphone, Send, Trash2, Users, X } from 'lucide-react';
import { announcementAPI } from '@/services/api';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Announcement {
  id: number;
  title: string;
  category: string;
  subject: string;
  body: string;
  recipient_filter: string;
  total_recipients: number;
  sent_by: string;
  created_at: string;
}

interface Department { id: number; department_name: string; }

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'GENERAL',  label: 'General',       color: 'bg-slate-100 text-slate-700'   },
  { value: 'HR',       label: 'HR',             color: 'bg-blue-100 text-blue-700'     },
  { value: 'PAYROLL',  label: 'Payroll',        color: 'bg-emerald-100 text-emerald-700' },
  { value: 'POLICY',   label: 'Policy Update',  color: 'bg-violet-100 text-violet-700' },
  { value: 'EVENT',    label: 'Event',          color: 'bg-amber-100 text-amber-700'   },
  { value: 'URGENT',   label: 'Urgent',         color: 'bg-rose-100 text-rose-700'     },
];

const categoryColor = (v: string) => CATEGORIES.find(c => c.value === v)?.color ?? 'bg-slate-100 text-slate-700';
const categoryLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v;

// ─── Compose form ─────────────────────────────────────────────────────────────

interface ComposeFormProps {
  departments: Department[];
  onSent: () => void;
}

const EMPTY_FORM = { title: '', category: 'GENERAL', subject: '', body: '', recipient_filter: 'ALL' };

const ComposeForm: React.FC<ComposeFormProps> = ({ departments, onSent }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.subject || !form.body) return;
    setSending(true);
    setResult(null);
    try {
      const res = await announcementAPI.send(form);
      const data = res.data as { total_recipients?: number; emails_sent?: number; emails_failed?: number; message?: string };
      const msg = data.message ?? `Sent to ${data.total_recipients ?? 0} employee(s).`;
      setResult({ ok: true, msg });
      setForm(EMPTY_FORM);
      onSent();
    } catch {
      setResult({ ok: false, msg: 'Failed to send. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-5">
      {/* Category + Recipient row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Category</label>
          <div className="relative">
            <select
              value={form.category}
              onChange={set('category')}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-900/20"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Employee Filter</label>
          <div className="relative">
            <select
              value={form.recipient_filter}
              onChange={set('recipient_filter')}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-900/20"
            >
              <option value="ALL">All Employees</option>
              {departments.map(d => <option key={d.id} value={String(d.id)}>{d.department_name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Title *</label>
        <input
          value={form.title}
          onChange={set('title')}
          required
          placeholder="e.g. Office Closure Notice"
          className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Subject *</label>
        <input
          value={form.subject}
          onChange={set('subject')}
          required
          placeholder="e.g. Important: Office will be closed on 25th March"
          className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Message Content *</label>
        <div className="rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-900/20">
          <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">Personalization: each employee receives their name and ID automatically.</span>
          </div>
          <textarea
            ref={textareaRef}
            value={form.body}
            onChange={set('body')}
            required
            rows={7}
            placeholder="Write your announcement here. Each employee will receive this message addressed with their name and employee ID."
            className="w-full px-3 py-3 text-sm resize-none focus:outline-none bg-white"
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Delivered as: "Dear [Employee Name] ([Employee ID]), [your message]"
        </p>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {result.ok
            ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-600" />}
          <span>{result.msg}</span>
          <button type="button" onClick={() => setResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Send button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={sending || !form.title || !form.subject || !form.body}
          className="h-10 px-6 rounded-xl bg-blue-900 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 hover:bg-blue-800 transition-colors"
        >
          <Send className="h-4 w-4" />
          {sending ? 'Sending…' : 'Send to All Employees'}
        </button>
      </div>
    </form>
  );
};

// ─── Sent list ────────────────────────────────────────────────────────────────

interface SentListProps {
  items: Announcement[];
  loading: boolean;
  onDelete: (id: number) => void;
}

const SentList: React.FC<SentListProps> = ({ items, loading, onDelete }) => {
  if (loading) return <div className="py-10 text-center text-sm text-slate-400">Loading…</div>;
  if (items.length === 0) return (
    <div className="py-12 text-center">
      <Megaphone className="h-8 w-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-400">No announcements sent yet.</p>
    </div>
  );

  return (
    <div className="divide-y divide-slate-50">
      {items.map(item => (
        <div key={item.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(item.category)}`}>
                  {categoryLabel(item.category)}
                </span>
                <span className="text-xs text-slate-400">{format(parseISO(item.created_at), 'dd MMM yyyy, hh:mm a')}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">{item.subject}</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.body}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  {item.total_recipients} recipient{item.total_recipients !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-slate-400">
                  {item.recipient_filter === 'ALL' ? 'All Employees' : `Dept #${item.recipient_filter}`}
                </span>
                <span className="text-xs text-slate-400">by {item.sent_by}</span>
              </div>
            </div>
            <button
              onClick={() => onDelete(item.id)}
              className="h-8 w-8 rounded-lg border border-rose-100 text-rose-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center shrink-0 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const MassCommunicationPage: React.FC = () => {
  const [tab, setTab] = useState<'compose' | 'sent'>('compose');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const loadAnnouncements = async () => {
    setLoadingList(true);
    try {
      const res = await announcementAPI.list();
      setAnnouncements((res.data as { announcements?: Announcement[] }).announcements ?? []);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadAnnouncements();
    api.get('/departments/').then(res => {
      const data = res.data as { departments?: Department[] } | Department[];
      setDepartments(Array.isArray(data) ? data : (data.departments ?? []));
    }).catch(() => {});
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await announcementAPI.delete(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch {
      alert('Failed to delete.');
    }
  };

  const handleSent = () => {
    void loadAnnouncements();
    setTab('sent');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mass Communication</h1>
          <p className="text-sm text-slate-500">Broadcast announcements to all employees. Each employee receives a personalized message.</p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setTab('compose')}
            className={`h-8 px-4 rounded-lg text-sm font-medium transition-all ${tab === 'compose' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Compose
          </button>
          <button
            onClick={() => { setTab('sent'); void loadAnnouncements(); }}
            className={`h-8 px-4 rounded-lg text-sm font-medium transition-all ${tab === 'sent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sent ({announcements.length})
          </button>
        </div>
      </div>

      {tab === 'compose' && (
        <div className="flex gap-6 items-start">
          {/* Compose card */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-8 w-8 rounded-lg bg-blue-900 flex items-center justify-center">
                <Megaphone className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">New Announcement</p>
                <p className="text-xs text-slate-500">Compose and send to employees</p>
              </div>
            </div>
            <ComposeForm departments={departments} onSent={handleSent} />
          </div>

          {/* Info panel */}
          <div className="w-64 shrink-0 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">How it works</p>
              <ol className="space-y-2.5 text-xs text-slate-500 list-none">
                {[
                  'Select a category and employee filter',
                  'Write your subject and message',
                  'Click Send — system delivers to all matching employees',
                  'Each employee sees their name and ID in the message',
                  'Employees can view it in their Notifications',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-semibold">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">Personalization</p>
              <p className="text-xs text-amber-700">Every employee receives the message as:<br /><span className="font-medium">"Dear [Name] ([ID]), …"</span></p>
            </div>
          </div>
        </div>
      )}

      {tab === 'sent' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Sent Announcements</p>
            <span className="text-xs text-slate-400">{announcements.length} total</span>
          </div>
          <SentList items={announcements} loading={loadingList} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
};

export default MassCommunicationPage;
