/**
 * Component: components\WelcomeEmailManagement.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { employeeAPI } from '../services/api';
import { Employee } from '../types';
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
  Mail, 
  Search, 
  Users, 
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Upload
} from 'lucide-react';

interface WelcomeEmailManagementProps {
  onNavigateBack?: () => void;
}

interface WelcomeEmailResult {
  employee_id: string;
  employee_name: string;
  email: string;
  success: boolean;
  message: string;
}

const WelcomeEmailManagement: React.FC<WelcomeEmailManagementProps> = ({ onNavigateBack }) => {
  const [employeesReady, setEmployeesReady] = useState<Employee[]>([]);
  const [employeesMissingInfo, setEmployeesMissingInfo] = useState<Employee[]>([]);
  const [filteredReady, setFilteredReady] = useState<Employee[]>([]);
  const [filteredMissing, setFilteredMissing] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<WelcomeEmailResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [showEmailLogs, setShowEmailLogs] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // Excel upload state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Manual form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    personal_email: '',
    password: '',
    system_email: ''
  });
  
  // Custom credentials modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [customCredentials, setCustomCredentials] = useState({
    personal_email: '',
    password: ''
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employeesReady, employeesMissingInfo, searchTerm]);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await employeeAPI.getEmployeesForWelcomeEmail();
      
      if (response.data.success) {
        setEmployeesReady(response.data.employees_ready || []);
        setEmployeesMissingInfo(response.data.employees_missing_info || []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmailLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const response = await employeeAPI.getEmailLogs({ limit: 100 });
      
      if (response.data.success) {
        setEmailLogs(response.data.logs || []);
        setShowEmailLogs(true);
      }
    } catch (error) {
      console.error('Error loading email logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExcelFile(file);
    }
  };

  const processExcelUpload = async () => {
    if (!excelFile) return;

    try {
      setIsUploading(true);
      setUploadResult(null);

      // Use the API service
      const response = await employeeAPI.processWelcomeEmailExcel(excelFile);

      if (response.data.success) {
        setUploadResult(response.data);
        // Reload employees to show updated data
        await loadEmployees();
        alert(`Successfully processed ${response.data.processed_count} employees`);
      } else {
        alert(`Error: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('Error processing Excel:', error);
      alert(`Failed to process Excel file: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadWelcomeEmailTemplate = () => {
    const templateData = [
      {
        'name': 'John Doe',
        'personal_email': 'john.doe.personal@gmail.com',
        'password': 'TempPassword123!',
        'system_email': 'john.doe@blackroth.co.in'
      },
      {
        'name': 'Jane Smith',
        'personal_email': 'jane.smith.personal@gmail.com',
        'password': 'TempPassword456!',
        'system_email': 'jane.smith@blackroth.co.in'
      }
    ];

    const csvContent = [
      Object.keys(templateData[0]).join(','),
      ...templateData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'welcome_email_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleManualFormSubmit = async () => {
    // Validate form
    if (!manualForm.name || !manualForm.personal_email || !manualForm.password || !manualForm.system_email) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setIsSendingManual(true);

      // Use the API service for manual submission
      const response = await employeeAPI.processWelcomeEmailExcel(null, manualForm);

      if (response.data.success) {
        alert(`Successfully processed and sent welcome email to ${manualForm.name}`);
        // Reset form
        setManualForm({
          name: '',
          personal_email: '',
          password: '',
          system_email: ''
        });
        setShowManualForm(false);
        // Reload employees to show updated data
        await loadEmployees();
      } else {
        alert(`Error: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('Error sending manual welcome email:', error);
      alert(`Failed to send welcome email: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSendingManual(false);
    }
  };

  const resetManualForm = () => {
    setManualForm({
      name: '',
      personal_email: '',
      password: '',
      system_email: ''
    });
  };

  const filterEmployees = () => {
    const term = searchTerm.toLowerCase();
    
    const filteredReady = employeesReady.filter(emp => 
      emp.name.toLowerCase().includes(term) ||
      emp.employee_id.toLowerCase().includes(term) ||
      emp.position.toLowerCase().includes(term) ||
      emp.department?.department_name.toLowerCase().includes(term)
    );
    
    const filteredMissing = employeesMissingInfo.filter(emp => 
      emp.name.toLowerCase().includes(term) ||
      emp.employee_id.toLowerCase().includes(term) ||
      emp.position.toLowerCase().includes(term) ||
      emp.department?.department_name.toLowerCase().includes(term)
    );
    
    setFilteredReady(filteredReady);
    setFilteredMissing(filteredMissing);
  };

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAll = (employees: Employee[]) => {
    const allIds = employees.map(emp => emp.id.toString());
    setSelectedEmployees(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmployees([]);
  };

  const sendBulkWelcomeEmails = async () => {
    if (selectedEmployees.length === 0) {
      alert('Please select at least one employee');
      return;
    }

    try {
      setIsSending(true);
      setShowResults(false);
      
      const response = await employeeAPI.sendBulkWelcomeEmails(selectedEmployees);
      
      if (response.data.success) {
        setSendResults(response.data.results.details || []);
        setShowResults(true);
        setSelectedEmployees([]);
        await loadEmployees(); // Refresh the list
      } else {
        alert(response.data.message || 'Failed to send welcome emails');
      }
    } catch (error: any) {
      console.error('Error sending bulk welcome emails:', error);
      alert(error.response?.data?.message || 'Failed to send welcome emails');
    } finally {
      setIsSending(false);
    }
  };

  const sendSingleWelcomeEmail = async (employeeId: string) => {
    try {
      const response = await employeeAPI.sendWelcomeEmail(employeeId);
      
      if (response.data.success) {
        alert('Welcome email sent successfully!');
        await loadEmployees();
      } else {
        alert(response.data.message || 'Failed to send welcome email');
      }
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      alert(error.response?.data?.message || 'Failed to send welcome email');
    }
  };

  const openCustomCredentialsModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setCustomCredentials({
      personal_email: employee.personal_email || '',
      password: employee.password || ''
    });
    setShowCustomModal(true);
  };

  const sendCustomWelcomeEmail = async () => {
    if (!selectedEmployee) return;

    try {
      const response = await employeeAPI.sendWelcomeEmailWithCredentials(
        selectedEmployee.id.toString(),
        customCredentials
      );
      
      if (response.data.success) {
        alert('Welcome email sent successfully!');
        setShowCustomModal(false);
        await loadEmployees();
      } else {
        alert(response.data.message || 'Failed to send welcome email');
      }
    } catch (error: any) {
      console.error('Error sending custom welcome email:', error);
      alert(error.response?.data?.message || 'Failed to send welcome email');
    }
  };

  const getStatusBadge = (employee: Employee) => {
    if (!employee.personal_email && !employee.password) {
      return <Badge variant="destructive">Missing Both</Badge>;
    } else if (!employee.personal_email) {
      return <Badge variant="destructive">Missing Email</Badge>;
    } else if (!employee.password) {
      return <Badge variant="destructive">Missing Password</Badge>;
    } else {
      return <Badge variant="default">Ready</Badge>;
    }
  };

  const getResultIcon = (result: WelcomeEmailResult) => {
    return result.success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading employees...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome Email Management</h1>
          <p className="text-gray-600">Send welcome emails to employees with login credentials</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowManualForm(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Manual Email
          </Button>
          <Button 
            variant="outline" 
            onClick={loadEmailLogs}
            disabled={isLoadingLogs}
          >
            {isLoadingLogs ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Email History
          </Button>
          {onNavigateBack && (
            <Button variant="outline" onClick={onNavigateBack}>
              Back to Employees
            </Button>
          )}
        </div>
      </div>

      {/* Excel Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Excel for Welcome Emails
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
                onChange={handleExcelUpload}
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload Excel/CSV with name, personal_email, password, system_email columns. 
                System will find employees by email or name match.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={downloadWelcomeEmailTemplate}
              >
                Download Template
              </Button>
              <Button
                onClick={processExcelUpload}
                disabled={!excelFile || isUploading}
              >
                {isUploading ? 'Processing...' : 'Process & Send Emails'}
              </Button>
            </div>
          </div>

          {uploadResult && (
            <Alert variant={uploadResult.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {uploadResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {uploadResult.success
                    ? `Successfully processed ${uploadResult.processed_count} employees and sent ${uploadResult.emails_sent} welcome emails`
                    : 'Processing failed'
                  }
                </AlertDescription>
              </div>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-sm">Errors:</p>
                  <ul className="text-sm list-disc list-inside">
                    {uploadResult.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Ready to Send</p>
                <p className="text-2xl font-bold text-green-600">{employeesReady.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Missing Info</p>
                <p className="text-2xl font-bold text-yellow-600">{employeesMissingInfo.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Employees</p>
                <p className="text-2xl font-bold text-blue-600">{employeesReady.length + employeesMissingInfo.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {selectedEmployees.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedEmployees.length} selected
            </span>
            <Button
              onClick={sendBulkWelcomeEmails}
              disabled={isSending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Selected ({selectedEmployees.length})
            </Button>
            <Button variant="outline" onClick={handleDeselectAll}>
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      {/* Results Modal */}
      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Welcome Email Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sendResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getResultIcon(result)}
                    <div>
                      <p className="font-medium">{result.employee_name}</p>
                      <p className="text-sm text-gray-600">{result.employee_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.success ? 'Sent Successfully' : 'Failed'}
                    </p>
                    {!result.success && (
                      <p className="text-xs text-red-500">{result.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setShowResults(false)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ready Employees Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Ready to Send ({filteredReady.length})</span>
            </CardTitle>
            {filteredReady.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectAll(filteredReady)}
              >
                Select All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredReady.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No employees ready to send welcome emails</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.length === filteredReady.length && filteredReady.length > 0}
                      onChange={() => 
                        selectedEmployees.length === filteredReady.length 
                          ? handleDeselectAll()
                          : handleSelectAll(filteredReady)
                      }
                    />
                  </TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReady.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id.toString())}
                        onChange={() => handleSelectEmployee(employee.id.toString())}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{employee.employee_id}</TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{employee.department?.department_name}</TableCell>
                    <TableCell>{employee.personal_email}</TableCell>
                    <TableCell>{getStatusBadge(employee)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => sendSingleWelcomeEmail(employee.id.toString())}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCustomCredentialsModal(employee)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setManualForm({
                              name: employee.name,
                              personal_email: employee.personal_email || '',
                              password: '',
                              system_email: employee.email || ''
                            });
                            setShowManualForm(true);
                          }}
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Missing Info Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span>Missing Information ({filteredMissing.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMissing.length === 0 ? (
            <p className="text-gray-500 text-center py-4">All employees have complete information</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMissing.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.employee_id}</TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{employee.department?.department_name}</TableCell>
                    <TableCell>{employee.personal_email || 'Not set'}</TableCell>
                    <TableCell>{getStatusBadge(employee)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCustomCredentialsModal(employee)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Set Credentials
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setManualForm({
                              name: employee.name,
                              personal_email: employee.personal_email || '',
                              password: '',
                              system_email: employee.email || ''
                            });
                            setShowManualForm(true);
                          }}
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Custom Credentials Modal */}
      {showCustomModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Send Welcome Email with Custom Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Employee</Label>
                <p className="text-sm text-gray-600">
                  {selectedEmployee.name} ({selectedEmployee.employee_id})
                </p>
              </div>
              
              <div>
                <Label htmlFor="custom-email">Personal Email</Label>
                <Input
                  id="custom-email"
                  type="email"
                  value={customCredentials.personal_email}
                  onChange={(e) => setCustomCredentials({
                    ...customCredentials,
                    personal_email: e.target.value
                  })}
                  placeholder="Enter personal email"
                />
              </div>
              
              <div>
                <Label htmlFor="custom-password">Password</Label>
                <Input
                  id="custom-password"
                  type="password"
                  value={customCredentials.password}
                  onChange={(e) => setCustomCredentials({
                    ...customCredentials,
                    password: e.target.value
                  })}
                  placeholder="Enter temporary password"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={sendCustomWelcomeEmail}
                  disabled={!customCredentials.personal_email || !customCredentials.password}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Logs Modal */}
      {showEmailLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-6xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Email History</span>
                </CardTitle>
                <Button variant="outline" onClick={() => setShowEmailLogs(false)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {emailLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No email logs found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Email Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.employee_name}</p>
                            <p className="text-sm text-gray-500">{log.employee_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.email_type}</Badge>
                        </TableCell>
                        <TableCell>{log.recipient_email}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.status === 'SENT' ? 'default' : log.status === 'FAILED' ? 'destructive' : 'secondary'}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(log.sent_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">
                            {log.message || log.error_message || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Form Modal */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Send Manual Welcome Email</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="manual-name">Employee Name</Label>
                <Input
                  id="manual-name"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                  placeholder="Enter employee name"
                />
              </div>
              
              <div>
                <Label htmlFor="manual-personal-email">Personal Email</Label>
                <Input
                  id="manual-personal-email"
                  type="email"
                  value={manualForm.personal_email}
                  onChange={(e) => setManualForm({...manualForm, personal_email: e.target.value})}
                  placeholder="Enter personal email"
                />
                <p className="text-xs text-gray-500 mt-1">Email where welcome message will be sent</p>
              </div>
              
              <div>
                <Label htmlFor="manual-system-email">System Email</Label>
                <Input
                  id="manual-system-email"
                  type="email"
                  value={manualForm.system_email}
                  onChange={(e) => setManualForm({...manualForm, system_email: e.target.value})}
                  placeholder="Enter system login email"
                />
                <p className="text-xs text-gray-500 mt-1">Email for system login</p>
              </div>
              
              <div>
                <Label htmlFor="manual-password">Password</Label>
                <Input
                  id="manual-password"
                  type="password"
                  value={manualForm.password}
                  onChange={(e) => setManualForm({...manualForm, password: e.target.value})}
                  placeholder="Enter temporary password"
                />
                <p className="text-xs text-gray-500 mt-1">Temporary password for login</p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowManualForm(false);
                    resetManualForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleManualFormSubmit}
                  disabled={isSendingManual || !manualForm.name || !manualForm.personal_email || !manualForm.password || !manualForm.system_email}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSendingManual ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isSendingManual ? 'Sending...' : 'Send Email'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WelcomeEmailManagement;

