/**
 * Component: components\EmployeeDashboard.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeDashboardAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LogOut, User, FileText, Clock, Download, UserCheck, UserX, Calendar, AlertCircle, FolderOpen, Users } from 'lucide-react';
import LeaveManagement from './LeaveManagement';
import DocumentVault from './DocumentVault';
import EmployeeDirectory from './EmployeeDirectory';
import NotificationCenter from './NotificationCenter';
import BrandMark from './BrandMark';

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  location: string;
  date_of_joining: string;
}

interface Payslip {
  id: number;
  pay_period_month: string;
  pay_period_year: number;
  net_pay: number;
  is_released: boolean;
  pdf_path: string;
  generated_at: string;
}

interface Attendance {
  date: string;
  sign_in_time: string | null;
  sign_out_time: string | null;
}

const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [todayAttendance, setTodayAttendance] = useState<{
    signedIn: boolean;
    signedOut: boolean;
    signInTime: string | null;
    signOutTime: string | null;
  }>({
    signedIn: false,
    signedOut: false,
    signInTime: null,
    signOutTime: null,
  });

  useEffect(() => {
    void loadEmployeeData();
  }, []);

  const loadEmployeeData = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const userType = localStorage.getItem('userType');

      if (!userId || userType !== 'employee') {
        navigate('/login');
        return;
      }

      const profileResponse = await employeeDashboardAPI.getProfile(userId);
      const profileData = profileResponse.data;
      if (profileData.success) {
        setEmployee(profileData.profile);
      }

      const payslipsResponse = await employeeDashboardAPI.getPayslips(userId);
      const payslipsData = payslipsResponse.data;
      if (payslipsData.success) {
        setPayslips(payslipsData.payslips);
      }

      const attendanceResponse = await employeeDashboardAPI.getAttendanceHistory(userId);
      const attendanceData = attendanceResponse.data;
      if (attendanceData.success) {
        setAttendance(attendanceData.attendance);
        checkTodayAttendance(attendanceData.attendance);
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkTodayAttendance = (attendanceList: Attendance[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = attendanceList.find((record) => record.date === today);

    if (todayRecord) {
      setTodayAttendance({
        signedIn: !!todayRecord.sign_in_time,
        signedOut: !!todayRecord.sign_out_time,
        signInTime: todayRecord.sign_in_time,
        signOutTime: todayRecord.sign_out_time,
      });
    }
  };

  const handleSignIn = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await employeeDashboardAPI.signIn(userId!);

      const data = response.data;
      if (data.success) {
        setTodayAttendance((prev) => ({
          ...prev,
          signedIn: true,
          signInTime: new Date().toLocaleTimeString(),
        }));
      }
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await employeeDashboardAPI.signOut(userId!);

      const data = response.data;
      if (data.success) {
        setTodayAttendance((prev) => ({
          ...prev,
          signedOut: true,
          signOutTime: new Date().toLocaleTimeString(),
        }));
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('userType');
    navigate('/login');
  };

  const handleDownloadPayslip = (payslip: Payslip) => {
    window.open(`/media/${payslip.pdf_path}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <BrandMark compact />
            </div>

            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{employee?.name}</p>
                <p className="text-xs text-muted-foreground">Employee</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 xl:grid-cols-7 h-auto gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="payslips" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Payslips
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Leave
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="directory" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Directory
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Employee ID</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{employee?.employee_id}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{employee?.location}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Date of Joining</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">{new Date(employee?.date_of_joining || '').toLocaleDateString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Sign In</p>
                      {todayAttendance.signedIn && <p className="text-xs text-muted-foreground">{todayAttendance.signInTime}</p>}
                    </div>
                    <div>
                      {todayAttendance.signedIn ? (
                        <Badge className="bg-green-600">Signed In</Badge>
                      ) : (
                        <Button size="sm" onClick={handleSignIn}>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Sign In
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Sign Out</p>
                      {todayAttendance.signedOut && <p className="text-xs text-muted-foreground">{todayAttendance.signOutTime}</p>}
                    </div>
                    <div>
                      {todayAttendance.signedOut ? (
                        <Badge className="bg-gray-600">Signed Out</Badge>
                      ) : todayAttendance.signedIn ? (
                        <Button size="sm" onClick={handleSignOut}>
                          <UserX className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      ) : (
                        <Badge variant="outline">Sign in first</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{employee?.employee_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{employee?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{employee?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{employee?.location}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Joining</p>
                    <p className="font-medium">{new Date(employee?.date_of_joining || '').toLocaleDateString()}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => navigate('/employee/profile/edit')}>
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payslips">
            {payslips.length > 0 ? (
              <div className="space-y-4">
                {payslips.map((payslip) => (
                  <Card key={payslip.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {payslip.pay_period_month} {payslip.pay_period_year}
                          </p>
                          <p className="text-sm text-muted-foreground">Net Salary: Rs {payslip.net_pay?.toFixed(2)}</p>
                        </div>
                        <Button variant="default" size="sm" onClick={() => handleDownloadPayslip(payslip)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No payslips released yet</p>
                  <p className="text-sm text-muted-foreground">Your payslips will appear here once released by admin</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="attendance">
            {attendance.length > 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Date</th>
                          <th className="text-left py-2 px-4">Sign In</th>
                          <th className="text-left py-2 px-4">Sign Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((record, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-4">{new Date(record.date).toLocaleDateString()}</td>
                            <td className="py-2 px-4">{record.sign_in_time ? new Date(record.sign_in_time).toLocaleTimeString() : '-'}</td>
                            <td className="py-2 px-4">{record.sign_out_time ? new Date(record.sign_out_time).toLocaleTimeString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No attendance records yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="leave">
            <LeaveManagement />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentVault />
          </TabsContent>

          <TabsContent value="directory">
            <EmployeeDirectory />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default EmployeeDashboard;

