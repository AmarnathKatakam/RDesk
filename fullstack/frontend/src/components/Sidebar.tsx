/**
 * Component: components\Sidebar.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BrandMark from './BrandMark';

export interface SidebarItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  items: SidebarItem[];
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ items, collapsed, onToggle }) => {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-slate-200 bg-white/95 backdrop-blur transition-all duration-300 ${
        collapsed ? 'w-[84px]' : 'w-72'
      }`}
    >
      <div className="h-16 border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <BrandMark
            compact
            className={collapsed ? 'text-lg shrink-0' : 'text-2xl shrink-0'}
          />
        </div>
        <button
          onClick={onToggle}
          className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-64px)]">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

