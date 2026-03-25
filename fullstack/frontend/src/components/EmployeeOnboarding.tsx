/**
 * Component: components\EmployeeOnboarding.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeActivationAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Check } from 'lucide-react';
import BrandMark from './BrandMark';

const EmployeeOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    dob: '',
    panNumber: '',
    pfNumber: '',
    bankAccount: '',
    ifscCode: '',
    phone: '',
    address: '',
    personalEmail: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (
      !formData.dob ||
      !formData.panNumber ||
      !formData.pfNumber ||
      !formData.bankAccount ||
      !formData.ifscCode ||
      !formData.phone ||
      !formData.address ||
      !formData.personalEmail
    ) {
      setError('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      setError('Please enter a valid 10-digit phone number');
      setIsLoading(false);
      return;
    }

    if (!/^\d{9,18}$/.test(formData.bankAccount)) {
      setError('Please enter a valid bank account number');
      setIsLoading(false);
      return;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
      setError('Invalid IFSC code format. Example: ICIC0000001');
      setIsLoading(false);
      return;
    }

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
      setError('Invalid PAN format. Example: ABCDE1234F');
      setIsLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)) {
      setError('Please enter a valid personal email address');
      setIsLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('dob', formData.dob);
      formDataToSend.append('pan_number', formData.panNumber);
      formDataToSend.append('pf_number', formData.pfNumber);
      formDataToSend.append('bank_account', formData.bankAccount);
      formDataToSend.append('ifsc_code', formData.ifscCode);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('personal_email', formData.personalEmail);

      const response = await employeeActivationAPI.onboard(formDataToSend);

      const data = response.data;

      if (data.success) {
        setSuccess('Onboarding completed successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.message || 'Onboarding failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              Please fill in your details to complete onboarding
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              {/* Required Fields */}
              <div>
                <h3 className="font-semibold mb-4">Required Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pan">PAN Number *</Label>
                    <Input
                      id="pan"
                      type="text"
                      value={formData.panNumber}
                      onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                      placeholder="Example: ABCDE1234F"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pf">PF Number *</Label>
                    <Input
                      id="pf"
                      type="text"
                      value={formData.pfNumber}
                      onChange={(e) => handleInputChange('pfNumber', e.target.value)}
                      placeholder="Enter PF number"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank">Bank Account Number *</Label>
                    <Input
                      id="bank"
                      type="text"
                      value={formData.bankAccount}
                      onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                      placeholder="Enter bank account number"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ifsc">IFSC Code *</Label>
                    <Input
                      id="ifsc"
                      type="text"
                      value={formData.ifscCode}
                      onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                      placeholder="Example: ICIC0000001"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit phone number"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter your address"
                      disabled={isLoading}
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personal_email">Personal Email *</Label>
                    <Input
                      id="personal_email"
                      type="email"
                      value={formData.personalEmail}
                      onChange={(e) => handleInputChange('personalEmail', e.target.value)}
                      placeholder="name@example.com"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    'Complete Onboarding'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeOnboarding;

