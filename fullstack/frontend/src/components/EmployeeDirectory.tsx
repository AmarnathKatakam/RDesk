/**
 * Component: components\EmployeeDirectory.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { Search, MapPin, Briefcase, Building2 } from 'lucide-react';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  position: string;
  department: string;
  location: string;
  profile_photo: string | null;
}

interface Directory {
  departments: Array<{ id: number; department_name: string }>;
  locations: string[];
  employees: Employee[];
}

const EmployeeDirectory: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; department_name: string }>>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadDirectory();
  }, [searchQuery, filterDept, filterLocation]);

  const loadDirectory = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      
      if (searchQuery) params.append('search', searchQuery);
      if (filterDept) params.append('department', filterDept);
      if (filterLocation) params.append('location', filterLocation);

      const res = await hrmsApi.getDirectoryEmployees(params);

      if (res.ok) {
        const data = await getJson<Directory>(res);
        setEmployees(data.employees || []);
        setDepartments(data.departments || []);
        setLocations(data.locations || []);
      } else {
        setError('Failed to load employee directory');
      }
    } catch (err) {
      setError('Failed to load employee directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Employee Directory</h2>
        <p className="text-gray-600 mt-1">Search and find your colleagues</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, employee ID, or email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.department_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8 text-gray-500">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">No employees found</div>
        ) : (
          employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => setSelectedEmployee(emp)}
              className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                {emp.profile_photo ? (
                  <img
                    src={emp.profile_photo}
                    alt={emp.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                    {getInitials(emp.name)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                  <p className="text-xs text-gray-600">{emp.employee_id}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-700 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  {emp.position}
                </p>
                <p className="text-gray-600 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {emp.department}
                </p>
                <p className="text-gray-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {emp.location}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              {selectedEmployee.profile_photo ? (
                <img
                  src={selectedEmployee.profile_photo}
                  alt={selectedEmployee.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xl">
                  {getInitials(selectedEmployee.name)}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                <p className="text-gray-600">{selectedEmployee.employee_id}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="font-semibold text-gray-900">{selectedEmployee.position}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Department</p>
                <p className="font-semibold text-gray-900">{selectedEmployee.department}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-semibold text-gray-900">{selectedEmployee.location}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedEmployee(null)}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDirectory;

