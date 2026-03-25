/**
 * Component: components\PeriodSelector.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { PayPeriod } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Calendar } from 'lucide-react';

interface PeriodSelectorProps {
  payPeriod: PayPeriod;
  onPeriodChange: (period: PayPeriod) => void;
}

const months = [
  { value: 'January', label: 'January' },
  { value: 'February', label: 'February' },
  { value: 'March', label: 'March' },
  { value: 'April', label: 'April' },
  { value: 'May', label: 'May' },
  { value: 'June', label: 'June' },
  { value: 'July', label: 'July' },
  { value: 'August', label: 'August' },
  { value: 'September', label: 'September' },
  { value: 'October', label: 'October' },
  { value: 'November', label: 'November' },
  { value: 'December', label: 'December' },
];

const years = [
  { value: '2023', label: '2023' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
];

const monthDetails = {
  January: { totalDays: 31, workingDays: 23 },
  February: { totalDays: 28, workingDays: 20 },
  March: { totalDays: 31, workingDays: 23 },
  April: { totalDays: 30, workingDays: 22 },
  May: { totalDays: 31, workingDays: 23 },
  June: { totalDays: 30, workingDays: 22 },
  July: { totalDays: 31, workingDays: 23 },
  August: { totalDays: 31, workingDays: 23 },
  September: { totalDays: 30, workingDays: 22 },
  October: { totalDays: 31, workingDays: 23 },
  November: { totalDays: 30, workingDays: 22 },
  December: { totalDays: 31, workingDays: 23 },
};

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  payPeriod,
  onPeriodChange,
}) => {
  const handleMonthChange = (month: string) => {
    onPeriodChange({ ...payPeriod, month });
  };

  const handleYearChange = (year: string) => {
    onPeriodChange({ ...payPeriod, year });
  };

  const getMonthDetails = () => {
    const details = monthDetails[payPeriod.month as keyof typeof monthDetails];
    return details || { totalDays: 0, workingDays: 0 };
  };

  const monthDetails_info = getMonthDetails();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Pay Period Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="month-select">Month</Label>
            <Select value={payPeriod.month} onValueChange={handleMonthChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year-select">Year</Label>
            <Select value={payPeriod.year} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.value} value={year.value}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {payPeriod.month && payPeriod.year && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Period Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Days:</span>
                <span className="ml-2 font-medium">{monthDetails_info.totalDays}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Working Days:</span>
                <span className="ml-2 font-medium">{monthDetails_info.workingDays}</span>
              </div>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Selected Period:</span>
              <span className="ml-2 font-medium">
                {payPeriod.month} {payPeriod.year}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PeriodSelector;

