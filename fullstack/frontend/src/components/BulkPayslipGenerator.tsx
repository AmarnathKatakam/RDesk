/**
 * Component: components\BulkPayslipGenerator.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState } from 'react';
import { Employee, PayPeriod, SalaryMethod, GenerationProgress } from '../types';
import { payslipAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users,
  FileText,
  AlertTriangle,
  Loader2,
  Calculator
} from 'lucide-react';
import SalaryConfirmationDialog from './SalaryConfirmationDialog';

interface BulkPayslipGeneratorProps {
  selectedEmployees: Employee[];
  payPeriod: PayPeriod;
  salaryMethod: SalaryMethod;
  onGenerationComplete?: () => void;
}

const BulkPayslipGenerator: React.FC<BulkPayslipGeneratorProps> = ({
  selectedEmployees,
  payPeriod,
  salaryMethod,
  onGenerationComplete,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [missingSalaryData, setMissingSalaryData] = useState<string[]>([]);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string>('');

  const canGenerate = selectedEmployees.length > 0 && payPeriod.month && payPeriod.year && salaryMethod;

  const handleGenerate = () => {
    if (!canGenerate) return;
    setShowConfirmationDialog(true);
  };

  const handleConfirmGeneration = async () => {
    try {
      setIsGenerating(true);
      setError('');
      setProgress(null);

      const response = await payslipAPI.bulkGenerate({
        employee_ids: selectedEmployees.map(emp => emp.id),
        pay_period: payPeriod,
        salary_method: salaryMethod,
      });

      const { task_id } = response.data;
      
      // Start polling for progress
      pollGenerationProgress(task_id);
    } catch (error: any) {
      console.error('Generation failed:', error);
      // Check if it's a missing salary data error
      if (error.response?.data?.missing_employees) {
        setMissingSalaryData(error.response.data.missing_employees);
      }
      setError(error.response?.data?.message || 'Failed to start payslip generation');
      setIsGenerating(false);
    }
  };

  const pollGenerationProgress = async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await payslipAPI.getGenerationStatus(taskId);
        const progressData = response.data;
        setProgress(progressData);

        if (progressData.is_complete) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setIsPaused(false);
          
          if (progressData.status === 'COMPLETED') {
            setInfoMessage('Payslips generated and emails sent to employees with email set.');
            onGenerationComplete?.();
          } else if (progressData.status === 'FAILED') {
            setError('Payslip generation failed. Please try again.');
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        clearInterval(pollInterval);
        setIsGenerating(false);
        setError('Failed to track generation progress');
      }
    }, 2000);

    // Store interval ID for cleanup
    (pollInterval as any).id = taskId;
  };

  const handlePause = () => {
    setIsPaused(true);
    // In a real implementation, you would call an API to pause the generation
  };

  const handleResume = () => {
    setIsPaused(false);
    // In a real implementation, you would call an API to resume the generation
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'IN_PROGRESS':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Payslip Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Pay Period</span>
              </div>
              <p className="text-lg font-semibold">
                {payPeriod.month} {payPeriod.year}
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Salary Method</span>
              </div>
              <Badge variant="outline" className="text-sm">
                {salaryMethod}
              </Badge>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generation Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              size="lg"
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Payslips...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Preview & Generate Payslips
                </>
              )}
            </Button>

            {isGenerating && (
              <Button
                variant="outline"
                onClick={isPaused ? handleResume : handlePause}
                disabled={progress?.is_complete}
              >
                {isPaused ? (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
            )}
          </div>

          {!canGenerate && (
            <p className="text-sm text-muted-foreground">
              Please select employees, pay period, and salary method to generate payslips.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(progress.status)}
              Generation Progress
              <Badge className={getStatusColor(progress.status)}>
                {progress.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.completed} / {progress.total}</span>
              </div>
              <Progress 
                value={(progress.completed / progress.total) * 100} 
                className="h-2"
              />
              <p className="text-sm text-muted-foreground">
                {Math.round((progress.completed / progress.total) * 100)}% Complete
              </p>
            </div>

            {/* Progress Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Current Batch</div>
                <div className="text-lg font-semibold">
                  {progress.current_batch} / {progress.total_batches}
                </div>
              </div>
              
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Batch Size</div>
                <div className="text-lg font-semibold">{progress.batch_size}</div>
              </div>
              
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Time Remaining</div>
                <div className="text-lg font-semibold text-primary">
                  {formatTime(progress.time_remaining)}
                </div>
              </div>
              
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Errors</div>
                <div className="text-lg font-semibold text-red-600">
                  {progress.errors.length}
                </div>
              </div>
            </div>

            {/* Errors */}
            {progress.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Generation Errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {progress.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Completion Message */}
            {progress.is_complete && progress.status === 'COMPLETED' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">Generation Complete!</div>
                  <p className="text-sm mt-1">
                    Successfully generated {progress.completed} payslips. Files are organized in the payslips directory. {infoMessage}
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Missing Salary Data Warning */}
      {missingSalaryData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Missing Salary Data</div>
                <p className="text-sm mb-2">
                  The following employees don't have salary data for {payPeriod.month} {payPeriod.year}:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {missingSalaryData.map((employeeName, index) => (
                    <li key={index} className="text-sm">{employeeName}</li>
                  ))}
                </ul>
                <p className="text-sm mt-2">
                  Please upload salary data using the "Upload Salary" tab before generating payslips.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Salary Confirmation Dialog */}
      <SalaryConfirmationDialog
        isOpen={showConfirmationDialog}
        onClose={() => setShowConfirmationDialog(false)}
        onConfirm={handleConfirmGeneration}
        selectedEmployees={selectedEmployees}
        payPeriod={payPeriod}
        salaryMethod={salaryMethod}
      />
    </div>
  );
};

export default BulkPayslipGenerator;

