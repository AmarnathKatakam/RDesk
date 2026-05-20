import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, Search, Users, UserCheck,
  ArrowRightLeft, Star, X, Check, RefreshCw, User,
} from 'lucide-react';
import { orgChartAPI, employeeAPI } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgNode {
  id: number;
  employee_id: string;
  name: string;
  position: string;
  department: string;
  location: string;
  is_active: boolean;
  is_top_level_manager: boolean;
  reporting_manager_id: number | null;
  reporting_manager_name: string | null;
  children?: OrgNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeList = <T,>(p: any): T[] => {
  if (Array.isArray(p)) return p;
  if (Array.isArray(p?.results)) return p.results;
  if (Array.isArray(p?.data)) return p.data;
  return [];
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

// ─── Org node card ────────────────────────────────────────────────────────────

const OrgNodeCard: React.FC<{
  node: OrgNode;
  depth: number;
  onNavigate: (id: number) => void;
}> = ({ node, depth, onNavigate }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className={`relative bg-white rounded-xl border shadow-sm px-4 py-3 w-44 text-center cursor-pointer hover:shadow-md transition-all ${
          node.is_top_level_manager ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'
        }`}
        onClick={() => onNavigate(node.id)}
      >
        {node.is_top_level_manager && (
          <Star className="absolute top-1.5 right-1.5 h-3 w-3 text-amber-400 fill-amber-400" />
        )}
        <div className={`h-10 w-10 rounded-full ${avatarColor(node.name)} flex items-center justify-center mx-auto mb-2`}>
          <span className="text-white text-sm font-bold">{getInitials(node.name)}</span>
        </div>
        <p className="text-xs font-semibold text-slate-800 truncate">{node.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{node.position || node.department}</p>
        <p className="text-[10px] text-slate-300">{node.employee_id}</p>
      </div>

      {/* Expand toggle */}
      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="mt-1 h-5 w-5 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:bg-slate-50 z-10"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-2 flex gap-6 relative">
          {/* Connector line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-3 bg-slate-200" />
          <div className="absolute top-3 left-0 right-0 h-px bg-slate-200" />
          {node.children!.map((child) => (
            <div key={child.id} className="flex flex-col items-center relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-3 bg-slate-200" />
              <div className="mt-3">
                <OrgNodeCard node={child} depth={depth + 1} onNavigate={onNavigate} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Assign Manager Dialog ────────────────────────────────────────────────────

const AssignManagerDialog: React.FC<{
  employees: OrgNode[];
  selectedIds: number[];
  onClose: () => void;
  onSave: (managerId: number | null) => Promise<void>;
  title: string;
}> = ({ employees, selectedIds, onClose, onSave, title }) => {
  const [managerId, setManagerId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return employees.filter(
      (e) => !selectedIds.includes(e.id) && (e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q))
    );
  }, [employees, selectedIds, query]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(managerId === '' ? null : managerId); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>

        <p className="text-xs text-slate-500 mb-3">{selectedIds.length} employee(s) selected</p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search manager…"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
        </div>

        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 mb-4">
          <button
            onClick={() => setManagerId('')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 ${managerId === '' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}
          >
            <span className="text-slate-400 italic">— Remove manager (unassign)</span>
          </button>
          {filtered.map((e) => (
            <button key={e.id} onClick={() => setManagerId(e.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 border-t border-slate-50 ${managerId === e.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <div className={`h-6 w-6 rounded-full ${avatarColor(e.name)} flex items-center justify-center shrink-0`}>
                <span className="text-white text-[10px] font-bold">{getInitials(e.name)}</span>
              </div>
              <span className="font-medium truncate">{e.name}</span>
              <span className="text-xs text-slate-400 ml-auto shrink-0">{e.employee_id}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-4 rounded-xl bg-blue-900 text-white text-sm disabled:opacity-60 inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Mass Transfer Dialog ─────────────────────────────────────────────────────

const MassTransferDialog: React.FC<{
  managers: OrgNode[];
  onClose: () => void;
  onSave: (fromId: number, toId: number) => Promise<void>;
}> = ({ managers, onClose, onSave }) => {
  const [fromId, setFromId] = useState<number | ''>('');
  const [toId, setToId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fromId || !toId) return;
    setSaving(true);
    try { await onSave(fromId, toId); onClose(); }
    finally { setSaving(false); }
  };

  const ManagerSelect: React.FC<{ value: number | ''; onChange: (v: number) => void; exclude?: number | '' }> = ({ value, onChange, exclude }) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm bg-white outline-none focus:border-blue-400">
      <option value="">Select manager</option>
      {managers.filter((m) => m.id !== exclude).map((m) => (
        <option key={m.id} value={m.id}>{m.name} ({m.employee_id})</option>
      ))}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Mass Transfer</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">From Manager</label>
            <ManagerSelect value={fromId} onChange={setFromId} exclude={toId} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">To Manager</label>
            <ManagerSelect value={toId} onChange={setToId} exclude={fromId} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600">Cancel</button>
          <button onClick={handleSave} disabled={saving || !fromId || !toId}
            className="h-9 px-4 rounded-xl bg-blue-900 text-white text-sm disabled:opacity-60 inline-flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />{saving ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const OrgChartPage: React.FC = () => {
  const navigate = useNavigate();
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [unassigned, setUnassigned] = useState<OrgNode[]>([]);
  const [allEmployees, setAllEmployees] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [unassignedQuery, setUnassignedQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dialog, setDialog] = useState<'assign-manager' | 'assign-top-level' | 'mass-transfer' | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const [treeRes, empRes] = await Promise.all([
        orgChartAPI.getTree(),
        employeeAPI.getAll(),
      ]);
      setTree(treeRes.data?.tree || []);
      setUnassigned(treeRes.data?.unassigned || []);
      setAllEmployees(normalizeList<OrgNode>(empRes.data));
    } catch (e) {
      showToast('error', 'Failed to load org chart.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const managers = useMemo(() =>
    allEmployees.filter((e) => e.is_top_level_manager || tree.some((n) => n.id === e.id)),
    [allEmployees, tree]
  );

  const filteredUnassigned = useMemo(() => {
    const q = unassignedQuery.toLowerCase();
    return q ? unassigned.filter((e) => e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q)) : unassigned;
  }, [unassigned, unassignedQuery]);

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleAssignManager = async (managerId: number | null) => {
    await orgChartAPI.assignManager(selectedIds, managerId);
    showToast('success', `Manager ${managerId ? 'assigned' : 'removed'} successfully.`);
    setSelectedIds([]);
    await load(true);
  };

  const handleAssignTopLevel = async (managerId: number | null) => {
    await orgChartAPI.assignTopLevel(selectedIds, true);
    showToast('success', 'Top-level manager(s) assigned.');
    setSelectedIds([]);
    await load(true);
  };

  const handleMassTransfer = async (fromId: number, toId: number) => {
    await orgChartAPI.massTransfer(fromId, toId);
    showToast('success', 'Employees transferred successfully.');
    await load(true);
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-[60] rounded-xl border px-4 py-3 text-sm shadow-lg ${
          toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>{toast.msg}</div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-400">
        <button onClick={() => navigate('/admin/employees')} className="hover:text-slate-600">Home</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate('/admin/employees')} className="hover:text-slate-600">Employee</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-600 font-medium">Organisation Chart</span>
      </nav>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chart…"
            className="h-9 w-52 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-400" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-1">{selectedIds.length} selected</span>
          )}
          <button onClick={() => setDialog('assign-top-level')} disabled={selectedIds.length === 0}
            className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-400" /> Assign Top Level Manager
          </button>
          <button onClick={() => setDialog('mass-transfer')}
            className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Mass Transfer
          </button>
          <button onClick={() => setDialog('assign-manager')} disabled={selectedIds.length === 0}
            className="h-9 px-3 rounded-xl bg-blue-900 text-white text-sm hover:bg-blue-800 disabled:opacity-40 inline-flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Assign Manager
          </button>
          <button onClick={() => void load(true)} className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Chart canvas */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-auto min-h-[500px] p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading org chart…</div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm gap-2">
              <Users className="h-10 w-10 text-slate-200" />
              <p>No top-level managers assigned yet.</p>
              <p className="text-xs">Select employees from the Unassigned panel and click "Assign Top Level Manager".</p>
            </div>
          ) : (
            <div className="flex gap-12 flex-wrap">
              {tree
                .filter((n) => !query || n.name.toLowerCase().includes(query.toLowerCase()))
                .map((node) => (
                  <OrgNodeCard key={node.id} node={node} depth={0} onNavigate={(id) => navigate(`/admin/employees/${id}/profile`)} />
                ))}
            </div>
          )}
        </div>

        {/* Unassigned panel */}
        <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Unassigned</span>
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{unassigned.length}</span>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input value={unassignedQuery} onChange={(e) => setUnassignedQuery(e.target.value)} placeholder="Search"
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredUnassigned.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">All employees assigned</p>
            ) : (
              filteredUnassigned.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => toggleSelect(emp.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    selectedIds.includes(emp.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full ${avatarColor(emp.name)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-bold">{getInitials(emp.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{emp.name}</p>
                    <p className="text-[10px] text-slate-400">{emp.employee_id}</p>
                  </div>
                  {selectedIds.includes(emp.id) && <Check className="h-3.5 w-3.5 text-blue-500 ml-auto shrink-0" />}
                </div>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            Click to select · then use action buttons above
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {dialog === 'assign-manager' && (
        <AssignManagerDialog
          employees={allEmployees}
          selectedIds={selectedIds}
          onClose={() => setDialog(null)}
          onSave={handleAssignManager}
          title="Assign Reporting Manager"
        />
      )}
      {dialog === 'assign-top-level' && (
        <AssignManagerDialog
          employees={allEmployees}
          selectedIds={selectedIds}
          onClose={() => setDialog(null)}
          onSave={handleAssignTopLevel}
          title="Assign as Top Level Manager"
        />
      )}
      {dialog === 'mass-transfer' && (
        <MassTransferDialog
          managers={allEmployees}
          onClose={() => setDialog(null)}
          onSave={handleMassTransfer}
        />
      )}
    </div>
  );
};

export default OrgChartPage;
