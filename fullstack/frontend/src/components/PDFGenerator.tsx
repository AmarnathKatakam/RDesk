/**
 * Component: components\PDFGenerator.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { usePDF } from "react-to-pdf";

interface PDFGeneratorProps {
  payslipData?: any;
  isEnabled?: boolean;
  children: (pdfRef: React.RefObject<HTMLElement>) => React.ReactNode;
}

const formatFileName = (name, month, year) => {
  // Title Case, underscores for spaces
  const formattedName = (name || "employee")
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("_");
  // Capitalize month
  const formattedMonth = month ? month.charAt(0).toUpperCase() + month.slice(1).toLowerCase() : "";
  // Ensure year is 4 digits
  const formattedYear = year ? String(year).slice(0, 4) : "";
  return `payslip-${formattedName}-${formattedMonth}-${formattedYear}.pdf`;
};

const PDFGenerator = ({
  payslipData,
  isEnabled = false,
  children,
}: PDFGeneratorProps) => {
  const { toPDF, targetRef: pdfRef } = usePDF({
    filename: formatFileName(
      payslipData?.employeeData?.name,
      payslipData?.payPeriod?.month,
      payslipData?.payPeriod?.year
    ),
    page: { margin: 10 },
  });
  return (
    <div className="w-full">
      {children(pdfRef)}
      
      <div className="mt-6 flex flex-col items-center">
        <Button
          onClick={() => toPDF()}
          disabled={!isEnabled}
          className="w-full md:w-1/2 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 py-2 text-base font-medium"
        >
          <FileDown className="h-5 w-5" />
          Download Payslip as PDF
        </Button>
        {!isEnabled && (
          <p className="text-xs text-destructive mt-2">
            Please fill in all required fields to generate the PDF
          </p>
        )}
      </div>
    </div>
  );
};

export default PDFGenerator;

