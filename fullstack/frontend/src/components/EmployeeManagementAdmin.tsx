/**
 * Component: components\EmployeeManagementAdmin.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { employeeAPI, employeeActivationAPI, employeeAdminAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Loader2, Mail, Plus, Trash2, Check, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  location: string;
  doj: string;
  account_activated: boolean;
  onboarding_completed: boolean;
  invitation?: {
    status: string;
    created_at: string;
  };
}

const EmployeeManagementAdmin: React.FC = () => {
  const locationOptions = ['Hyderabad', 'Bangalore', 'Chennai', 'Mumbai', 'Pune', 'Remote'];
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('list');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New Employee Form
  const [newEmployeeForm, setNewEmployeeForm] = useState({
    employee_id: '',
    name: '',
    email: '',
    location: '',
    doj: '',
  });

  // Bulk Release Form
  const [releaseForm, setReleaseForm] = useState({
    month: '',
    year: new Date().getFullYear().toString(),
  });

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validate email ends with @blackroth.in
    if (!newEmployeeForm.email.endsWith('@blackroth.in')) {
      setError('Email must end with @blackroth.in');
      setIsLoading(false);
      return;
    }

    try {
      const response = await employeeAPI.create({
        ...newEmployeeForm,
        employee_id: newEmployeeForm.employee_id.toUpperCase(),
      });

      if (response.data.success || response.status === 201 || response.status === 200) {
        setSuccess(response.data.message || 'Employee added and activation invitation sent');
        setNewEmployeeForm({
          employee_id: '',
          name: '',
          email: '',
          location: '',
          doj: '',
        });
        loadEmployees();
      } else {
        setError(response.data.message || 'Failed to add employee');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvitation = async (employeeId: number) => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await employeeActivationAPI.sendInvitation(employeeId);

      const data = response.data;
      if (!data?.success) {
        setError(data.message || 'Failed to send invitation');
        return;
      }

      if (data.email_sent === false) {
        const deliveryHint = data?.delivery_hint ? ` Reason: ${data.delivery_hint}` : '';
        const activationLink = data?.activation_link ? ` Activation link: ${data.activation_link}` : '';
        setError(`Invitation created, but email was not delivered automatically.${deliveryHint}${activationLink}`);
        loadEmployees();
        return;
      }

      setSuccess(data.message || 'Invitation sent successfully');
      loadEmployees();
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkReleasePayslips = async () => {
    if (!releaseForm.month) {
      setError('Please select a month');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await employeeAdminAPI.bulkReleasePayslips({
        month: releaseForm.month,
        year: parseInt(releaseForm.year),
        selected_employees: selectedEmployees.length > 0 ? selectedEmployees : undefined,
      });

      const data = response.data;
      if (data.success) {
        setSuccess(data.message);
        setSelectedEmployees([]);
      } else {
        setError(data.message || 'Failed to release payslips');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      const data = response.data;
      if (Array.isArray(data)) {
        setEmployees(data);
      } else if (data.results) {
        setEmployees(data.results);
      }
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Employee List</TabsTrigger>
          <TabsTrigger value="add">Add Employee</TabsTrigger>
          <TabsTrigger value="release">Release Payslips</TabsTrigger>
        </TabsList>

        {/* Error and Success Alerts */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mt-4 bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Employee List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Employee ID</th>
                      <th className="text-left py-3 px-4">Name</th>
                      <th className="text-left py-3 px-4">Email</th>
                      <th className="text-left py-3 px-4">Location</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{emp.employee_id}</td>
                        <td className="py-3 px-4">{emp.name}</td>
                        <td className="py-3 px-4">{emp.email}</td>
                        <td className="py-3 px-4">{emp.location}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {emp.account_activated ? (
                              <Badge className="bg-green-600">Activated</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                            {emp.onboarding_completed && (
                              <Badge className="bg-blue-600">Onboarded</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {!emp.account_activated && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendInvitation(emp.id)}
                              disabled={isLoading}
                              className="gap-2"
                            >
                              <Mail className="h-4 w-4" />
                              Send Invite
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Employee Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add New Employee</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee_id">Employee ID *</Label>
                    <Input
                      id="employee_id"
                      value={newEmployeeForm.employee_id}
                      onChange={(e) => setNewEmployeeForm({...newEmployeeForm, employee_id: e.target.value})}
                      placeholder="e.g., EMP001"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newEmployeeForm.name}
                      onChange={(e) => setNewEmployeeForm({...newEmployeeForm, name: e.target.value})}
                      placeholder="Full name"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newEmployeeForm.email}
                      onChange={(e) => setNewEmployeeForm({...newEmployeeForm, email: e.target.value})}
                      placeholder="name@blackroth.in"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <select
                      id="location"
                      value={newEmployeeForm.location}
                      onChange={(e) => setNewEmployeeForm({...newEmployeeForm, location: e.target.value})}
                      disabled={isLoading}
                      required
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      <option value="">Select location</option>
                      {locationOptions.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="doj">Date of Joining *</Label>
                    <Input
                      id="doj"
                      type="date"
                      value={newEmployeeForm.doj}
                      onChange={(e) => setNewEmployeeForm({...newEmployeeForm, doj: e.target.value})}
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={isLoading} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {isLoading ? 'Adding...' : 'Add Employee'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Release Payslips Tab */}
        <TabsContent value="release" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Release Payslips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Month *</Label>
                  <select
                    id="month"
                    value={releaseForm.month}
                    onChange={(e) => setReleaseForm({...releaseForm, month: e.target.value})}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Month</option>
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    type="number"
                    value={releaseForm.year}
                    onChange={(e) => setReleaseForm({...releaseForm, year: e.target.value})}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Select Employees</h3>
                <div className="border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                  {employees.filter(e => e.account_activated && e.onboarding_completed).map(emp => (
                    <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer rounded">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(emp.id)}
                        onChange={() => toggleEmployeeSelection(emp.id)}
                        disabled={isLoading}
                        className="w-4 h-4"
                      />
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-sm text-muted-foreground">{emp.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEmployees([])}
                  disabled={isLoading}
                >
                  Clear Selection
                </Button>
                <Button
                  onClick={handleBulkReleasePayslips}
                  disabled={isLoading || selectedEmployees.length === 0 || !releaseForm.month}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Releasing...
                    </>
                  ) : (
                    `Release Payslips (${selectedEmployees.length} selected)`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeManagementAdmin;

