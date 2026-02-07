"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getContact, updateContact, deleteContact } from "@/app/actions/crm/contacts";
import { getCompanies } from "@/app/actions/crm/companies";
import { getNotes, createNote } from "@/app/actions/crm/notes";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import ActivityHistory from "@/components/crm/ActivityHistory";
import { ArrowLeftIcon, PencilIcon, TrashIcon, EnvelopeIcon, PhoneIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  company?: { id: string; name: string } | null;
};

type Note = {
  id: string;
  title: string | null;
  content: string;
  type: string;
  created_at: string;
  created_by: string | null;
};

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (contactId) {
      loadContact();
      loadNotes();
    }
  }, [contactId]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const data = await getContact(contactId);
      if (data) {
        setContact(data);
        setFormData({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || "",
          phone: data.phone || "",
          mobile: data.mobile || "",
          job_title: data.job_title || "",
          department: data.department || "",
        });
      }
    } catch (error) {
      console.error("Error loading contact:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const data = await getNotes({ contact_id: contactId });
      setNotes(data);
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateContact(contactId, formData);
      await loadContact();
      setEditing(false);
    } catch (error: any) {
      console.error("Error updating contact:", error);
      alert(error.message || "Failed to update contact");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }

    try {
      await deleteContact(contactId);
      router.push("/crm/contacts");
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      alert(error.message || "Failed to delete contact");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSavingNote(true);
      await createNote({
        contact_id: contactId,
        company_id: null,
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

  if (loading && !contact) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading contact...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Contact Not Found" />
        <div className="text-center py-12">
          <p className="text-gray-500">Contact not found</p>
          <Link href="/crm/contacts">
            <Button className="mt-4">Back to Contacts</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={`${contact.first_name} ${contact.last_name}`} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/crm/contacts">
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
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mobile
                      </label>
                      <input
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">
                        {contact.first_name} {contact.last_name}
                      </p>
                    </div>
                    {contact.email && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                        <a href={`mailto:${contact.email}`} className="text-lg font-medium text-brand-500 hover:underline flex items-center gap-2">
                          <EnvelopeIcon className="h-4 w-4" />
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                        <a href={`tel:${contact.phone}`} className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.mobile && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Mobile</p>
                        <a href={`tel:${contact.mobile}`} className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          {contact.mobile}
                        </a>
                      </div>
                    )}
                    {contact.job_title && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Job Title</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{contact.job_title}</p>
                      </div>
                    )}
                    {contact.department && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Department</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{contact.department}</p>
                      </div>
                    )}
                    {contact.company && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                        <Link href={`/crm/companies/${contact.company.id}`} className="text-lg font-medium text-brand-500 hover:underline flex items-center gap-2">
                          <BuildingOfficeIcon className="h-4 w-4" />
                          {contact.company.name}
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Activity History */}
            <ActivityHistory contactId={contactId} />

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

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <EnvelopeIcon className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <PhoneIcon className="h-4 w-4 mr-2" />
                  Call
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
