/**
 * Component: components\ActivateAccount.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeActivationAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Check, X } from 'lucide-react';
import BrandMark from './BrandMark';

const ActivateAccount: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing activation token');
    }
  }, [token]);

  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
    if (error) setError('');
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (passwordStrength < 3) {
      setError('Password is too weak. Use uppercase, lowercase, numbers, and special characters');
      setIsLoading(false);
      return;
    }

    try {
      const response = await employeeActivationAPI.activate({
        token,
        password: formData.password,
        confirm_password: formData.confirmPassword,
      });

      const data = response.data;

      if (data.success) {
        setSuccess('Account activated successfully! Redirecting to onboarding...');
        setTimeout(() => {
          navigate('/onboarding');
        }, 2000);
      } else {
        setError(data.message || 'Activation failed. Please try again.');
      }
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message || err?.message || 'An error occurred. Please try again.';
      setError(serverMessage);
      console.error('Account activation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <BrandMark />
          </div>
          <CardTitle className="text-2xl font-bold text-primary" style={{ fontFamily: '"Droid Serif", serif' }}>
            Activate Your Account
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-2">Set your password to complete activation</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <X className="h-4 w-4 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 mr-2 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Enter a strong password"
                disabled={isLoading}
                required
              />
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i < passwordStrength ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password strength: {passwordStrength === 0 ? 'Very Weak' : passwordStrength === 1 ? 'Weak' : passwordStrength === 2 ? 'Fair' : passwordStrength === 3 ? 'Good' : passwordStrength === 4 ? 'Strong' : 'Very Strong'}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Use at least 8 characters with uppercase, lowercase, numbers, and special characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Confirm your password"
                disabled={isLoading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || passwordStrength < 3}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                'Activate Account'
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            After activation, you'll complete your employee onboarding form
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivateAccount;

