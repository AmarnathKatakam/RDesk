/**
 * Component: pages\Documents.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/DataTable';
import { getJson, hrmsApi } from '@/services/hrmsApi';

interface DocumentRow {
  id: number;
  document_code?: string;
  document_name: string;
  document_type: string;
  uploaded_at: string;
  employee_name?: string;
  uploaded_by?: string;
}

interface DocumentResponse {
  documents?: DocumentRow[];
  message?: string;
}

const DocumentsPage: React.FC = () => {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('OTHER');
  const [documentName, setDocumentName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const isAdminView = useMemo(() => {
    const userType = localStorage.getItem('userType');
    const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
    return userType === 'admin' || ['admin', 'hr', 'ceo'].includes(userRole);
  }, []);

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
      const data = await getJson<DocumentResponse>(response);
      setRows(data.documents || []);
    } catch (_error) {
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

      const response = await hrmsApi.uploadDocument(payload);
      if (!response.ok) {
        const data = await getJson<DocumentResponse>(response).catch(() => null);
        throw new Error(data?.message || 'Upload failed');
      }

      setFile(null);
      setDocumentName('');
      await loadDocuments();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload failed');
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

    const response = await hrmsApi.deleteDocument(id);
    if (!response.ok) {
      alert('Delete failed');
      return;
    }

    await loadDocuments();
  };

  const columns: DataTableColumn<DocumentRow>[] = [
    { key: 'name', header: 'Document Name', render: (row) => row.document_name },
    { key: 'type', header: 'Type', render: (row) => row.document_type },
    ...(isAdminView
      ? [
          {
            key: 'employee',
            header: 'Employee',
            render: (row: DocumentRow) => row.employee_name || 'Unknown',
          },
          {
            key: 'uploadedBy',
            header: 'Uploaded By',
            render: (row: DocumentRow) => row.uploaded_by || 'Employee',
          },
        ]
      : [
          {
            key: 'owner',
            header: 'Owner',
            render: () => 'Self',
          },
        ]),
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
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 px-3 text-blue-700 hover:bg-blue-50"
            title="Download document"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-medium">Download</span>
          </button>
          {!isAdminView && (
            <button
              onClick={() => void deleteDocument(row.id)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-3 text-rose-700 hover:bg-rose-50"
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-xs font-medium">Delete</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {isAdminView ? 'Employee Documents' : 'Document Vault'}
        </h1>
        <p className="text-sm text-slate-500">
          {isAdminView
            ? 'Review and download documents uploaded by employees.'
            : 'Upload documents from your dashboard so HR can review them in the admin panel.'}
        </p>
      </div>

      {!isAdminView && (
        <form onSubmit={uploadDocument} className="saas-card saas-section">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              placeholder="Document name"
            />
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
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
              className="h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-900 text-sm font-medium text-white disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyText={isAdminView ? 'No employee documents found.' : 'No documents uploaded yet. Uploaded documents will appear here.'}
      />
    </div>
  );
};

export default DocumentsPage;
