/**
 * Component: components\MonthlySalaryUpload.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Plus, Edit, Trash2, Eye, Loader2, DollarSign } from 'lucide-react';
import { monthlySalaryAPI, employeeAPI } from '../services/api';
import { MonthlySalaryData, Employee } from '../types';

interface UploadResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  errors: string[];
  warnings: string[];
}

interface MonthlySalaryUploadProps {
  onSuccessNavigateToGenerate?: (period: { month: string; year: number }) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

const MonthlySalaryUpload: React.FC<MonthlySalaryUploadProps> = ({ onSuccessNavigateToGenerate }) => {
  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Manual entry states
  const [salaryData, setSalaryData] = useState<MonthlySalaryData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<MonthlySalaryData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form data
  const [salaryForm, setSalaryForm] = useState({
    employee: '',
    month: '',
    year: new Date().getFullYear(),
    basic: 0,
    hra: 0,
    da: 0,
    conveyance: 0,
    medical: 0,
    special_allowance: 0,
    pf_employee: 0,
    professional_tax: 0,
    pf_employer: 0,
    other_deductions: 0,
    salary_advance: 0,
    work_days: 0,
    days_in_month: 0,
    lop_days: 0,
  });

  // Load data
  useEffect(() => {
    loadSalaryData();
    loadEmployees();
  }, [selectedMonth, selectedYear]);

  const loadSalaryData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      if (selectedMonth && selectedMonth !== 'all' && selectedYear) {
        response = await monthlySalaryAPI.getByMonthYear(selectedMonth, selectedYear);
        setSalaryData(response.data.data || []);
      } else {
        response = await monthlySalaryAPI.getAll();
        setSalaryData(response.data.results || response.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data.results || response.data || []);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    }
  };

  const handleCreateSalary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await monthlySalaryAPI.create(salaryForm);
      setSuccess('Monthly salary data created successfully');
      setShowAddForm(false);
      resetForm();
      loadSalaryData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create salary data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSalary = async () => {
    if (!selectedSalary) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await monthlySalaryAPI.update(selectedSalary.id, salaryForm);
      setSuccess('Monthly salary data updated successfully');
      setShowEditForm(false);
      setSelectedSalary(null);
      resetForm();
      loadSalaryData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update salary data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSalary = async (salary: MonthlySalaryData) => {
    if (!confirm(`Are you sure you want to delete salary data for ${salary.employee_name} - ${salary.month} ${salary.year}?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      
      await monthlySalaryAPI.delete(salary.id);
      setSuccess('Monthly salary data deleted successfully');
      loadSalaryData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete salary data');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewSalary = (salary: MonthlySalaryData) => {
    setSelectedSalary(salary);
    setShowViewModal(true);
  };

  const handleEditSalary = (salary: MonthlySalaryData) => {
    setSelectedSalary(salary);
    setSalaryForm({
      employee: String(salary.employee),
      month: salary.month,
      year: salary.year,
      basic: salary.basic,
      hra: salary.hra,
      da: salary.da,
      conveyance: salary.conveyance,
      medical: salary.medical,
      special_allowance: salary.special_allowance,
      pf_employee: salary.pf_employee,
      professional_tax: salary.professional_tax,
      pf_employer: salary.pf_employer,
      other_deductions: salary.other_deductions,
      salary_advance: salary.salary_advance,
      work_days: salary.work_days,
      days_in_month: salary.days_in_month,
      lop_days: salary.lop_days,
    });
    setShowEditForm(true);
  };

  const resetForm = () => {
    setSalaryForm({
      employee: '',
      month: '',
      year: new Date().getFullYear(),
      basic: 0,
      hra: 0,
      da: 0,
      conveyance: 0,
      medical: 0,
      special_allowance: 0,
      pf_employee: 0,
      professional_tax: 0,
      pf_employer: 0,
      other_deductions: 0,
      salary_advance: 0,
      work_days: 0,
      days_in_month: 0,
      lop_days: 0,
    });
  };

  const calculateTotals = () => {
    const totalEarnings = salaryForm.basic + salaryForm.hra + salaryForm.da + 
                         salaryForm.conveyance + salaryForm.medical + 
                         salaryForm.special_allowance + salaryForm.pf_employee;
    
    const totalDeductions = salaryForm.professional_tax + salaryForm.pf_employer + 
                           salaryForm.other_deductions + salaryForm.salary_advance;
    
    const netPay = totalEarnings - totalDeductions;
    
    return { totalEarnings, totalDeductions, netPay };
  };

  const { totalEarnings, totalDeductions, netPay } = calculateTotals();

  // Upload functionality
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !month || !year) {
      alert('Please select a file, month, and year');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setUploadResult(null);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await monthlySalaryAPI.uploadExcel(selectedFile, month, year);

      clearInterval(progressInterval);
      setProgress(100);

      if (response.data.success) {
        setUploadResult(response.data);
        const selectedMonth = month;
        const selectedYear = parseInt(year);
        setSelectedFile(null);
        setMonth('');
        setYear('');
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        onSuccessNavigateToGenerate?.({ month: selectedMonth, year: selectedYear });
        loadSalaryData(); // Refresh the data
      } else {
        setUploadResult({
          success: false,
          imported_count: 0,
          updated_count: 0,
          errors: response.data.errors || ['Upload failed'],
          warnings: []
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        imported_count: 0,
        updated_count: 0,
        errors: [error.response?.data?.message || 'Upload failed'],
        warnings: []
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Excel
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        {/* Upload Excel Tab */}
        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload Monthly Salary Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file-upload">Select Excel File</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Month and Year Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((monthName) => (
                        <SelectItem key={monthName} value={monthName}>
                          {monthName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((yearValue) => (
                        <SelectItem key={yearValue} value={yearValue.toString()}>
                          {yearValue}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !month || !year || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Salary Data
                  </>
                )}
              </Button>

              {/* Progress Bar */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {/* Upload Results */}
              {uploadResult && (
                <div className="space-y-4">
                  {uploadResult.success ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Upload completed successfully! 
                        {uploadResult.imported_count > 0 && ` ${uploadResult.imported_count} records imported.`}
                        {uploadResult.updated_count > 0 && ` ${uploadResult.updated_count} records updated.`}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Upload failed. Please check the errors below.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Errors */}
                  {uploadResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-destructive">Errors:</h4>
                      <div className="space-y-1">
                        {uploadResult.errors.map((error, index) => (
                          <p key={index} className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {uploadResult.warnings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-yellow-600">Warnings:</h4>
                      <div className="space-y-1">
                        {uploadResult.warnings.map((warning, index) => (
                          <p key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Required Columns:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Employee ID - Must match existing employee IDs in the system</li>
                  <li>• Basic - Basic salary amount</li>
                  <li>• HRA - House Rent Allowance</li>
                  <li>• DA - Dearness Allowance</li>
                  <li>• Conveyance - Conveyance allowance</li>
                  <li>• Medical - Medical allowance</li>
                  <li>• Special Allowance - Special allowance amount</li>
                  <li>• PF Employee - Employee PF contribution</li>
                  <li>• Professional Tax - Professional tax amount</li>
                  <li>• PF Employer - Employer PF contribution</li>
                  <li>• Work Days - Number of working days</li>
                  <li>• Days in Month - Total days in the month</li>
                  <li>• LOP Days - Loss of Pay days (optional)</li>
                  <li>• Other Deductions - Any other deductions (optional)</li>
                  <li>• Salary Advance - Salary advance amount (optional)</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Notes:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Employee IDs must exist in the system</li>
                  <li>• If salary data already exists for the month/year, it will be updated</li>
                  <li>• File size limit: 10MB</li>
                  <li>• Supported formats: .xlsx, .xls</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Monthly Salary Management</h1>
              <p className="text-gray-600">Manage monthly salary data for employees</p>
            </div>
            <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Salary Data
            </Button>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Filter by Month & Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="month">Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {MONTHS.map(month => (
                        <SelectItem key={month} value={month}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="year">Year</Label>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={loadSalaryData} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply Filter'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salary Data Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Salary Data ({salaryData.length} records)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Month/Year</TableHead>
                        <TableHead>Basic</TableHead>
                        <TableHead>Total Earnings</TableHead>
                        <TableHead>Total Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Work Days</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryData.map((salary) => (
                        <TableRow key={salary.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{salary.employee_name}</div>
                              <div className="text-sm text-gray-500">{salary.employee_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {salary.month} {salary.year}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{salary.basic.toLocaleString()}</TableCell>
                          <TableCell className="text-green-600 font-medium">
                            ₹{salary.total_earnings.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-red-600">
                            ₹{salary.total_deductions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-blue-600 font-bold">
                            ₹{salary.net_pay.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {salary.work_days}/{salary.days_in_month}
                            {salary.lop_days > 0 && (
                              <div className="text-xs text-red-500">
                                LOP: {salary.lop_days}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewSalary(salary)}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSalary(salary)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSalary(salary)}
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
                  
                  {salaryData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No salary data found for the selected period.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Salary Form Modal */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Monthly Salary Data</DialogTitle>
            <DialogDescription>
              Enter monthly salary details for an employee.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select value={salaryForm.employee} onValueChange={(value) => setSalaryForm({...salaryForm, employee: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month *</Label>
                <Select value={salaryForm.month} onValueChange={(value) => setSalaryForm({...salaryForm, month: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year *</Label>
                <Select value={salaryForm.year.toString()} onValueChange={(value) => setSalaryForm({...salaryForm, year: parseInt(value)})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Days */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Work Days *</Label>
                <Input
                  type="number"
                  value={salaryForm.work_days}
                  onChange={(e) => setSalaryForm({...salaryForm, work_days: parseInt(e.target.value) || 0})}
                  placeholder="22"
                />
              </div>
              <div className="space-y-2">
                <Label>Days in Month *</Label>
                <Input
                  type="number"
                  value={salaryForm.days_in_month}
                  onChange={(e) => setSalaryForm({...salaryForm, days_in_month: parseInt(e.target.value) || 0})}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label>LOP Days</Label>
                <Input
                  type="number"
                  value={salaryForm.lop_days}
                  onChange={(e) => setSalaryForm({...salaryForm, lop_days: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Salary Components */}
            <div className="space-y-4">
              <h4 className="font-medium">Salary Components</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Basic Salary *</Label>
                  <Input
                    type="number"
                    value={salaryForm.basic}
                    onChange={(e) => setSalaryForm({...salaryForm, basic: parseFloat(e.target.value) || 0})}
                    placeholder="50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>HRA *</Label>
                  <Input
                    type="number"
                    value={salaryForm.hra}
                    onChange={(e) => setSalaryForm({...salaryForm, hra: parseFloat(e.target.value) || 0})}
                    placeholder="20000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>DA (Dearness Allowance) *</Label>
                  <Input
                    type="number"
                    value={salaryForm.da}
                    onChange={(e) => setSalaryForm({...salaryForm, da: parseFloat(e.target.value) || 0})}
                    placeholder="5000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conveyance *</Label>
                  <Input
                    type="number"
                    value={salaryForm.conveyance}
                    onChange={(e) => setSalaryForm({...salaryForm, conveyance: parseFloat(e.target.value) || 0})}
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Medical *</Label>
                  <Input
                    type="number"
                    value={salaryForm.medical}
                    onChange={(e) => setSalaryForm({...salaryForm, medical: parseFloat(e.target.value) || 0})}
                    placeholder="1500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Special Allowance *</Label>
                  <Input
                    type="number"
                    value={salaryForm.special_allowance}
                    onChange={(e) => setSalaryForm({...salaryForm, special_allowance: parseFloat(e.target.value) || 0})}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PF Employee *</Label>
                  <Input
                    type="number"
                    value={salaryForm.pf_employee}
                    onChange={(e) => setSalaryForm({...salaryForm, pf_employee: parseFloat(e.target.value) || 0})}
                    placeholder="6000"
                  />
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-4">
              <h4 className="font-medium">Deductions</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Professional Tax *</Label>
                  <Input
                    type="number"
                    value={salaryForm.professional_tax}
                    onChange={(e) => setSalaryForm({...salaryForm, professional_tax: parseFloat(e.target.value) || 0})}
                    placeholder="200"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PF Employer *</Label>
                  <Input
                    type="number"
                    value={salaryForm.pf_employer}
                    onChange={(e) => setSalaryForm({...salaryForm, pf_employer: parseFloat(e.target.value) || 0})}
                    placeholder="6000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Other Deductions</Label>
                  <Input
                    type="number"
                    value={salaryForm.other_deductions}
                    onChange={(e) => setSalaryForm({...salaryForm, other_deductions: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salary Advance</Label>
                  <Input
                    type="number"
                    value={salaryForm.salary_advance}
                    onChange={(e) => setSalaryForm({...salaryForm, salary_advance: parseFloat(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Salary Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Earnings:</span>
                  <div className="font-medium text-green-600">₹{totalEarnings.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Deductions:</span>
                  <div className="font-medium text-red-600">₹{totalDeductions.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-600">Net Pay:</span>
                  <div className="font-bold text-blue-600">₹{netPay.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSalary} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Salary Data'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Salary Form Modal */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Monthly Salary Data</DialogTitle>
            <DialogDescription>
              Update monthly salary details for {selectedSalary?.employee_name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Same form structure as Add form - simplified for brevity */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <Select value={salaryForm.employee} onValueChange={(value) => setSalaryForm({...salaryForm, employee: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month *</Label>
                <Select value={salaryForm.month} onValueChange={(value) => setSalaryForm({...salaryForm, month: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year *</Label>
                <Select value={salaryForm.year.toString()} onValueChange={(value) => setSalaryForm({...salaryForm, year: parseInt(value)})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSalary} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Salary Data'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Salary Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Details</DialogTitle>
            <DialogDescription>
              Monthly salary information for {selectedSalary?.employee_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSalary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Employee</Label>
                  <div className="text-lg font-semibold">{selectedSalary.employee_name}</div>
                  <div className="text-sm text-gray-500">{selectedSalary.employee_id}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Period</Label>
                  <div className="text-lg font-semibold">{selectedSalary.month} {selectedSalary.year}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Work Days</Label>
                  <div className="text-lg">{selectedSalary.work_days}/{selectedSalary.days_in_month}</div>
                  {selectedSalary.lop_days > 0 && (
                    <div className="text-sm text-red-500">LOP: {selectedSalary.lop_days} days</div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Net Pay</Label>
                  <div className="text-2xl font-bold text-blue-600">₹{selectedSalary.net_pay.toLocaleString()}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-green-600 mb-2">Earnings</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>Basic:</span>
                      <span>₹{selectedSalary.basic.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>HRA:</span>
                      <span>₹{selectedSalary.hra.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DA:</span>
                      <span>₹{selectedSalary.da.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Conveyance:</span>
                      <span>₹{selectedSalary.conveyance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Medical:</span>
                      <span>₹{selectedSalary.medical.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Special Allowance:</span>
                      <span>₹{selectedSalary.special_allowance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PF Employee:</span>
                      <span>₹{selectedSalary.pf_employee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total Earnings:</span>
                      <span>₹{selectedSalary.total_earnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-red-600 mb-2">Deductions</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>Professional Tax:</span>
                      <span>₹{selectedSalary.professional_tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PF Employer:</span>
                      <span>₹{selectedSalary.pf_employer.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Deductions:</span>
                      <span>₹{selectedSalary.other_deductions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salary Advance:</span>
                      <span>₹{selectedSalary.salary_advance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total Deductions:</span>
                      <span>₹{selectedSalary.total_deductions.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlySalaryUpload;
