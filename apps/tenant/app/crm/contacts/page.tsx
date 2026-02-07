"use client";

import { useEffect, useState } from "react";
import { getContacts, deleteContact } from "@/app/actions/crm/contacts";
import { createDefaultTenantForUser } from "@/app/actions/crm/setup";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// Temporary types until database types are regenerated
type Contact = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  address: Record<string, any> | null;
  avatar_url: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any> | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  company?: {
    id: string;
    name: string;
  } | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [needsTenant, setNeedsTenant] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const setupTenant = async () => {
    try {
      setLoading(true);
      await createDefaultTenantForUser();
      setNeedsTenant(false);
      await loadContacts();
    } catch (error) {
      console.error("Error setting up tenant:", error);
      alert("Failed to set up tenant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await getContacts();
      setContacts(data);
      setNeedsTenant(false);
    } catch (error: any) {
      console.error("Error loading contacts:", error);
      if (error.message?.includes("No tenant found")) {
        setNeedsTenant(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }

    try {
      await deleteContact(id);
      await loadContacts();
    } catch (error) {
      console.error("Error deleting contact:", error);
      alert("Failed to delete contact");
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(query) ||
      contact.last_name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.company?.name?.toLowerCase().includes(query)
    );
  });

  if (loading && !needsTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  if (needsTenant) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Contacts" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Tenant Setup Required
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              You need a tenant to use CRM features. Click below to create a default tenant.
            </p>
            <Button onClick={setupTenant} disabled={loading}>
              {loading ? "Setting up..." : "Create Default Tenant"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Contacts" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Contacts</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage your contacts and customer relationships
            </p>
          </div>
          <Link href="/crm/contacts/new">
            <Button>
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Contact
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Contacts Table */}
        <div className="bg-white rounded-lg shadow dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Title
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? "No contacts found matching your search" : "No contacts yet. Create your first contact!"}
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/crm/contacts/${contact.id}`}
                          className="text-sm font-medium text-gray-900 dark:text-white hover:text-brand-500"
                        >
                          {contact.first_name} {contact.last_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {contact.company?.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {contact.email || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {contact.phone || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {contact.job_title || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/crm/contacts/${contact.id}`}>
                            <button className="text-brand-500 hover:text-brand-700">
                              <PencilIcon className="h-5 w-5" />
                            </button>
                          </Link>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
