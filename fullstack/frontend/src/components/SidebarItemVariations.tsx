import React from 'react';
import {
  LayoutGrid,
  Users,
  FileText,
  Settings,
  BarChart3,
  Clock,
  CreditCard,
  Home,
  Zap,
} from 'lucide-react';
import SidebarItem from './SidebarItem';

/**
 * SidebarItemVariations: Demonstrates all the different ways to use SidebarItem
 */
const SidebarItemVariations: React.FC = () => {
  const [active, setActive] = React.useState<string>('basic');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SidebarItem Component</h1>
          <p className="text-lg text-gray-600">
            Reusable admin dashboard sidebar items with Tailwind CSS
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Basic Examples */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Usage</h2>
            <div className="space-y-3">
              <SidebarItem icon={LayoutGrid} label="Dashboard" />
              <SidebarItem icon={Users} label="Employees" />
              <SidebarItem icon={Clock} label="Attendance" />
            </div>
          </div>

          {/* Active State Examples */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Active State</h2>
            <div className="space-y-3">
              <SidebarItem icon={LayoutGrid} label="Dashboard" active={true} />
              <SidebarItem icon={Users} label="Employees" active={false} />
              <SidebarItem icon={Settings} label="Settings" active={false} />
            </div>
          </div>

          {/* With Badges */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">With Badge Counts</h2>
            <div className="space-y-3">
              <SidebarItem icon={Users} label="Employees" badge={12} />
              <SidebarItem icon={Clock} label="Pending Approvals" badge={5} active={true} />
              <SidebarItem icon={FileText} label="Documents" badge={99} />
              <SidebarItem icon={BarChart3} label="Reports" badge={0} />
            </div>
          </div>

          {/* With Hover Effects */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Hover Effects</h2>
            <p className="text-sm text-gray-600 mb-4">
              Hover over items to see scale and shadow effects
            </p>
            <div className="space-y-3">
              <SidebarItem icon={CreditCard} label="Payroll" />
              <SidebarItem icon={Zap} label="Quick Actions" />
              <SidebarItem icon={Home} label="Home" />
            </div>
          </div>

          {/* Full Sidebar Example */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Complete Sidebar Example</h2>
            <div className="bg-gradient-to-b from-white to-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
              {/* Main Section */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">
                Main
              </p>
              <SidebarItem
                icon={LayoutGrid}
                label="Dashboard"
                active={active === 'dashboard'}
                badge={2}
                onClick={() => setActive('dashboard')}
              />
              <SidebarItem
                icon={Users}
                label="Team Members"
                active={active === 'team'}
                badge={8}
                onClick={() => setActive('team')}
              />
              <SidebarItem
                icon={Clock}
                label="Attendance"
                active={active === 'attendance'}
                onClick={() => setActive('attendance')}
              />

              {/* Divider */}
              <div className="my-3 border-t border-gray-200" />

              {/* Management Section */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">
                Management
              </p>
              <SidebarItem
                icon={CreditCard}
                label="Payroll"
                active={active === 'payroll'}
                onClick={() => setActive('payroll')}
              />
              <SidebarItem
                icon={BarChart3}
                label="Reports"
                active={active === 'reports'}
                onClick={() => setActive('reports')}
              />
              <SidebarItem
                icon={FileText}
                label="Policies"
                active={active === 'policies'}
                onClick={() => setActive('policies')}
              />

              {/* Divider */}
              <div className="my-3 border-t border-gray-200" />

              {/* Settings */}
              <SidebarItem
                icon={Settings}
                label="Settings"
                active={active === 'settings'}
                onClick={() => setActive('settings')}
              />
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="mt-12 bg-gray-900 rounded-lg border border-gray-700 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Usage Example</h2>
          <pre className="text-sm text-gray-300 overflow-x-auto">
{`import { LayoutGrid, Users, Settings } from 'lucide-react';
import SidebarItem from './SidebarItem';

function AdminSidebar() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="w-64 bg-white border-r border-gray-200">
      {/* Main Navigation */}
      <SidebarItem
        icon={LayoutGrid}
        label="Dashboard"
        active={activeTab === 'dashboard'}
        badge={3}
        onClick={() => setActiveTab('dashboard')}
      />
      
      <SidebarItem
        icon={Users}
        label="Employees"
        active={activeTab === 'employees'}
        badge={12}
        onClick={() => setActiveTab('employees')}
      />
      
      {/* Divider */}
      <div className="my-2 border-t border-gray-200" />
      
      {/* Settings */}
      <SidebarItem
        icon={Settings}
        label="Settings"
        active={activeTab === 'settings'}
        onClick={() => setActiveTab('settings')}
      />
    </div>
  );
}`}
          </pre>
        </div>

        {/* Features List */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-2">✓ Features</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Gradient icon container (purple to blue)</li>
              <li>• Smooth hover effects (scale + shadow)</li>
              <li>• Active state indicator dot</li>
              <li>• Badge support for counts</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-2">⚙ Props</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• icon: LucideIcon component</li>
              <li>• label: string</li>
              <li>• active?: boolean (default: false)</li>
              <li>• badge?: number | ReactNode</li>
              <li>• onClick?: () =&gt; void</li>
            </ul>
          </div>
        </div>

        {/* Tailwind Classes Used */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">📦 Tailwind Classes Reference</h3>
          <p className="text-sm text-blue-700 mb-3">
            This component uses the following Tailwind classes:
          </p>
          <div className="bg-white rounded p-3 text-xs text-gray-600 font-mono space-y-1 overflow-x-auto">
            <div>flex, items-center, gap-3, px-4, py-3, rounded-lg, transition-all</div>
            <div>w-10, h-10, rounded-xl, bg-gradient-to-br, from-purple-500, to-blue-500</div>
            <div>hover:shadow-md, hover:scale-105, hover:bg-gray-50</div>
            <div>border, border-transparent, border-purple-200</div>
            <div>text-sm, font-medium, text-gray-700, text-gray-900</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarItemVariations;
