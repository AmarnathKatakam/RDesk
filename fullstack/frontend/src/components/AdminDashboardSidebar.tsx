import React, { useState } from 'react';
import {
  LayoutGrid,
  Users,
  FileText,
  Settings,
  BarChart3,
  Clock,
  CreditCard,
  LogOut,
} from 'lucide-react';
import SidebarItem from './SidebarItem';

interface NavItem {
  id: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  badge?: number;
}

/**
 * AdminDashboardSidebar Component
 * Example implementation showing how to use the SidebarItem component
 */
const AdminDashboardSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
    { id: 'employees', icon: Users, label: 'Employees', badge: 12 },
    { id: 'attendance', icon: Clock, label: 'Attendance', badge: 3 },
    { id: 'payroll', icon: CreditCard, label: 'Payroll' },
    { id: 'reports', icon: BarChart3, label: 'Reports' },
    { id: 'documents', icon: FileText, label: 'Documents' },
  ];

  const bottomNavItems: NavItem[] = [
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'logout', icon: LogOut, label: 'Logout' },
  ];

  const handleNavigation = (itemId: string) => {
    setActiveTab(itemId);
    console.log(`Navigating to: ${itemId}`);
  };

  return (
    <div className="h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo Section */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">RD</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">RothDesk</h1>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-3">
            Main Menu
          </p>
          {mainNavItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              badge={item.badge}
              onClick={() => handleNavigation(item.id)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-gray-200" />

        {/* Secondary Menu */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-3">
            System
          </p>
          {bottomNavItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => handleNavigation(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">John Doe</p>
            <p className="text-xs text-gray-500 truncate">CEO</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Demo Page showing the sidebar in action
 */
const SidebarDemo: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminDashboardSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
          <p className="text-gray-600">
            Click on sidebar items to see the active state in action.
          </p>
          
          {/* Demo Info */}
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Component Features
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✓ Smooth hover effects with scale and shadow</li>
              <li>✓ Active state with gradient background and indicator dot</li>
              <li>✓ Badge support for notification counts</li>
              <li>✓ Responsive and accessible</li>
              <li>✓ Tailwind CSS for styling</li>
              <li>✓ Lucide React icons integration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardSidebar;
export { SidebarDemo };
