/**
 * Component: components\ActualSalaryUpload.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { Employee, PayPeriod, ActualSalaryCredited, ActualSalaryUploadResult } from '../types';
import { actualSalaryAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  DollarSign,
  Users,
  FileSpreadsheet
} from 'lucide-react';

interface ActualSalaryUploadProps {
  selectedEmployees: Employee[];
  payPeriod: PayPeriod;
  onUploadComplete?: () => void;
}

interface EmployeeSalaryInput {
  employee_id: string;
  employee_name: string;
  actual_salary_credited: number;
}

const ActualSalaryUpload: React.FC<ActualSalaryUploadProps> = ({
  selectedEmployees,
  payPeriod,
  onUploadComplete,
}) => {
  const [employeeSalaries, setEmployeeSalaries] = useState<EmployeeSalaryInput[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ActualSalaryUploadResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [existingData, setExistingData] = useState<ActualSalaryCredited[]>([]);

  useEffect(() => {
    if (selectedEmployees.length > 0) {
      initializeEmployeeSalaries();
      fetchExistingData();
    }
  }, [selectedEmployees, payPeriod]);

  const initializeEmployeeSalaries = () => {
    const salaries = selectedEmployees.map(emp => ({
      employee_id: String(emp.id),
      employee_name: emp.name,
      actual_salary_credited: 0,
    }));
    setEmployeeSalaries(salaries);
  };

  const fetchExistingData = async () => {
    try {
      const year = Number.parseInt(payPeriod.year, 10);
      if (Number.isNaN(year)) {
        return;
      }

      const response = await actualSalaryAPI.getByMonthYear(payPeriod.month, year);
      if (response.data.success) {
        setExistingData(response.data.data);
        
        // Pre-fill existing data
        setEmployeeSalaries(prev => 
          prev.map(emp => {
            const existing = response.data.data.find((item: ActualSalaryCredited) => 
              String(item.employee_id) === emp.employee_id
            );
            return {
              ...emp,
              actual_salary_credited: existing ? existing.actual_salary_credited : 0,
            };
          })
        );
      }
    } catch (error) {
      console.error('Error fetching existing data:', error);
    }
  };

  const handleSalaryChange = (employeeId: string, value: string) => {
    const salary = parseFloat(value) || 0;
    setEmployeeSalaries(prev =>
      prev.map(emp =>
        emp.employee_id === employeeId
          ? { ...emp, actual_salary_credited: salary }
          : emp
      )
    );
  };

  const handleUpload = async () => {
    const validSalaries = employeeSalaries.filter(emp => emp.actual_salary_credited > 0);
    
    if (validSalaries.length === 0) {
      alert('Please enter at least one salary amount');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setUploadResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await actualSalaryAPI.upload(
        validSalaries.map(emp => ({
          employee_id: emp.employee_id,
          actual_salary_credited: emp.actual_salary_credited,
        })),
        payPeriod.month,
        Number.parseInt(payPeriod.year, 10)
      );

      clearInterval(progressInterval);
      setProgress(100);

      if (response.data.success) {
        setUploadResult(response.data);
        onUploadComplete?.();
      } else {
        setUploadResult({
          success: false,
          uploaded_count: 0,
          updated_count: 0,
          errors: response.data.errors || ['Upload failed'],
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        uploaded_count: 0,
        updated_count: 0,
        errors: [error.response?.data?.message || 'Upload failed'],
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEmployeeStatus = (employeeId: string) => {
    const existing = existingData.find(item => String(item.employee_id) === employeeId);
    return existing ? 'updated' : 'new';
  };

  const totalAmount = employeeSalaries.reduce((sum, emp) => sum + emp.actual_salary_credited, 0);
  const enteredCount = employeeSalaries.filter(emp => emp.actual_salary_credited > 0).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Upload Actual Salary Credited
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Selected Employees</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {selectedEmployees.length}
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Entered Salaries</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {enteredCount}
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total Amount</span>
              </div>
              <p className="text-lg font-semibold">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {/* Employee Salary Inputs */}
          <div className="space-y-4">
            <h4 className="font-medium">Enter Actual Salary Credited for {payPeriod.month} {payPeriod.year}</h4>
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {employeeSalaries.map((employee) => {
                const status = getEmployeeStatus(employee.employee_id);
                return (
                  <div key={employee.employee_id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{employee.employee_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Employee ID: {selectedEmployees.find(emp => String(emp.id) === employee.employee_id)?.employee_id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`salary-${employee.employee_id}`} className="text-sm">
                        Amount (₹)
                      </Label>
                      <Input
                        id={`salary-${employee.employee_id}`}
                        type="number"
                        value={employee.actual_salary_credited || ''}
                        onChange={(e) => handleSalaryChange(employee.employee_id, e.target.value)}
                        placeholder="0"
                        className="w-32"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <Badge variant={status === 'updated' ? 'default' : 'secondary'}>
                      {status === 'updated' ? 'Update' : 'New'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={enteredCount === 0 || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Actual Salary Data
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
                    {uploadResult.uploaded_count > 0 && ` ${uploadResult.uploaded_count} new records uploaded.`}
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
            <h4 className="font-medium">How to use:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Enter the actual salary amount credited to each employee for the selected month</li>
              <li>• Leave the field empty or 0 if no salary was credited to an employee</li>
              <li>• Existing data will be updated if already uploaded for this month</li>
              <li>• This data will be used for payslip generation and record keeping</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Notes:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Only employees with salary amounts &gt; 0 will be uploaded</li>
              <li>• You can update the data multiple times for the same month</li>
              <li>• The system tracks who uploaded the data and when</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActualSalaryUpload;

