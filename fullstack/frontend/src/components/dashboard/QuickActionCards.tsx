/**
 * Component: components\dashboard\QuickActionCards.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { 
  UserPlus, 
  FileText, 
  Wallet, 
  Building2, 
  Clock, 
  Calendar, 
  HandCoins,
  BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionCard {
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  path: string;
}

const actions: QuickActionCard[] = [
  { 
    title: 'Add Employee', 
    icon: UserPlus, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    path: '/admin/employees'
  },
  { 
    title: 'Generate Payslip', 
    icon: FileText, 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    path: '/admin/payroll'
  },
  { 
    title: 'Process Payroll', 
    icon: Wallet, 
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    path: '/admin/payroll'
  },
  { 
    title: 'Salary Structure', 
    icon: Building2, 
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    path: '/admin/settings'
  },
  { 
    title: 'Attendance Report', 
    icon: Clock, 
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 hover:bg-cyan-100',
    path: '/admin/attendance'
  },
  { 
    title: 'Leave Requests', 
    icon: Calendar, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    path: '/admin/leaves'
  },
  { 
    title: 'Loan Requests', 
    icon: HandCoins, 
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 hover:bg-rose-100',
    path: '/admin/documents'
  },
  { 
    title: 'Payroll Reports', 
    icon: BarChart3, 
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100',
    path: '/admin/directory'
  },
];

const QuickActionCards: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => navigate(action.path)}
            className={`
              ${action.bgColor}
              rounded-xl p-4 flex flex-col items-center justify-center gap-2
              transition-all duration-300 shadow-md hover:shadow-lg
              hover:-translate-y-1 group
              border border-gray-100
            `}
          >
            <div className={`
              h-12 w-12 rounded-xl bg-white shadow-sm 
              flex items-center justify-center 
              transition-transform duration-300 group-hover:scale-110
            `}>
              <action.icon className={`h-6 w-6 ${action.color}`} />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">
              {action.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionCards;


