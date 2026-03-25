/**
 * Component: components\dashboard\FooterHelp.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { BookOpen, FileCheck, DollarSign, HeadphonesIcon } from 'lucide-react';

interface HelpLink {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const helpLinks: HelpLink[] = [
  { 
    title: 'Documentation', 
    description: 'Learn how to use RDesk features',
    icon: BookOpen,
    color: 'bg-blue-100 text-blue-600 hover:bg-blue-200',
  },
  { 
    title: 'HR Policies', 
    description: 'Company policies and guidelines',
    icon: FileCheck,
    color: 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200',
  },
  { 
    title: 'Payroll Compliance', 
    description: 'Tax and legal compliance information',
    icon: DollarSign,
    color: 'bg-amber-100 text-amber-600 hover:bg-amber-200',
  },
  { 
    title: 'Support Center', 
    description: 'Get help from our support team',
    icon: HeadphonesIcon,
    color: 'bg-purple-100 text-purple-600 hover:bg-purple-200',
  },
];

const FooterHelp: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="font-semibold text-gray-900">Help & Resources</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {helpLinks.map((link, index) => (
            <a
              key={index}
              href="#"
              className="group p-4 rounded-xl border border-gray-100 hover:border-roth-accent/30 hover:shadow-md transition-all duration-300"
            >
              <div className={`h-10 w-10 rounded-lg ${link.color} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                <link.icon className="h-5 w-5" />
              </div>
              <p className="font-medium text-gray-900 text-sm">{link.title}</p>
              <p className="text-xs text-gray-500 mt-1">{link.description}</p>
            </a>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © 2025 RDesk. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-gray-500 hover:text-roth-accent transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-500 hover:text-roth-accent transition-colors">Terms of Service</a>
            <a href="#" className="text-xs text-gray-500 hover:text-roth-accent transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FooterHelp;


