import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface HelpResourcePageProps {
  title: string;
  description: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
}

const HelpResourcePage: React.FC<HelpResourcePageProps> = ({ title, description, sections }) => {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Link
          to="/admin/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <section className="saas-card saas-section">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <article key={section.heading} className="rounded-xl border border-slate-100 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HelpResourcePage;
