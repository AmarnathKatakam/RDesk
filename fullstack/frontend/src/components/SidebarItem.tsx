import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface SidebarItemProps {
  /**
   * The icon component from lucide-react or a custom React component
   * @example import { LayoutGrid } from 'lucide-react'; <SidebarItem icon={LayoutGrid} />
   */
  icon: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;
  
  /**
   * The label text displayed next to the icon
   */
  label: string;
  
  /**
   * Indicates if this item is currently active/selected
   * @default false
   */
  active?: boolean;
  
  /**
   * Optional click handler
   */
  onClick?: () => void;
  
  /**
   * Optional CSS class for additional styling
   */
  className?: string;
  
  /**
   * Optional badge count or component to display
   */
  badge?: number | React.ReactNode;
}

/**
 * AdminDashboardSidebarItem Component
 * A reusable sidebar item component with gradient icon container and hover effects
 * 
 * @example
 * ```tsx
 * import { LayoutGrid, Users } from 'lucide-react';
 * 
 * <SidebarItem 
 *   icon={LayoutGrid} 
 *   label="Dashboard" 
 *   active={true}
 *   onClick={() => navigate('/dashboard')}
 * />
 * 
 * <SidebarItem 
 *   icon={Users} 
 *   label="Employees" 
 *   badge={12}
 * />
 * ```
 */
const SidebarItem = React.forwardRef<HTMLDivElement, SidebarItemProps>(
  ({ icon: Icon, label, active = false, onClick, className, badge }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={clsx(
          // Base styles
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer',
          // Border and shadow
          'border border-transparent',
          // Hover effects
          'hover:shadow-md hover:scale-105',
          // Active state
          active
            ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 shadow-sm'
            : 'hover:bg-gray-50',
          // Default inactive background
          'bg-white',
          className
        )}
      >
        {/* Icon Container with Gradient */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center transition-transform duration-200">
            <Icon
              size={20}
              className="text-white"
              strokeWidth={2.5}
            />
          </div>
          
          {/* Active Indicator */}
          {active && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full border-2 border-white shadow-sm" />
          )}
        </div>

        {/* Label and Content */}
        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate transition-colors duration-200',
              active
                ? 'text-gray-900'
                : 'text-gray-700 group-hover:text-gray-900'
            )}
          >
            {label}
          </span>

          {/* Badge */}
          {badge !== undefined && (
            <div
              className={clsx(
                'flex-shrink-0 ml-auto',
                typeof badge === 'number'
                  ? 'inline-flex items-center justify-center min-w-max px-2 py-0.5 text-xs font-semibold rounded-full'
                  : ''
              )}
            >
              {typeof badge === 'number' ? (
                <span className={clsx(
                  'bg-gradient-to-r from-purple-500 to-blue-500 text-white',
                  badge > 99 ? 'px-1.5' : 'px-2'
                )}>
                  {badge > 99 ? '99+' : badge}
                </span>
              ) : (
                badge
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SidebarItem.displayName = 'SidebarItem';

export default SidebarItem;
