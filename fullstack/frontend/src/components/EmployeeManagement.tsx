/**
 * Component: components\EmployeeManagement.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { employeeAPI, departmentAPI } from '../services/api';
import { Employee, Department, ExcelImportResult } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { 
  Upload, 
  Search, 
  Users, 
  Building2,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Mail
} from 'lucide-react';

interface EmployeeManagementProps {
  onNavigateToUpload?: () => void;
  onNavigateToWelcomeEmails?: () => void;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ onNavigateToUpload, onNavigateToWelcomeEmails }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  
  // Employee form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    employee_id: '',
    name: '',
    position: '',
    department_id: '',
    dob: '',
    doj: '',
    pan: '',
    pf_number: '',
    bank_account: '',
    bank_ifsc: '',
    pay_mode: 'NEFT',
    location: '',
    health_card_no: '',
    email: '',
    personal_email: '',
    password: '',
    lpa: null
  });
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  
  // CRUD operations state
  const [showEditForm, setShowEditForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, selectedDepartment]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading departments and employees...');

      const [employeesResponse, departmentsResponse] = await Promise.all([
        employeeAPI.getAll(),
        departmentAPI.getAll()
      ]);

      console.log('Departments response:', departmentsResponse.data);
      console.log('Departments type:', typeof departmentsResponse.data);
      console.log('Is array?', Array.isArray(departmentsResponse.data));

      // Handle different response structures
      let departmentsData = [];
      if (Array.isArray(departmentsResponse.data)) {
        departmentsData = departmentsResponse.data;
      } else if (departmentsResponse.data.results) {
        departmentsData = departmentsResponse.data.results;
      } else {
        console.error('Unexpected departments response structure:', departmentsResponse.data);
        departmentsData = [];
      }

      console.log('Processed departments:', departmentsData);

      setEmployees(employeesResponse.data.results || employeesResponse.data);
      setDepartments(departmentsData);

    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays on error to prevent crashes
      setEmployees([]);
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = employees;

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleExcelImport = async () => {
    if (!importFile) return;

    try {
      setIsImporting(true);
      const response = await employeeAPI.importExcel(importFile);
      setImportResult(response.data);
      
      if (response.data.success) {
        // Reload employees after successful import
        await loadData();
        setImportFile(null);
        // Reset file input
        const fileInput = document.getElementById('excel-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        imported_count: 0,
        errors: ['Failed to import file. Please check the format and try again.'],
        warnings: []
      });
    } finally {
      setIsImporting(false);
    }
  };


  const getDepartmentName = (departmentId: number) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.department_name : 'Unknown';
  };

  // Form validation function
  const validateEmployeeForm = (formData: any) => {
    const errors: string[] = [];
    
    // Required field validation
    if (!formData.employee_id?.trim()) errors.push('Employee ID is required');
    if (!formData.name?.trim()) errors.push('Name is required');
    if (!formData.position?.trim()) errors.push('Position is required');
    if (!formData.department_id) errors.push('Department is required');
    if (!formData.dob) errors.push('Date of Birth is required');
    if (!formData.doj) errors.push('Date of Joining is required');
    if (!formData.pan?.trim()) errors.push('PAN is required');
    if (!formData.bank_account?.trim()) errors.push('Bank Account is required');
    if (!formData.bank_ifsc?.trim()) errors.push('Bank IFSC is required');
    if (!formData.location?.trim()) errors.push('Location is required');
    
    // Format validation
    if (formData.employee_id && !/^[A-Z0-9]+$/.test(formData.employee_id)) {
      errors.push('Employee ID must contain only uppercase letters and numbers');
    }
    
    if (formData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)) {
      errors.push('PAN must be in format: ABCDE1234F');
    }
    
    if (formData.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.bank_ifsc)) {
      errors.push('IFSC must be in format: ABCD0123456');
    }
    
    // Date validation
    if (formData.dob && new Date(formData.dob) > new Date()) {
      errors.push('Date of Birth cannot be in the future');
    }
    
    if (formData.doj && new Date(formData.doj) > new Date()) {
      errors.push('Date of Joining cannot be in the future');
    }
    
    if (formData.dob && formData.doj && new Date(formData.dob) >= new Date(formData.doj)) {
      errors.push('Date of Joining must be after Date of Birth');
    }
    
    return errors;
  };

  const handleCreateEmployee = async () => {
    try {
      setIsCreating(true);
      
      // Validate form data
      const validationErrors = validateEmployeeForm(employeeForm);
      if (validationErrors.length > 0) {
        alert(`Please fix the following errors:\n${validationErrors.join('\n')}`);
        return;
      }
      
      // Prepare form data with proper types
      const departmentId = parseInt(employeeForm.department_id);
      if (isNaN(departmentId)) {
        alert('Please select a valid department');
        return;
      }

      const formData = {
        ...employeeForm,
        department_id: departmentId, // Ensure it's a valid integer
        employee_id: employeeForm.employee_id.toUpperCase(), // Ensure uppercase
      };
      
      // Remove null/empty optional fields
      if (!formData.pf_number?.trim()) delete formData.pf_number;
      if (!formData.health_card_no?.trim()) delete formData.health_card_no;
      if (!formData.email?.trim()) delete formData.email;
      if (!formData.personal_email?.trim()) delete formData.personal_email;
      if (!formData.password?.trim()) delete formData.password;
      if (formData.lpa === null || formData.lpa === '') delete formData.lpa;
      
      // Handle welcome email logic
      if (!sendWelcomeEmail) {
        delete formData.personal_email;
        delete formData.password;
      }
      
      console.log('Sending employee data:', formData); // Debug log
      
      const response = await employeeAPI.create(formData);

      if (response.data) {
        // Reset form
        setEmployeeForm({
          employee_id: '',
          name: '',
          position: '',
          department_id: '',
          dob: '',
          doj: '',
          pan: '',
          pf_number: '',
          bank_account: '',
          bank_ifsc: '',
          pay_mode: 'NEFT',
          location: '',
          health_card_no: '',
          email: '',
          personal_email: '',
          password: '',
          lpa: null
        });
        setSendWelcomeEmail(true);
        setShowAddForm(false);

        // Update employees state immediately with the new employee
        setEmployees(prev => [response.data, ...prev]);

        // Reload employees to ensure consistency
        await loadData();

        alert('Employee created successfully!');
      }
    } catch (error: any) {
      console.error('Create employee error:', error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      
      // Better error message
      let errorMessage = 'Failed to create employee';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        // Handle Django serializer errors
        const errorMessages = [];
        for (const [field, messages] of Object.entries(error.response.data.errors)) {
          if (Array.isArray(messages)) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          } else {
            errorMessages.push(`${field}: ${messages}`);
          }
        }
        errorMessage = errorMessages.join('\n');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setEmployeeForm({
      employee_id: '',
      name: '',
      position: '',
      department_id: '',
      dob: '',
      doj: '',
      pan: '',
      pf_number: '',
      bank_account: '',
      bank_ifsc: '',
      pay_mode: 'NEFT',
      location: '',
      health_card_no: '',
      email: '',
      personal_email: '',
      password: '',
      lpa: null
    });
    setSendWelcomeEmail(true);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'employee_id': 'EMP001',
        'name': 'John Doe',
        'position': 'Software Developer',
        'department': 'IT',
        'dob': '1990-01-01',
        'doj': '2024-01-01',
        'pan': 'ABCDE1234F',
        'pf_number': 'PF123456789',
        'bank_account': '1234567890',
        'bank_ifsc': 'SBIN0001234',
        'pay_mode': 'NEFT',
        'location': 'Hyderabad',
        'health_card_no': 'HC123456',
        'email': 'john.doe@blackroth.co.in',
        'personal_email': 'john.doe.personal@gmail.com',
        'password': 'TempPass123!',
        'lpa': 6.0
      }
    ];
    
    // Convert to CSV
    const headers = Object.keys(templateData[0]);
    const csvContent = [
      headers.join(','),
      ...templateData.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'employee_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CRUD Operations
  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEmployeeForm({
      employee_id: employee.employee_id,
      name: employee.name,
      position: employee.position,
      department_id: employee.department.id.toString(),
      dob: employee.dob,
      doj: employee.doj,
      pan: employee.pan,
      pf_number: employee.pf_number || '',
      bank_account: employee.bank_account,
      bank_ifsc: employee.bank_ifsc,
      pay_mode: employee.pay_mode,
      location: employee.location,
      health_card_no: employee.health_card_no || '',
      email: employee.email || '',
      personal_email: employee.personal_email || '',
      password: '', // Don't show existing password
      lpa: employee.lpa
    });
    setSendWelcomeEmail(false); // Don't send email on edit
    setShowEditForm(true);
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      setIsCreating(true);

      // Prepare form data
      const formData = { ...employeeForm };

      // Convert department_id to integer (same as create function)
      const departmentId = parseInt(employeeForm.department_id);
      if (isNaN(departmentId)) {
        alert('Please select a valid department');
        return;
      }
      formData.department_id = departmentId.toString();

      if (!sendWelcomeEmail) {
        // Don't send email if checkbox is unchecked
        delete formData.personal_email;
        delete formData.password;
      }

      console.log('Sending update data:', formData); // Debug log

      const response = await employeeAPI.update(selectedEmployee.id.toString(), formData);
      
      if (response.data) {
        // Reset form
        resetForm();
        setShowEditForm(false);
        setSelectedEmployee(null);
        
        // Reload employees
        await loadData();
        
        alert('Employee updated successfully!');
      }
    } catch (error: any) {
      console.error('Update employee error:', error);

      // Enhanced error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }

      // Better error message
      let errorMessage = 'Failed to update employee';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        // Handle Django serializer errors
        const errorMessages = [];
        for (const [field, messages] of Object.entries(error.response.data.errors)) {
          if (Array.isArray(messages)) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          } else {
            errorMessages.push(`${field}: ${messages}`);
          }
        }
        errorMessage = errorMessages.join('\n');
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete employee "${employee.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await employeeAPI.delete(employee.id.toString());
      
      // Reload employees
      await loadData();
      
      alert('Employee deleted successfully!');
    } catch (error: any) {
      console.error('Delete employee error:', error);
      alert(`Failed to delete employee: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsDeleting(false);
    }
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
          <h2 className="text-2xl font-bold text-primary">Employee Management</h2>
          <p className="text-muted-foreground">
            Manage employees and import data from Excel files
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Add Employee
          </Button>
          {onNavigateToWelcomeEmails && (
            <Button 
              onClick={onNavigateToWelcomeEmails}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Welcome Emails
            </Button>
          )}
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {employees.length} Employees
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {departments.length} Departments
          </Badge>
        </div>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Employees from Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="excel-file">Select Excel File</Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isImporting}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={downloadTemplate}
              >
                Download Template
              </Button>
              <Button
                onClick={handleExcelImport}
                disabled={!importFile || isImporting}
              >
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>

          {importResult && (
            <Alert variant={importResult.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {importResult.success
                    ? `Successfully imported ${importResult.imported_count} employees`
                    : 'Import failed'
                  }
                </AlertDescription>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-sm">Errors:</p>
                  <ul className="text-sm list-disc list-inside">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importResult.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-sm">Warnings:</p>
                  <ul className="text-sm list-disc list-inside">
                    {importResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Alert>
          )}

          {importResult?.success && (
            <div className="mt-4">
              <Button onClick={onNavigateToUpload}>Go to Upload Salary</Button>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Employees ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Pay Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.employee_id}
                    </TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{getDepartmentName(employee.department.id)}</TableCell>
                    <TableCell>{employee.location}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.pay_mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? "default" : "secondary"}>
                        {employee.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewEmployee(employee)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditEmployee(employee)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEmployee(employee)}
                          disabled={isDeleting}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {employees.length === 0 
                  ? "No employees found. Import some employees to get started."
                  : "No employees match your search criteria."
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Employee</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee ID *</Label>
                  <Input
                    value={employeeForm.employee_id}
                    onChange={e => setEmployeeForm({...employeeForm, employee_id: e.target.value})}
                    placeholder="EMP001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={employeeForm.name}
                    onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position *</Label>
                  <Input
                    value={employeeForm.position}
                    onChange={e => setEmployeeForm({...employeeForm, position: e.target.value})}
                    placeholder="Software Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department *</Label>
                  <Select 
                    value={employeeForm.department_id} 
                    onValueChange={value => setEmployeeForm({...employeeForm, department_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    value={employeeForm.dob}
                    onChange={e => setEmployeeForm({...employeeForm, dob: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining *</Label>
                  <Input
                    type="date"
                    value={employeeForm.doj}
                    onChange={e => setEmployeeForm({...employeeForm, doj: e.target.value})}
                  />
                </div>
              </div>

              {/* Financial Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PAN Number *</Label>
                  <Input
                    value={employeeForm.pan}
                    onChange={e => setEmployeeForm({...employeeForm, pan: e.target.value})}
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PF Number</Label>
                  <Input
                    value={employeeForm.pf_number}
                    onChange={e => setEmployeeForm({...employeeForm, pf_number: e.target.value})}
                    placeholder="PF123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Account *</Label>
                  <Input
                    value={employeeForm.bank_account}
                    onChange={e => setEmployeeForm({...employeeForm, bank_account: e.target.value})}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank IFSC *</Label>
                  <Input
                    value={employeeForm.bank_ifsc}
                    onChange={e => setEmployeeForm({...employeeForm, bank_ifsc: e.target.value})}
                    placeholder="SBIN0001234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pay Mode *</Label>
                  <Select 
                    value={employeeForm.pay_mode} 
                    onValueChange={value => setEmployeeForm({...employeeForm, pay_mode: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEFT">NEFT</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Input
                    value={employeeForm.location}
                    onChange={e => setEmployeeForm({...employeeForm, location: e.target.value})}
                    placeholder="Hyderabad"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Health Card Number</Label>
                  <Input
                    value={employeeForm.health_card_no}
                    onChange={e => setEmployeeForm({...employeeForm, health_card_no: e.target.value})}
                    placeholder="HC123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Salary (LPA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={employeeForm.lpa || ''}
                    onChange={e => setEmployeeForm({...employeeForm, lpa: e.target.value ? parseFloat(e.target.value) : null})}
                    placeholder="6.0"
                  />
                </div>
              </div>

              {/* Email and Password Section */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Login Credentials (Optional)</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>System Login Email</Label>
                      <Input
                        type="email"
                        value={employeeForm.email}
                        onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})}
                        placeholder="john.doe@blackroth.co.in"
                      />
                      <p className="text-xs text-gray-500">Email for system login</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Personal Email</Label>
                      <Input
                        type="email"
                        value={employeeForm.personal_email}
                        onChange={e => setEmployeeForm({...employeeForm, personal_email: e.target.value})}
                        placeholder="john.doe.personal@gmail.com"
                      />
                      <p className="text-xs text-gray-500">Email for welcome messages</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="send-welcome-email"
                      checked={sendWelcomeEmail}
                      onChange={e => setSendWelcomeEmail(e.target.checked)}
                    />
                    <Label htmlFor="send-welcome-email">Send welcome email with login credentials</Label>
                  </div>

                  {sendWelcomeEmail && (
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={employeeForm.password}
                        onChange={e => setEmployeeForm({...employeeForm, password: e.target.value})}
                        placeholder="Enter temporary password"
                      />
                      <p className="text-xs text-gray-500">Welcome email will be sent to personal email</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateEmployee}
                  disabled={isCreating}
                  className="flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Create Employee
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {showViewModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Employee Details</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedEmployee(null);
                }}
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Employee ID</Label>
                  <p className="text-sm">{selectedEmployee.employee_id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                  <p className="text-sm">{selectedEmployee.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Position</Label>
                  <p className="text-sm">{selectedEmployee.position}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Department</Label>
                  <p className="text-sm">{getDepartmentName(selectedEmployee.department.id)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Date of Birth</Label>
                  <p className="text-sm">{selectedEmployee.dob}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Date of Joining</Label>
                  <p className="text-sm">{selectedEmployee.doj}</p>
                </div>
              </div>

              {/* Financial Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">PAN Number</Label>
                  <p className="text-sm">{selectedEmployee.pan}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">PF Number</Label>
                  <p className="text-sm">{selectedEmployee.pf_number || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Bank Account</Label>
                  <p className="text-sm">{selectedEmployee.bank_account}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Bank IFSC</Label>
                  <p className="text-sm">{selectedEmployee.bank_ifsc}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Pay Mode</Label>
                  <p className="text-sm">{selectedEmployee.pay_mode}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Location</Label>
                  <p className="text-sm">{selectedEmployee.location}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Health Card</Label>
                  <p className="text-sm">{selectedEmployee.health_card_no || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Annual Salary (LPA)</Label>
                  <p className="text-sm">{selectedEmployee.lpa || 'N/A'}</p>
                </div>
              </div>

              {/* Email Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">System Email</Label>
                  <p className="text-sm">{selectedEmployee.email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Personal Email</Label>
                  <p className="text-sm">{selectedEmployee.personal_email || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <Badge variant={selectedEmployee.is_active ? "default" : "secondary"}>
                    {selectedEmployee.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created At</Label>
                  <p className="text-sm">{new Date(selectedEmployee.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 mt-6 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedEmployee(null);
                }}
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowViewModal(false);
                  handleEditEmployee(selectedEmployee);
                }}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Employee
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditForm && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Employee</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowEditForm(false);
                  setSelectedEmployee(null);
                  resetForm();
                }}
              >
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee ID *</Label>
                  <Input
                    value={employeeForm.employee_id}
                    onChange={e => setEmployeeForm({...employeeForm, employee_id: e.target.value})}
                    placeholder="EMP001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={employeeForm.name}
                    onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position *</Label>
                  <Input
                    value={employeeForm.position}
                    onChange={e => setEmployeeForm({...employeeForm, position: e.target.value})}
                    placeholder="Software Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department *</Label>
                  <Select 
                    value={employeeForm.department_id} 
                    onValueChange={value => setEmployeeForm({...employeeForm, department_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    value={employeeForm.dob}
                    onChange={e => setEmployeeForm({...employeeForm, dob: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining *</Label>
                  <Input
                    type="date"
                    value={employeeForm.doj}
                    onChange={e => setEmployeeForm({...employeeForm, doj: e.target.value})}
                  />
                </div>
              </div>

              {/* Financial Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PAN Number *</Label>
                  <Input
                    value={employeeForm.pan}
                    onChange={e => setEmployeeForm({...employeeForm, pan: e.target.value})}
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PF Number</Label>
                  <Input
                    value={employeeForm.pf_number}
                    onChange={e => setEmployeeForm({...employeeForm, pf_number: e.target.value})}
                    placeholder="PF123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Account *</Label>
                  <Input
                    value={employeeForm.bank_account}
                    onChange={e => setEmployeeForm({...employeeForm, bank_account: e.target.value})}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank IFSC *</Label>
                  <Input
                    value={employeeForm.bank_ifsc}
                    onChange={e => setEmployeeForm({...employeeForm, bank_ifsc: e.target.value})}
                    placeholder="SBIN0001234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pay Mode *</Label>
                  <Select 
                    value={employeeForm.pay_mode} 
                    onValueChange={value => setEmployeeForm({...employeeForm, pay_mode: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEFT">NEFT</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Input
                    value={employeeForm.location}
                    onChange={e => setEmployeeForm({...employeeForm, location: e.target.value})}
                    placeholder="Hyderabad"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Health Card Number</Label>
                  <Input
                    value={employeeForm.health_card_no}
                    onChange={e => setEmployeeForm({...employeeForm, health_card_no: e.target.value})}
                    placeholder="HC123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Salary (LPA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={employeeForm.lpa || ''}
                    onChange={e => setEmployeeForm({...employeeForm, lpa: e.target.value ? parseFloat(e.target.value) : null})}
                    placeholder="6.0"
                  />
                </div>
              </div>

              {/* Email and Password Section */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Login Credentials (Optional)</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>System Login Email</Label>
                      <Input
                        type="email"
                        value={employeeForm.email}
                        onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})}
                        placeholder="john.doe@blackroth.co.in"
                      />
                      <p className="text-xs text-gray-500">Email for system login</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Personal Email</Label>
                      <Input
                        type="email"
                        value={employeeForm.personal_email}
                        onChange={e => setEmployeeForm({...employeeForm, personal_email: e.target.value})}
                        placeholder="john.doe.personal@gmail.com"
                      />
                      <p className="text-xs text-gray-500">Email for welcome messages</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="send-welcome-email-edit"
                      checked={sendWelcomeEmail}
                      onChange={e => setSendWelcomeEmail(e.target.checked)}
                    />
                    <Label htmlFor="send-welcome-email-edit">Send welcome email with login credentials</Label>
                  </div>

                  {sendWelcomeEmail && (
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={employeeForm.password}
                        onChange={e => setEmployeeForm({...employeeForm, password: e.target.value})}
                        placeholder="Enter new password"
                      />
                      <p className="text-xs text-gray-500">Welcome email will be sent to personal email</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowEditForm(false);
                    setSelectedEmployee(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateEmployee}
                  disabled={isCreating}
                  className="flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      Update Employee
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;

