/**
 * TopBar — shared top navigation bar.
 * Used by both Admin and Employee layouts.
 * Left: leftIcon slot (caller provides the single toggle icon) + BrandMark
 * Right: search (optional) + notifications + user + logout
 */


import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search } from 'lucide-react';

import BrandMark from './BrandMark';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';


interface SearchTopic {
  title: string;
  path: string;
  keywords: string[];
}

const SEARCH_TOPICS: SearchTopic[] = [
  { title: 'Dashboard', path: '/admin/dashboard', keywords: ['dashboard', 'home', 'welcome'] },

  { title: 'Employees', path: '/admin/employees', keywords: ['employee', 'employees', 'staff', 'add employee', 'regenerate password'] },
  { title: 'Employee Analytics', path: '/admin/employees/analytics', keywords: ['employee analytics', 'employee report'] },
  { title: 'Org Chart', path: '/admin/employees/org-chart', keywords: ['org chart', 'organization', 'hierarchy', 'manager'] },
  { title: 'Bank PF ESI', path: '/admin/employees/bank-pf-esi', keywords: ['bank', 'pf', 'esi', 'uan', 'ifsc'] },
  { title: 'Family Details', path: '/admin/employees/family-details', keywords: ['family', 'dependents'] },
  { title: 'Generate Letter', path: '/admin/employees/generate-letter', keywords: ['letter', 'offer letter', 'relieving letter'] },

  { title: 'Payroll Dashboard', path: '/admin/payroll', keywords: ['payroll', 'process payroll'] },
  { title: 'Payroll Preview', path: '/admin/payroll/preview', keywords: ['payroll preview', 'salary preview'] },
  { title: 'Payroll Runs', path: '/admin/payroll/runs', keywords: ['payroll runs', 'run history'] },
  { title: 'Salary Templates', path: '/admin/payroll/salary-templates', keywords: ['salary templates', 'salary structure'] },
  { title: 'Salary Assignments', path: '/admin/payroll/salary-assignments', keywords: ['salary assignments', 'ctc'] },
  { title: 'Monthly Inputs', path: '/admin/payroll/monthly-inputs', keywords: ['monthly inputs', 'bonus', 'deduction'] },
  { title: 'Payroll Reports', path: '/admin/payroll/reports', keywords: ['payroll reports', 'salary report'] },
  { title: 'Tax Declarations', path: '/admin/payroll/tax-declarations', keywords: ['tax declarations', 'investment declarations'] },
  { title: 'Tax Summary', path: '/admin/payroll/tax-summary', keywords: ['tax summary', 'tds'] },

  { title: 'Attendance', path: '/admin/attendance', keywords: ['attendance', 'muster', 'shift', 'punch'] },
  { title: 'Leaves', path: '/admin/leaves', keywords: ['leave', 'leaves', 'leave requests', 'leave approvals'] },
  { title: 'Documents', path: '/admin/documents', keywords: ['documents', 'files', 'vault'] },
  { title: 'Directory', path: '/admin/directory', keywords: ['directory', 'contacts'] },
  { title: 'Emails', path: '/admin/emails', keywords: ['emails', 'mail', 'communication', 'announcement'] },
  { title: 'Notifications', path: '/admin/notifications', keywords: ['notifications', 'alerts'] },
  { title: 'Settings', path: '/admin/settings', keywords: ['settings', 'company', 'smtp', 'currency'] },
];

interface TopBarProps {
  /** Single icon rendered at the far left — caller owns this (9-dot, hamburger, etc.) */
  leftIcon: React.ReactNode;
  userName: string;
  userRole?: string;
  onLogout: () => void;
  showSearch?: boolean;
  onIconClick?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  leftIcon,
  userName,
  userRole,
  onLogout,
  showSearch = true,
  onIconClick,
}) => {
 

  const navigate = useNavigate();
const [search, setSearch] = useState('');

const filteredTopics = useMemo(() => {
  const query = search.trim().toLowerCase();
  if (!query) return [];

  return SEARCH_TOPICS.filter((topic) => {
    const searchableValues = [topic.title, ...topic.keywords];

    return searchableValues.some((value) => {
      const normalizedValue = value.toLowerCase();
      const words = normalizedValue.split(/\s+/);

      return (
        normalizedValue.startsWith(query) ||
        words.some((word) => word.startsWith(query))
      );
    });
  }).slice(0, 8);
}, [search]);

const handleTopicClick = (path: string) => {
  navigate(path);
  setSearch('');
};

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-slate-200 shadow-sm">
      <div className="h-full px-3 sm:px-5 flex items-center gap-2">

        {/* Single left icon — provided by caller */}
        {leftIcon}

        {/* Brand */}
        <BrandMark compact className="shrink-0 mr-2" onIconClick={onIconClick} />

        {/* Search */}
        {showSearch && (
          <div className="flex-1 max-w-md mx-auto hidden sm:block">
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && filteredTopics[0]) {
          handleTopicClick(filteredTopics[0].path);
        }
      }}
      placeholder="Search..."
      className="w-full h-8 pl-8 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
    />

    {filteredTopics.length > 0 && (
      <div className="absolute left-0 right-0 top-10 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        {filteredTopics.map((topic) => (
          <button
            key={topic.path}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTopicClick(topic.path)}
            className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
          >
            {topic.title}
          </button>
        ))}
      </div>
    )}
  </div>
</div>

        )}

        {/* Right */}
        <div className="flex items-center gap-1.5 ml-auto">
          <NotificationBell />

          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
            <Avatar name={userName} size="sm" />
            <div className="leading-tight">
              <p className="text-xs font-semibold text-slate-900 max-w-[90px] truncate">{userName}</p>
              {userRole && <p className="text-[10px] text-slate-400">{userRole}</p>}
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Logout"
            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
