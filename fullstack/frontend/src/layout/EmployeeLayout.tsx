/**
 * Component: layout\EmployeeLayout.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, UserCircle, Clock3, CalendarDays } from 'lucide-react';
import Sidebar, { type SidebarItem } from '@/components/Sidebar';
import Header from '@/components/Header';

const EmployeeLayout: React.FC = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const employee = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  }, []);

  const menuItems = useMemo<SidebarItem[]>(
    () => [
      { label: 'Dashboard', path: '/employee/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', path: '/employee/attendance', icon: Clock3 },
      { label: 'Leaves', path: '/employee/leaves', icon: CalendarDays },
      { label: 'Payslips', path: '/employee/payslips', icon: FileText },
      { label: 'Profile', path: '/employee/profile', icon: UserCircle },
    ],
    []
  );

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <Sidebar items={menuItems} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <Header
        collapsed={collapsed}
        searchValue={search}
        onSearchChange={setSearch}
        userName={employee?.name || 'Employee'}
        userRole="Employee"
        onLogout={handleLogout}
      />
      <main
        className={`pt-20 pb-8 px-4 sm:px-6 transition-all duration-300 ${
          collapsed ? 'ml-[84px]' : 'ml-72'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default EmployeeLayout;

