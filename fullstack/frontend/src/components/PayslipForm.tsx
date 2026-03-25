/**
 * Component: components\PayslipForm.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface PayslipFormProps {
  employeeData: any;
  salaryData: any;
  deductionData: any;
  payPeriod: { month: string; year: string };
  onEmployeeChange: (field: string, value: string | number) => void;
  onSalaryChange: (field: string, value: number) => void;
  onDeductionChange: (field: string, value: number) => void;
  onPayPeriodChange: (field: string, value: string) => void;
}

// Optimized DateField component
interface DateFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const DateField = React.memo(({ value, onChange, placeholder = "Pick a date" }: DateFieldProps) => {
  const [open, setOpen] = useState(false);
  const handleSelect = (date: Date | undefined) => {
    onChange(date ? format(date, "yyyy-MM-dd") : "");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? value : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={handleSelect}
          numberOfMonths={1}
          captionLayout="dropdown"
          fromYear={1950}
          toYear={2050}
        />
      </PopoverContent>
    </Popover>
  );
});

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const positions = [
  "Associate Software Engineer",
  "Operations Manager",
  "Project Manager",
  "Manager",
];

const monthDetails = {
  January:   { totalDays: 31, workingDays: 23 },
  February:  { totalDays: 28, workingDays: 20 },
  March:     { totalDays: 31, workingDays: 23 },
  April:     { totalDays: 30, workingDays: 22 },
  May:       { totalDays: 31, workingDays: 23 },
  June:      { totalDays: 30, workingDays: 22 },
  July:      { totalDays: 31, workingDays: 23 },
  August:    { totalDays: 31, workingDays: 23 },
  September: { totalDays: 30, workingDays: 22 },
  October:   { totalDays: 31, workingDays: 23 },
  November:  { totalDays: 30, workingDays: 22 },
  December:  { totalDays: 31, workingDays: 23 },
};

const PayslipForm: React.FC<PayslipFormProps> = ({
  employeeData,
  salaryData,
  deductionData,
  payPeriod,
  onEmployeeChange,
  onSalaryChange,
  onDeductionChange,
  onPayPeriodChange,
}) => {
  // Add state for annual package
  const [annualPackage, setAnnualPackage] = useState(0);

  // Helper to calculate and update all salary/deduction fields
  const handleAnnualPackageChange = (value) => {
    setAnnualPackage(value);
    const monthlySalary = value / 12; // Monthly Salary = Annual Salary / 12
    const basic = Math.round(monthlySalary * 0.4); // Basic Salary = 40% of Monthly Salary
    const da = Math.round(basic * 0.1); // Dearness Allowance = 10% of Basic Salary
    const hra = Math.round(basic * 0.2); // House Rent Allowance = 20% of Basic Salary
    const conveyance = 1600; // Conveyance Allowance = fixed amount ₹1600
    const medical = 1250; // Medical Allowance = fixed amount ₹1250
    const pfEmployee = Math.round(basic * 0.12); // PF Contribution (Employee) = 12% of Basic Salary
    const pfEmployer = Math.round(basic * 0.12); // PF Contribution (Employer) = 12% of Basic Salary
    // Professional Tax calculation - currently fixed, can be improved based on salary slab
    const professionalTax = 200;
    // Special Allowance = Monthly Salary - (Basic + DA + HRA + Medical + Conveyance + PF Employer)
    const special = Math.round(
      monthlySalary - (basic + da + hra + medical + conveyance + pfEmployer)
    );
    // Update salaryData
    onSalaryChange("basic", basic);
    onSalaryChange("da", da);
    onSalaryChange("hra", hra);
    onSalaryChange("medical", medical);
    onSalaryChange("conveyance", conveyance);
    onSalaryChange("pfEmployee", pfEmployee);
    onSalaryChange("special", special);
    // Update deductionData
    onDeductionChange("professionalTax", professionalTax);
    onDeductionChange("pfEmployer", pfEmployer);
  };

  // Net Pay calculation
  const totalEarnings =
    (salaryData.basic || 0) +
    (salaryData.hra || 0) +
    (salaryData.da || 0) +
    (salaryData.conveyance || 0) +
    (salaryData.medical || 0) +
    (salaryData.special || 0) +
    (salaryData.pfEmployee || 0);
  const totalDeductions =
    (deductionData.professionalTax || 0) +
    (deductionData.pfEmployer || 0) +
    (deductionData.otherDeduction || 0) +
    (deductionData.salaryAdvance || 0);
  const netPay = totalEarnings - totalDeductions;

  const formatCurrency = (amount) => {
    if (!amount) return "";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Convert number to words in Indian English format
  const numberToWords = (num) => {
    if (!num || num === 0) return "Zero Only";
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanOneThousand = (n) => {
      if (n === 0) return '';
      
      if (n < 10) return ones[n];
      
      if (n < 20) return teens[n - 10];
      
      if (n < 100) {
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      }
      
      if (n < 1000) {
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertLessThanOneThousand(n % 100) : '');
      }
      
      return '';
    };
    
    const convert = (n) => {
      if (n === 0) return 'Zero';
      
      const crore = Math.floor(n / 10000000);
      const lakh = Math.floor((n % 10000000) / 100000);
      const thousand = Math.floor((n % 100000) / 1000);
      const remainder = n % 1000;
      
      let result = '';
      
      if (crore > 0) {
        result += convertLessThanOneThousand(crore) + ' Crore';
      }
      
      if (lakh > 0) {
        if (result) result += ' ';
        result += convertLessThanOneThousand(lakh) + ' Lakh';
      }
      
      if (thousand > 0) {
        if (result) result += ' ';
        result += convertLessThanOneThousand(thousand) + ' Thousand';
      }
      
      if (remainder > 0) {
        if (result) result += ' ';
        result += convertLessThanOneThousand(remainder);
      }
      
      return result + ' Only';
    };
    
    return convert(num);
  };

  // refs for Employee Details fields
  const employeeFieldRefs = [
    useRef(null), // Emp ID
    useRef(null), // Name
    useRef(null), // Designation
    useRef(null), // DOB
    useRef(null), // DOJ
    useRef(null), // PAN
    useRef(null), // PF
    useRef(null), // Bank Acc No
    useRef(null), // Bank IFSC
    useRef(null), // Pay Mode
    useRef(null), // Location
    useRef(null), // Department
    useRef(null), // Health Card No
    useRef(null), // Work Days
    useRef(null), // Days in Month
    useRef(null), // LOP
    useRef(null), // Arrear Days
    useRef(null), // Actual DOL
  ];

  const handleEmployeeKeyDown = (idx, e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = employeeFieldRefs[idx + 1];
      if (next && next.current) {
        next.current.focus();
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white/50 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
          Employee Payslip Details
        </h2>
        <p className="text-gray-500 mt-1">
          Complete the form below to generate a payslip
        </p>
      </div>
      <div className="space-y-8">
        {/* Annual Package Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Annual Package</h3>
          <div className="flex items-center gap-4">
            <label className="font-medium">Annual Salary (₹):</label>
            <Input
              type="number"
              value={annualPackage === 0 ? "" : annualPackage}
              onChange={e => handleAnnualPackageChange(Number(e.target.value))}
              placeholder="Enter annual CTC"
              min={0}
              className="w-48"
            />
          </div>
        </div>
        {/* Employee Details Section */}
        <section>
          <div className="flex items-center mb-4">
            <div className="h-8 w-1 bg-primary rounded-full mr-3"></div>
            <h3 className="text-lg font-semibold text-gray-700">
              Employee Details
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Emp ID</Label>
              <Input
                value={employeeData.id}
                onChange={e => onEmployeeChange("id", e.target.value)}
                ref={employeeFieldRefs[0]}
                onKeyDown={e => handleEmployeeKeyDown(0, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Employee Name</Label>
              <Input
                value={employeeData.name}
                onChange={e => onEmployeeChange("name", e.target.value)}
                ref={employeeFieldRefs[1]}
                onKeyDown={e => handleEmployeeKeyDown(1, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Select
                value={employeeData.position}
                onValueChange={value => onEmployeeChange("position", value)}
              >
                <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position} value={position}>{position}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>DOB</Label>
              <DateField
                value={employeeData.dob}
                onChange={val => onEmployeeChange("dob", val)}
                placeholder="Date of Birth"
              />
            </div>
            <div className="space-y-2">
              <Label>DOJ</Label>
              <DateField
                value={employeeData.doj}
                onChange={val => onEmployeeChange("doj", val)}
                placeholder="Date of Joining"
              />
            </div>
            <div className="space-y-2">
              <Label>PAN No</Label>
              <Input
                value={employeeData.pan}
                onChange={e => onEmployeeChange("pan", e.target.value)}
                ref={employeeFieldRefs[5]}
                onKeyDown={e => handleEmployeeKeyDown(5, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>PF No</Label>
              <Input
                value={employeeData.pf}
                onChange={e => onEmployeeChange("pf", e.target.value)}
                ref={employeeFieldRefs[6]}
                onKeyDown={e => handleEmployeeKeyDown(6, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Acc No</Label>
              <Input
                value={employeeData.bankAccNo}
                onChange={e => onEmployeeChange("bankAccNo", e.target.value)}
                ref={employeeFieldRefs[7]}
                onKeyDown={e => handleEmployeeKeyDown(7, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank IFSC</Label>
              <Input
                value={employeeData.bankIfsc}
                onChange={e => onEmployeeChange("bankIfsc", e.target.value)}
                ref={employeeFieldRefs[8]}
                onKeyDown={e => handleEmployeeKeyDown(8, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pay Mode</Label>
              <select
                value={employeeData.payMode}
                onChange={e => onEmployeeChange("payMode", e.target.value)}
                className="border rounded px-2 py-1"
                ref={employeeFieldRefs[9]}
                onKeyDown={e => handleEmployeeKeyDown(9, e)}
              >
                <option value="NEFT">NEFT</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={employeeData.location}
                onChange={e => onEmployeeChange("location", e.target.value)}
                ref={employeeFieldRefs[10]}
                onKeyDown={e => handleEmployeeKeyDown(10, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={employeeData.department}
                onChange={e => onEmployeeChange("department", e.target.value)}
                ref={employeeFieldRefs[11]}
                onKeyDown={e => handleEmployeeKeyDown(11, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Health Card No</Label>
              <Input
                value={employeeData.healthCardNo}
                onChange={e => onEmployeeChange("healthCardNo", e.target.value)}
                ref={employeeFieldRefs[12]}
                onKeyDown={e => handleEmployeeKeyDown(12, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Work Days</Label>
              <Input
                type="number"
                value={employeeData.workDays === 0 ? "" : employeeData.workDays}
                onChange={e => onEmployeeChange("workDays", Number(e.target.value))}
                ref={employeeFieldRefs[13]}
                onKeyDown={e => handleEmployeeKeyDown(13, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Days in Month</Label>
              <Input
                type="number"
                value={employeeData.daysInMonth === 0 ? "" : employeeData.daysInMonth}
                onChange={e => onEmployeeChange("daysInMonth", Number(e.target.value))}
                ref={employeeFieldRefs[14]}
                onKeyDown={e => handleEmployeeKeyDown(14, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>LOP</Label>
              <Input
                type="number"
                value={employeeData.lop === 0 ? "" : employeeData.lop}
                onChange={e => onEmployeeChange("lop", Number(e.target.value))}
                ref={employeeFieldRefs[15]}
                onKeyDown={e => handleEmployeeKeyDown(15, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Arrear Days</Label>
              <Input
                type="number"
                value={employeeData.arrearDays === 0 ? "" : employeeData.arrearDays}
                onChange={e => onEmployeeChange("arrearDays", Number(e.target.value))}
                ref={employeeFieldRefs[16]}
                onKeyDown={e => handleEmployeeKeyDown(16, e)}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual DOL</Label>
              <DateField
                value={employeeData.dol}
                onChange={val => onEmployeeChange("dol", val)}
                placeholder="Date of Leaving"
              />
            </div>
          </div>
        </section>
        <Separator className="bg-gray-200" />
        {/* Earnings & Deductions Section */}
        <section>
          <div className="flex items-center mb-4">
            <div className="h-8 w-1 bg-primary rounded-full mr-3"></div>
            <h3 className="text-lg font-semibold text-gray-700">
              Earnings & Deductions
            </h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="overflow-x-auto">
              <table className="w-full table-auto border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-4 py-2 text-left">Earnings</th>
                    <th className="border px-4 py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-4 py-1">Basic</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.basic === 0 ? "" : salaryData.basic} onChange={e => onSalaryChange("basic", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">Dearness Allowance</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.da === 0 ? "" : salaryData.da} onChange={e => onSalaryChange("da", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">House Rent Allowance</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.hra === 0 ? "" : salaryData.hra} onChange={e => onSalaryChange("hra", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">Conveyance</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.conveyance === 0 ? "" : salaryData.conveyance} onChange={e => onSalaryChange("conveyance", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">Medical Expenses</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.medical === 0 ? "" : salaryData.medical} onChange={e => onSalaryChange("medical", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">Special</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.special === 0 ? "" : salaryData.special} onChange={e => onSalaryChange("special", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">PF Contribution (Employee)</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={salaryData.pfEmployee === 0 ? "" : salaryData.pfEmployee} onChange={e => onSalaryChange("pfEmployee", Number(e.target.value))} /></td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="border px-4 py-1">Total Earnings</td>
                    <td className="border px-4 py-1 text-right">{formatCurrency(totalEarnings)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-auto border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-4 py-2 text-left">Deductions</th>
                    <th className="border px-4 py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-4 py-1">Professional Tax</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={deductionData.professionalTax === 0 ? "" : deductionData.professionalTax} onChange={e => onDeductionChange("professionalTax", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">PF Contribution (Employer)</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={deductionData.pfEmployer === 0 ? "" : deductionData.pfEmployer} onChange={e => onDeductionChange("pfEmployer", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">Other Deduction</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={deductionData.otherDeduction === 0 ? "" : deductionData.otherDeduction} onChange={e => onDeductionChange("otherDeduction", Number(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-1">Salary Advance</td>
                    <td className="border px-4 py-1 text-right"><Input type="number" value={deductionData.salaryAdvance === 0 ? "" : deductionData.salaryAdvance} onChange={e => onDeductionChange("salaryAdvance", Number(e.target.value))} /></td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="border px-4 py-1">Total Deductions</td>
                    <td className="border px-4 py-1 text-right">{formatCurrency(totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <Separator className="bg-gray-200" />
        {/* Pay Period Section */}
        <section>
          <div className="flex items-center mb-4">
            <div className="h-8 w-1 bg-primary rounded-full mr-3"></div>
            <h3 className="text-lg font-semibold text-gray-700">
              Pay Period
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={payPeriod.month} onValueChange={value => {
                onPayPeriodChange("month", value);
                const details = monthDetails[value];
                if (details) {
                  onEmployeeChange("daysInMonth", details.totalDays);
                  onEmployeeChange("workDays", details.workingDays);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={payPeriod.year} onValueChange={value => onPayPeriodChange("year", value)}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {["2023", "2024", "2025", "2026", "2027"].map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>
      <div className="mt-8">
        <h3 className="text-lg font-semibold">Net Pay</h3>
        <p><strong>Amount:</strong> {formatCurrency(netPay)}</p>
        <p><strong>Amount in Words:</strong> {numberToWords(netPay)}</p>
      </div>
    </div>
  );
};

export default PayslipForm;

