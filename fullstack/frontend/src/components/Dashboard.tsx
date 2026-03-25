/**
 * Component: components\Dashboard.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Employee, PayPeriod, SalaryMethod } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Building2,
  Calendar,
  DollarSign,
  Upload,
  ClipboardCheck
} from 'lucide-react';

// Import components
import EmployeeManagement from './EmployeeManagement';
import WelcomeEmailManagement from './WelcomeEmailManagement';
import RelievingLetterSender from './RelievingLetterSender';
import BulkEmployeeSelector from './BulkEmployeeSelector';
import PeriodSelector from './PeriodSelector';
import SalaryMethodSelector from './SalaryMethodSelector';
import BulkPayslipGenerator from './BulkPayslipGenerator';
import MonthlySalaryUpload from './MonthlySalaryUpload';
import ActualSalaryUpload from './ActualSalaryUpload';
import SendPayslipsPanel from './SendPayslipsPanel';
import AdminLeaveApproval from './AdminLeaveApproval';
import { Mail } from 'lucide-react';
import BrandMark from './BrandMark';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');
  
  // State for payslip generation
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [payPeriod, setPayPeriod] = useState<PayPeriod>({ month: '', year: '' });
  const [salaryMethod, setSalaryMethod] = useState<SalaryMethod>('SALARY');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // ignore
    }
  };

  const handleGenerationComplete = () => {
    // Reset form after successful generation
    setSelectedEmployees([]);
    setActiveTab('employees'); // Switch to employees tab
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <BrandMark compact />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 xl:grid-cols-9 h-auto gap-1">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generate Payslips
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Salary
            </TabsTrigger>
            <TabsTrigger value="actual-salary" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Actual Salary
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Manage Employees
            </TabsTrigger>
            <TabsTrigger value="welcome-emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Welcome Emails
            </TabsTrigger>
            <TabsTrigger value="relieving-letter" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Relieving Letter
            </TabsTrigger>
            <TabsTrigger value="leave-approvals" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Leave Approvals
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="send-payslips" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Send Payslips
            </TabsTrigger>
          </TabsList>

          {/* Generate Payslips Tab */}
          <TabsContent value="generate" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Selection */}
              <div className="lg:col-span-2 space-y-6">
                {/* Employee Selection */}
                <BulkEmployeeSelector
                  selectedEmployees={selectedEmployees}
                  onSelectionChange={setSelectedEmployees}
                />

                {/* Period and Method Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <PeriodSelector
                    payPeriod={payPeriod}
                    onPeriodChange={setPayPeriod}
                  />
                  
                  <SalaryMethodSelector
                    salaryMethod={salaryMethod}
                    onMethodChange={setSalaryMethod}
                  />
                </div>
              </div>

              {/* Right Column - Generation */}
              <div className="space-y-6">
                {/* Generation Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Generation Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Selected Employees:</span>
                      <Badge variant="secondary">
                        {selectedEmployees.length}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pay Period:</span>
                      <span className="text-sm font-medium">
                        {payPeriod.month && payPeriod.year 
                          ? `${payPeriod.month} ${payPeriod.year}`
                          : 'Not selected'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Salary Method:</span>
                      <Badge variant="outline">
                        {salaryMethod}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Generation Controls */}
                <BulkPayslipGenerator
                  selectedEmployees={selectedEmployees}
                  payPeriod={payPeriod}
                  salaryMethod={salaryMethod}
                  onGenerationComplete={handleGenerationComplete}
                />
              </div>
            </div>
          </TabsContent>

          {/* Upload Salary Tab */}
          <TabsContent value="upload">
            <MonthlySalaryUpload 
              onSuccessNavigateToGenerate={(period) => {
                if (period?.month && period?.year) {
                  setPayPeriod({ month: period.month, year: String(period.year) });
                }
                setActiveTab('generate');
              }}
            />
          </TabsContent>


          {/* Actual Salary Upload Tab */}
          <TabsContent value="actual-salary" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Selection */}
              <div className="lg:col-span-2 space-y-6">
                {/* Employee Selection */}
                <BulkEmployeeSelector
                  selectedEmployees={selectedEmployees}
                  onSelectionChange={setSelectedEmployees}
                />

                {/* Period Selection */}
                <PeriodSelector
                  payPeriod={payPeriod}
                  onPeriodChange={setPayPeriod}
                />
              </div>

              {/* Right Column - Upload */}
              <div className="space-y-6">
                {/* Upload Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Upload Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Selected Employees:</span>
                      <Badge variant="secondary">
                        {selectedEmployees.length}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pay Period:</span>
                      <span className="text-sm font-medium">
                        {payPeriod.month && payPeriod.year 
                          ? `${payPeriod.month} ${payPeriod.year}`
                          : 'Not selected'
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Actual Salary Upload */}
                {selectedEmployees.length > 0 && payPeriod.month && payPeriod.year ? (
                  <ActualSalaryUpload
                    selectedEmployees={selectedEmployees}
                    payPeriod={payPeriod}
                    onUploadComplete={() => {
                      // Optionally reset selection or show success message
                    }}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Select Employees and Period</h3>
                      <p className="text-sm text-muted-foreground">
                        Please select employees and pay period to upload actual salary data.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Manage Employees Tab */}
          <TabsContent value="employees">
            <EmployeeManagement 
              onNavigateToUpload={() => setActiveTab('upload')}
              onNavigateToWelcomeEmails={() => setActiveTab('welcome-emails')}
            />
          </TabsContent>

          {/* Welcome Emails Tab */}
          <TabsContent value="welcome-emails">
            <WelcomeEmailManagement
              onNavigateBack={() => setActiveTab('employees')}
            />
          </TabsContent>

          {/* Relieving Letter Tab */}
          <TabsContent value="relieving-letter">
            <RelievingLetterSender />
          </TabsContent>

          {/* Leave Approvals Tab */}
          <TabsContent value="leave-approvals">
            <AdminLeaveApproval />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Version:</span>
                    <span className="text-sm font-medium">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Target Capacity:</span>
                    <span className="text-sm font-medium">200-500 Employees</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Batch Size:</span>
                    <span className="text-sm font-medium">25-30 per batch</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Generation Time:</span>
                    <span className="text-sm font-medium">15-30 minutes</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    File Organization
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="font-medium mb-2">File Structure:</p>
                    <code className="block bg-muted p-2 rounded text-xs">
                      payslips/2025/January/payslip_ajay_january.pdf
                    </code>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium mb-2">Features:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>QR Code Integration</li>
                      <li>Indian Currency Formatting</li>
                      <li>Progress Tracking</li>
                      <li>Error Recovery</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Send Payslips Tab */}
          <TabsContent value="send-payslips">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Send Existing Payslips</CardTitle>
              </CardHeader>
              <CardContent>
                <SendPayslipsPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;

