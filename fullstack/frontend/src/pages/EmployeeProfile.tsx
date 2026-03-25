/**
 * Component: pages\EmployeeProfile.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';

const EmployeeProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        const response = await fetch(`/api/auth/employee/profile/?employee_id=${userId}`, {
          credentials: 'include',
        });
        const data = await response.json();
        setProfile(data.profile || null);
      } catch (error) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, []);

  if (loading) {
    return <div className="saas-card saas-section text-slate-500">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="saas-card saas-section text-slate-500">Profile not available.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">Employee account details.</p>
      </div>
      <div className="saas-card overflow-hidden">
        <div className="divide-y divide-slate-200">
          {[
            ['Employee ID', profile.employee_id],
            ['Name', profile.name],
            ['Email', profile.email],
            ['Department', profile.department],
            ['Position', profile.position],
            ['Location', profile.location],
            ['Date of Joining', profile.date_of_joining],
            ['Phone', profile.phone],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="sm:col-span-2 text-sm text-slate-900 font-medium">{value || '-'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfilePage;

