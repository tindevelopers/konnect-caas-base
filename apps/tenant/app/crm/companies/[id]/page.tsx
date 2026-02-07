"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCompany, updateCompany, deleteCompany } from "@/app/actions/crm/companies";
import { getNotes, createNote } from "@/app/actions/crm/notes";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import ActivityHistory from "@/components/crm/ActivityHistory";
import { ArrowLeftIcon, PencilIcon, TrashIcon, EnvelopeIcon, PhoneIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  email: string | null;
  phone: string | null;
};

type Note = {
  id: string;
  title: string | null;
  content: string;
  type: string;
  created_at: string;
};

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadCompany();
      loadNotes();
    }
  }, [companyId]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await getCompany(companyId);
      if (data) {
        setCompany(data);
        setFormData({
          name: data.name,
          website: data.website || "",
          industry: data.industry || "",
          size: data.size || "",
          email: data.email || "",
          phone: data.phone || "",
        });
      }
    } catch (error) {
      console.error("Error loading company:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const data = await getNotes({ company_id: companyId });
      setNotes(data);
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateCompany(companyId, formData);
      await loadCompany();
      setEditing(false);
    } catch (error: any) {
      console.error("Error updating company:", error);
      alert(error.message || "Failed to update company");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this company?")) {
      return;
    }

    try {
      await deleteCompany(companyId);
      router.push("/crm/companies");
    } catch (error: any) {
      console.error("Error deleting company:", error);
      alert(error.message || "Failed to delete company");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSavingNote(true);
      await createNote({
        contact_id: null,
        company_id: companyId,
        deal_id: null,
        content: newNote,
        type: "note",
      } as any);
      setNewNote("");
      await loadNotes();
    } catch (error: any) {
      console.error("Error creating note:", error);
      alert(error.message || "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading && !company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading company...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Company Not Found" />
        <div className="text-center py-12">
          <p className="text-gray-500">Company not found</p>
          <Link href="/crm/companies">
            <Button className="mt-4">Back to Companies</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={company.name} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/crm/companies">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Industry
                      </label>
                      <input
                        type="text"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Size
                      </label>
                      <select
                        value={formData.size}
                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">Select size</option>
                        <option value="1-10">1-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="201-500">201-500</option>
                        <option value="501-1000">501-1000</option>
                        <option value="1000+">1000+</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Company Name</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{company.name}</p>
                    </div>
                    {company.website && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Website</p>
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lg font-medium text-brand-500 hover:underline flex items-center gap-2"
                        >
                          <GlobeAltIcon className="h-4 w-4" />
                          {company.website}
                        </a>
                      </div>
                    )}
                    {company.industry && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Industry</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{company.industry}</p>
                      </div>
                    )}
                    {company.size && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Company Size</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{company.size}</p>
                      </div>
                    )}
                    {company.email && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                        <a href={`mailto:${company.email}`} className="text-lg font-medium text-brand-500 hover:underline flex items-center gap-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          {company.email}
                        </a>
                      </div>
                    )}
                    {company.phone && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                        <a href={`tel:${company.phone}`} className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          {company.phone}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Activity History */}
            <ActivityHistory companyId={companyId} />

            {/* Notes Section */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notes</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    rows={3}
                  />
                  <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                    Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="border-l-4 border-brand-500 pl-4 py-2">
                        <p className="text-sm text-gray-900 dark:text-white">{note.content}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
