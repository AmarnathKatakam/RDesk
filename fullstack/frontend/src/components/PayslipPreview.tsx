/**
 * Component: components\PayslipPreview.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logo.png";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EmployeeData {
  name: string;
  id: string;
  position: string;
  dob: string;
  doj: string;
  pan: string;
  pf: string;
  bankAccNo: string;
  bankIfsc: string;
  payMode: string;
  location: string;
  department: string;
  healthCardNo: string;
  workDays: number;
  daysInMonth: number;
  lop: number;
  arrearDays: number;
  dol: string;
}

interface SalaryData {
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  special: number;
  pfEmployee: number;
}

interface DeductionData {
  professionalTax: number;
  pfEmployer: number;
  otherDeduction: number;
  salaryAdvance: number;
}

interface PayslipPreviewProps {
  employeeData: EmployeeData;
  salaryData: SalaryData;
  deductionData: DeductionData;
  payPeriod: { month: string; year: string };
  onEmployeeChange: (field: keyof EmployeeData, value: string | number) => void;
  onSalaryChange: (field: keyof SalaryData, value: number) => void;
  onDeductionChange: (field: keyof DeductionData, value: number) => void;
}

const PayslipPreview = ({
  employeeData,
  salaryData,
  deductionData,
  payPeriod,
  onEmployeeChange,
  onSalaryChange,
  onDeductionChange,
}: PayslipPreviewProps) => {
  // Calculate totals
  const totalEarnings =
    salaryData.basic +
    salaryData.hra +
    salaryData.da +
    salaryData.conveyance +
    salaryData.medical +
    salaryData.special +
    salaryData.pfEmployee;
  const totalDeductions =
    deductionData.professionalTax +
    deductionData.pfEmployer +
    deductionData.otherDeduction +
    deductionData.salaryAdvance;
  const netPay = totalEarnings - totalDeductions;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Convert number to words in Indian English format
  const numberToWords = (num: number): string => {
    if (num === 0) return "Zero Only";
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanOneThousand = (n: number): string => {
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
    
    const convert = (n: number): string => {
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

  // QR code data string - contains verified tick symbol, Employee ID and payslip month & year
  const qrData = `✓ Verified|EmpID:${employeeData.id}|Month:${payPeriod.month}|Year:${payPeriod.year}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=100x100`;

  console.log("QR Data:", qrData);
  console.log("QR URL:", qrUrl);

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl space-y-6 border-2 border-black p-10 payslip-container">
      {/* Header */}
      <div className="flex flex-row items-center relative" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
        <div className="w-32 flex-shrink-0" style={{ width: '128px', flexShrink: 0 }}>
          <img src="/logo.png" alt="RothDesk Logo" className="w-full" style={{ width: '100%' }} />
        </div>
        <div className="flex-grow text-center text-sm" style={{ flexGrow: 1, textAlign: 'center', fontSize: '14px' }}>
          <h1 className="text-2xl font-bold" style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: '"Droid Serif", serif' }}>BlackRoth Software Solutions Pvt. Ltd.</h1>
          <p style={{ margin: '4px 0' }}>13th FLOOR, MANJEERA TRINITY CORPORATE, JNTU - HITECH CITY ROAD, 3/d PHASE, KPHB, KUKATPALLY, HYDERABAD - 500072</p>
          <p className="mt-1 font-semibold" style={{ marginTop: '4px', fontWeight: '600' }}>Payslip for the Month of {payPeriod.month} {payPeriod.year}</p>
        </div>
        <div className="w-32 flex-shrink-0 flex flex-col items-end justify-start" style={{ width: '128px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
          <span className="text-2xl uppercase tracking-widest text-primary mt-2" style={{ fontSize: '24px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--primary))', marginTop: '8px' }}>PAYSLIP</span>
        </div>
      </div>
      <div className="border-b-2 border-black mb-4"></div>

      {/* Employee Details */}
      <div>
        <h2 className="text-lg font-semibold border-b pb-1 mb-2">Employee Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <p><strong>Emp ID:</strong> {employeeData.id ? employeeData.id : ""}</p>
          <p><strong>Employee Name:</strong> {employeeData.name ? employeeData.name : ""}</p>
          <p><strong>Designation:</strong> {employeeData.position ? employeeData.position : ""}</p>
          <p><strong>DOB:</strong> {employeeData.dob ? employeeData.dob : ""}</p>
          <p><strong>DOJ:</strong> {employeeData.doj ? employeeData.doj : ""}</p>
          <p><strong>PAN No:</strong> {employeeData.pan ? employeeData.pan : ""}</p>
          <p><strong>PF No:</strong> {employeeData.pf ? employeeData.pf : ""}</p>
          <p><strong>Bank Acc No:</strong> {employeeData.bankAccNo ? employeeData.bankAccNo : ""}</p>
          <p><strong>Bank IFSC:</strong> {employeeData.bankIfsc ? employeeData.bankIfsc : ""}</p>
          <p><strong>Pay Mode:</strong> {employeeData.payMode ? employeeData.payMode : ""}</p>
          <p><strong>Location:</strong> {employeeData.location ? employeeData.location : ""}</p>
          <p><strong>Department:</strong> {employeeData.department ? employeeData.department : ""}</p>
          <p><strong>Health Card No:</strong> {employeeData.healthCardNo ? employeeData.healthCardNo : ""}</p>
          <p><strong>Work Days:</strong> {(employeeData.workDays !== undefined && employeeData.workDays !== null && employeeData.workDays !== 0) ? employeeData.workDays : ""}</p>
          <p><strong>Days in Month:</strong> {(employeeData.daysInMonth !== undefined && employeeData.daysInMonth !== null && employeeData.daysInMonth !== 0) ? employeeData.daysInMonth : ""}</p>
          <p><strong>LOP:</strong> {(employeeData.lop !== undefined && employeeData.lop !== null && employeeData.lop !== 0) ? employeeData.lop : ""}</p>
          <p><strong>Arrear Days:</strong> {(employeeData.arrearDays !== undefined && employeeData.arrearDays !== null && employeeData.arrearDays !== 0) ? employeeData.arrearDays : ""}</p>
          <p><strong>Actual DOL:</strong> {employeeData.dol ? employeeData.dol : ""}</p>
        </div>
      </div>

      {/* Earnings & Deductions */}
      <div>
        <h2 className="text-lg font-semibold border-b pb-1 mb-2">Earnings & Deductions</h2>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border border-gray-300 text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead className="bg-gray-200">
              <tr>
                <th className="border text-left px-4 py-2">Earnings</th>
                <th className="border text-right px-4 py-2">Amount (₹)</th>
                <th className="border text-left px-4 py-2">Deductions</th>
                <th className="border text-right px-4 py-2">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border text-left align-top px-4 py-1">Basic</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.basic)}</td>
                <td className="border text-left align-top px-4 py-1">Professional Tax</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(deductionData.professionalTax)}</td>
              </tr>
              <tr>
                <td className="border text-left align-top px-4 py-1">Dearness Allowance</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.hra)}</td>
                <td className="border text-left align-top px-4 py-1">PF Contribution (Employer)</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(deductionData.pfEmployer)}</td>
              </tr>
              <tr>
                <td className="border text-left align-top px-4 py-1">House Rent Allowance</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.da)}</td>
                <td className="border text-left align-top px-4 py-1">Other Deduction</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(deductionData.otherDeduction)}</td>
              </tr>
              <tr>
                <td className="border text-left align-top px-4 py-1">Conveyance</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.conveyance)}</td>
                <td className="border text-left align-top px-4 py-1">Salary Advance</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(deductionData.salaryAdvance)}</td>
              </tr>
              <tr>
                <td className="border text-left align-top px-4 py-1">Medical Expenses</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.medical)}</td>
                <td className="border"></td>
                <td className="border"></td>
              </tr>
              <tr>
                <td className="border text-left align-top px-4 py-1">Special</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.special)}</td>
                <td className="border"></td>
                <td className="border"></td>
              </tr>
              <tr>
                <td className="border text-left align-top px-4 py-1">PF Contribution (Employee)</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(salaryData.pfEmployee)}</td>
                <td className="border"></td>
                <td className="border"></td>
              </tr>
              <tr className="font-semibold bg-gray-100">
                <td className="border text-left align-top px-4 py-1">Total Earnings</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(totalEarnings)}</td>
                <td className="border text-left align-top px-4 py-1">Total Deductions</td>
                <td className="border text-right align-top px-4 py-1">{formatCurrency(totalDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay and QR */}
      <div className="flex flex-row justify-between items-center mt-6" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
        <div className="text-sm" style={{ fontSize: '14px' }}>
          <h2 className="text-lg font-semibold border-b pb-1 mb-2" style={{ fontSize: '18px', fontWeight: '600', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>Net Pay</h2>
          <p style={{ margin: '4px 0' }}><strong>Amount:</strong> {formatCurrency(netPay)}</p>
          <p style={{ margin: '4px 0' }}><strong>Amount in Words:</strong> {numberToWords(netPay)}</p>
        </div>
        <div className="text-center" style={{ textAlign: 'center' }}>
          <img src={qrUrl} alt="QR Code" className="w-24 h-24 mx-auto" style={{ width: '96px', height: '96px', margin: '0 auto' }} />
          <p className="text-xs mt-1" style={{ fontSize: '12px', marginTop: '4px' }}>Scan to verify</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-700 bg-gray-100 border border-gray-300 p-4 rounded-md space-y-2 mt-6">
        <p><strong>Dear Associate</strong>,</p>
        <p>
          We thank you for being part of RothDesk family! Help others looking for jobs – Ask your friends & family to visit our nearest BlackRoth office to submit their resume or email <strong>jobs@blackroth.com</strong>.
        </p>
        <p>For queries, mail to <strong>info@blackroth.com</strong></p>
      </div>
      <p style={{ textAlign: "center", marginTop: 50, fontSize: 12 }}>
        This is a computer-generated payslip. <strong>No signature is required.</strong>
      </p>
    </div>
  );
};

export default PayslipPreview;

