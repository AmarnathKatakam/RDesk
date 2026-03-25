/**
 * Component: components\Modal.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
  title,
  open,
  onClose,
  children,
  widthClassName = 'max-w-2xl',
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40"
        aria-label="Close modal"
      />
      <div className={`relative w-full ${widthClassName} saas-card`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export default Modal;

