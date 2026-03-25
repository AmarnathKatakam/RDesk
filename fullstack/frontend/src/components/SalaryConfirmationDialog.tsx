/**
 * Component: components\SalaryConfirmationDialog.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { Employee, PayPeriod, SalaryCalculationPreview, SalaryPreviewResult } from '../types';
import { salaryPreviewAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Calculator,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface SalaryConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedEmployees: Employee[];
  payPeriod: PayPeriod;
  salaryMethod: string;
}

const SalaryConfirmationDialog: React.FC<SalaryConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedEmployees,
  payPeriod,
  salaryMethod,
}) => {
  const [previewData, setPreviewData] = useState<SalaryCalculationPreview[]>([]);
  const [summary, setSummary] = useState<SalaryPreviewResult['summary'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && selectedEmployees.length > 0) {
      fetchSalaryPreview();
    }
  }, [isOpen, selectedEmployees, payPeriod]);

  const fetchSalaryPreview = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await salaryPreviewAPI.getPreview(
        selectedEmployees.map(emp => emp.id),
        payPeriod.month,
        parseInt(payPeriod.year)
      );
      
      if (response.data.success) {
        setPreviewData(response.data.data);
        setSummary(response.data.summary);
      } else {
        setError('Failed to fetch salary preview');
      }
    } catch (error: any) {
      console.error('Error fetching salary preview:', error);
      setError(error.response?.data?.message || 'Failed to fetch salary preview');
    } finally {
      setIsLoading(false);
    }
  };

  const getDifferenceIcon = (isNearby: boolean, differencePercentage: number) => {
    if (isNearby) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (differencePercentage > 10) {
      return <TrendingUp className="h-4 w-4 text-orange-600" />;
    }
    return <TrendingDown className="h-4 w-4 text-blue-600" />;
  };

  const getDifferenceColor = (isNearby: boolean, differencePercentage: number) => {
    if (isNearby) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (differencePercentage > 10) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getDifferenceTextColor = (isNearby: boolean, differencePercentage: number) => {
    if (isNearby) {
      return 'text-green-600';
    }
    if (differencePercentage > 10) {
      return 'text-orange-600';
    }
    return 'text-blue-600';
  };

  const getVarianceLabel = (isNearby: boolean, differencePercentage: number) => {
    if (isNearby) {
      return 'Nearby';
    }
    if (differencePercentage > 10) {
      return 'High Variance';
    }
    return 'Low Variance';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Salary Calculation Confirmation
          </DialogTitle>
          <DialogDescription>
            Review the salary calculations before generating payslips for {payPeriod.month} {payPeriod.year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Total Employees</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {summary.total_employees}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Nearby Calculations</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.nearby_calculations}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Variance Issues</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">
                    {summary.total_employees - summary.nearby_calculations}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading salary calculations...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Salary Preview Table */}
          {previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Salary Calculation Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Employee</th>
                        <th className="text-left p-2 font-medium">Department</th>
                        <th className="text-right p-2 font-medium">LPA</th>
                        <th className="text-right p-2 font-medium">LPA Monthly</th>
                        <th className="text-right p-2 font-medium">Calculated</th>
                        <th className="text-right p-2 font-medium">Difference</th>
                        <th className="text-center p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((employee) => (
                        <tr key={employee.employee_id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{employee.employee_name}</div>
                              <div className="text-sm text-muted-foreground">{employee.employee_id_code}</div>
                            </div>
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {employee.department}
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(employee.lpa)}
                          </td>
                          <td className="p-2 text-right">
                            {formatCurrency(employee.lpa_monthly)}
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(employee.calculated_monthly)}
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {getDifferenceIcon(employee.is_nearby, employee.difference_percentage)}
                              <span className={`text-sm ${getDifferenceTextColor(employee.is_nearby, employee.difference_percentage)}`}>
                                {formatCurrency(employee.difference)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ({employee.difference_percentage.toFixed(1)}%)
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <Badge className={getDifferenceColor(employee.is_nearby, employee.difference_percentage)}>
                              {getVarianceLabel(employee.is_nearby, employee.difference_percentage)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confirmation Message */}
          {previewData.length > 0 && (
            <Alert>
              <Calculator className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Ready to Generate Payslips</div>
                <p className="text-sm">
                  {summary?.nearby_calculations} out of {summary?.total_employees} employees have calculations within 10% of their LPA monthly equivalent.
                  {summary && summary.total_employees - summary.nearby_calculations > 0 && (
                    <span className="text-orange-600 font-medium">
                      {' '}{summary.total_employees - summary.nearby_calculations} employees have significant variance.
                    </span>
                  )}
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || previewData.length === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Confirm & Generate Payslips
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SalaryConfirmationDialog;

