/**
 * Component: components\SalaryMethodSelector.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { SalaryMethod } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import { DollarSign, GraduationCap } from 'lucide-react';

interface SalaryMethodSelectorProps {
  salaryMethod: SalaryMethod;
  onMethodChange: (method: SalaryMethod) => void;
}

const SalaryMethodSelector: React.FC<SalaryMethodSelectorProps> = ({
  salaryMethod,
  onMethodChange,
}) => {
  const salaryMethods = [
    {
      value: 'SALARY' as SalaryMethod,
      label: 'Salary',
      description: 'Regular employee salary with full benefits',
      icon: DollarSign,
      color: 'bg-green-100 text-green-800 border-green-200',
    },
    {
      value: 'STIPEND' as SalaryMethod,
      label: 'Stipend',
      description: 'Intern or trainee stipend with limited benefits',
      icon: GraduationCap,
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Salary Method Selection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={salaryMethod}
          onValueChange={onMethodChange}
          className="space-y-4"
        >
          {salaryMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = salaryMethod === method.value;
            
            return (
              <div
                key={method.value}
                className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                }`}
                onClick={() => onMethodChange(method.value)}
              >
                <RadioGroupItem
                  value={method.value}
                  id={method.value}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <Label
                      htmlFor={method.value}
                      className="text-base font-medium cursor-pointer"
                    >
                      {method.label}
                    </Label>
                    <Badge
                      variant="outline"
                      className={`text-xs ${method.color}`}
                    >
                      {method.value}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </div>
            );
          })}
        </RadioGroup>

        {salaryMethod && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">
                Selected: {salaryMethod}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {salaryMethod === 'SALARY'
                ? 'Full salary calculation with all components including PF, HRA, DA, etc.'
                : 'Stipend calculation with basic components and limited deductions.'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalaryMethodSelector;

