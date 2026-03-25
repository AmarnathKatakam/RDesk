/**
 * Component: components\RelievingLetterSender.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Upload, Send, CheckCircle, XCircle } from 'lucide-react';
import { employeeAdminAPI } from '../services/api';

interface RelievingLetterSenderProps {
  onSuccess?: () => void;
}

const RelievingLetterSender: React.FC<RelievingLetterSenderProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    employee_name: '',
    recipient_email: '',
    relieving_letter: null as File | null,
    experience_letter: null as File | null,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const name = e.target.name;
    setFormData(prev => ({
      ...prev,
      [name]: file
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_name || !formData.recipient_email || !formData.relieving_letter || !formData.experience_letter) {
      setResult({
        success: false,
        message: 'Please fill in all fields and select both PDF files.'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.recipient_email)) {
      setResult({
        success: false,
        message: 'Please enter a valid email address.'
      });
      return;
    }

    // Validate file types
    if (!formData.relieving_letter.name.toLowerCase().endsWith('.pdf') || !formData.experience_letter.name.toLowerCase().endsWith('.pdf')) {
      setResult({
        success: false,
        message: 'Only PDF files are allowed for both documents.'
      });
      return;
    }

    // Validate file sizes (10MB max each)
    if (formData.relieving_letter.size > 10 * 1024 * 1024 || formData.experience_letter.size > 10 * 1024 * 1024) {
      setResult({
        success: false,
        message: 'Each file size must be less than 10MB.'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('employee_name', formData.employee_name);
      formDataToSend.append('recipient_email', formData.recipient_email);
      formDataToSend.append('relieving_letter', formData.relieving_letter);
      formDataToSend.append('experience_letter', formData.experience_letter);

      const response = await employeeAdminAPI.sendRelievingLetter(formDataToSend);

      if (response.data.success) {
        setResult({
          success: true,
          message: response.data.message
        });

        // Reset form on success
        setFormData({
          employee_name: '',
          recipient_email: '',
          relieving_letter: null,
          experience_letter: null,
        });

        // Clear file inputs
        const relievingInput = document.getElementById('relieving_letter') as HTMLInputElement;
        if (relievingInput) {
          relievingInput.value = '';
        }
        const experienceInput = document.getElementById('experience_letter') as HTMLInputElement;
        if (experienceInput) {
          experienceInput.value = '';
        }

        onSuccess?.();
      } else {
        setResult({
          success: false,
          message: response.data.message
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.message || 'Failed to send relieving letter. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send Relieving & Experience Letters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee Name */}
          <div className="space-y-2">
            <Label htmlFor="employee_name">Employee Full Name *</Label>
            <Input
              id="employee_name"
              name="employee_name"
              type="text"
              value={formData.employee_name}
              onChange={handleInputChange}
              placeholder="Enter employee's full name"
              required
            />
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="recipient_email">Recipient Email Address *</Label>
            <Input
              id="recipient_email"
              name="recipient_email"
              type="email"
              value={formData.recipient_email}
              onChange={handleInputChange}
              placeholder="Enter email address to send the letter to"
              required
            />
          </div>

          {/* Relieving Letter File Upload */}
          <div className="space-y-2">
            <Label htmlFor="relieving_letter">Relieving Letter PDF *</Label>
            <div className="flex items-center gap-4">
              <Input
                id="relieving_letter"
                name="relieving_letter"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('relieving_letter')?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose Relieving Letter PDF
              </Button>
              {formData.relieving_letter && (
                <span className="text-sm text-muted-foreground">
                  {formData.relieving_letter.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Only PDF files are allowed. Maximum size: 10MB.
            </p>
          </div>

          {/* Experience Letter File Upload */}
          <div className="space-y-2">
            <Label htmlFor="experience_letter">Experience Letter PDF *</Label>
            <div className="flex items-center gap-4">
              <Input
                id="experience_letter"
                name="experience_letter"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('experience_letter')?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose Experience Letter PDF
              </Button>
              {formData.experience_letter && (
                <span className="text-sm text-muted-foreground">
                  {formData.experience_letter.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Only PDF files are allowed. Maximum size: 10MB.
            </p>
          </div>

          {/* Result Alert */}
          {result && (
            <Alert className={result.success ? 'border-green-500' : 'border-red-500'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription>
                {result.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Letters
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RelievingLetterSender;

