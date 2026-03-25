/**
 * Component: components\BulkEmployeeSelector.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { employeeAPI, departmentAPI } from '../services/api';
import { Employee, Department } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  Search, 
  Users, 
  Building2,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';

interface BulkEmployeeSelectorProps {
  selectedEmployees: Employee[];
  onSelectionChange: (employees: Employee[]) => void;
}

const BulkEmployeeSelector: React.FC<BulkEmployeeSelectorProps> = ({
  selectedEmployees,
  onSelectionChange,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, selectedDepartment]);

  useEffect(() => {
    // Update select all state based on current selection
    if (filteredEmployees.length > 0) {
      const allSelected = filteredEmployees.every(emp => 
        selectedEmployees.some(selected => selected.id === emp.id)
      );
      setSelectAll(allSelected);
    } else {
      setSelectAll(false);
    }
  }, [filteredEmployees, selectedEmployees]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [employeesResponse, departmentsResponse] = await Promise.all([
        employeeAPI.getAll(),
        departmentAPI.getAll()
      ]);
      
      setEmployees(employeesResponse.data.results || employeesResponse.data);
      setDepartments(departmentsResponse.data.results || departmentsResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = employees.filter(emp => emp.is_active); // Only show active employees

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(employee =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by department
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(employee =>
        String(employee.department.id) === selectedDepartment
      );
    }

    setFilteredEmployees(filtered);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Add all filtered employees to selection
      const newSelections = [...selectedEmployees];
      filteredEmployees.forEach(emp => {
        if (!newSelections.some(selected => selected.id === emp.id)) {
          newSelections.push(emp);
        }
      });
      onSelectionChange(newSelections);
    } else {
      // Remove all filtered employees from selection
      const filteredIds = filteredEmployees.map(emp => emp.id);
      const newSelections = selectedEmployees.filter(emp => 
        !filteredIds.includes(emp.id)
      );
      onSelectionChange(newSelections);
    }
  };

  const handleEmployeeSelect = (employee: Employee, checked: boolean) => {
    if (checked) {
      // Add employee to selection
      if (!selectedEmployees.some(emp => emp.id === employee.id)) {
        onSelectionChange([...selectedEmployees, employee]);
      }
    } else {
      // Remove employee from selection
      onSelectionChange(selectedEmployees.filter(emp => emp.id !== employee.id));
    }
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const getDepartmentName = (departmentId: number) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.department_name : 'Unknown';
  };

  const isEmployeeSelected = (employee: Employee) => {
    return selectedEmployees.some(emp => emp.id === employee.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Select Employees</h2>
          <p className="text-muted-foreground">
            Choose employees for payslip generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {selectedEmployees.length} Selected
          </Badge>
          {selectedEmployees.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Employees</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, ID, or position..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="department-filter">Filter by Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Employees ({filteredEmployees.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Select All
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`employee-${employee.id}`}
                  checked={isEmployeeSelected(employee)}
                  onCheckedChange={(checked) => 
                    handleEmployeeSelect(employee, checked as boolean)
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {employee.employee_id} • {employee.position}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getDepartmentName(employee.department.id)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {employee.pay_mode}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {employees.length === 0 
                  ? "No employees found. Please import employees first."
                  : "No employees match your search criteria."
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Employees Summary */}
      {selectedEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Selected Employees ({selectedEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedEmployees.map((employee) => (
                <Badge
                  key={employee.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {employee.name}
                  <button
                    onClick={() => handleEmployeeSelect(employee, false)}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkEmployeeSelector;

