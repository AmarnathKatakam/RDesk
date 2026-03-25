/**
 * Component: components\layout\Sidebar.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText, 
  Clock, 
  Calendar, 
  FileStack, 
  BookOpen, 
  Mail, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandMark from '../BrandMark';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
  { icon: Users, label: 'Employees', path: '/admin/employees' },
  { icon: Wallet, label: 'Payroll', path: '/admin/payroll' },
  { icon: Clock, label: 'Attendance', path: '/admin/attendance' },
  { icon: Calendar, label: 'Leaves', path: '/admin/leaves' },
  { icon: FileStack, label: 'Loans & Advances', path: '/admin/documents' },
  { icon: BookOpen, label: 'Reports', path: '/admin/directory' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-roth-secondary transition-all duration-300 shadow-xl",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {!isCollapsed && <BrandMark compact className="leading-none" />}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="p-3 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-roth-accent text-roth-secondary font-semibold"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            <p className="font-medium text-roth-accent">RDesk HRMS</p>
            <p>v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;


