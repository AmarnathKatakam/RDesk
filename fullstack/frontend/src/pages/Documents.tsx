/**
 * Component: pages\Documents.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useState } from 'react';
import { Upload, Download, Trash2 } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface DocumentRow {
  id: number;
  document_name: string;
  document_type: string;
  uploaded_at: string;
  employee_name?: string;
  uploaded_by?: string;
}

const DocumentsPage: React.FC = () => {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('OTHER');
  const [documentName, setDocumentName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    void loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await hrmsApi.getDocuments();
      if (!response.ok) {
        setRows([]);
        return;
      }
      const data = await getJson<{ documents?: DocumentRow[] }>(response);
      setRows(data.documents || []);
    } catch (error) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      const payload = new FormData();
      payload.append('file', file);
      payload.append('document_type', documentType);
      payload.append('document_name', documentName || file.name);
      await hrmsApi.uploadDocument(payload);
      setFile(null);
      setDocumentName('');
      await loadDocuments();
    } catch (error) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (id: number, name: string) => {
    const response = await hrmsApi.downloadDocument(id);
    if (!response.ok) {
      alert('Download failed');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteDocument = async (id: number) => {
    if (!window.confirm('Delete this document?')) return;
    await hrmsApi.deleteDocument(id);
    await loadDocuments();
  };

  const columns: DataTableColumn<DocumentRow>[] = [
    { key: 'name', header: 'Document Name', render: (row) => row.document_name },
    { key: 'employee', header: 'Employee', render: (row) => row.employee_name || 'Self' },
    { key: 'uploadedBy', header: 'Uploaded By', render: (row) => row.uploaded_by || 'System' },
    {
      key: 'uploadedAt',
      header: 'Upload Date',
      render: (row) => new Date(row.uploaded_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => void downloadDocument(row.id, row.document_name)}
            className="h-8 px-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => void deleteDocument(row.id)}
            className="h-8 px-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Document Vault</h1>
        <p className="text-sm text-slate-500">Upload, download, and manage employee documents.</p>
      </div>

      <form onSubmit={uploadDocument} className="saas-card saas-section">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={documentName}
            onChange={(event) => setDocumentName(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="Document name"
          />
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm bg-white"
          >
            <option value="PAN">PAN</option>
            <option value="AADHAAR">AADHAAR</option>
            <option value="BANK_DOC">BANK_DOC</option>
            <option value="CERTIFICATE">CERTIFICATE</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm py-2"
            required
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className="h-10 rounded-xl bg-blue-900 text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={rows}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyText="No documents found."
      />
    </div>
  );
};

export default DocumentsPage;

