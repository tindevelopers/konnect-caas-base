"use client";

import { useEffect, useState } from "react";
import { getCompanies, deleteCompany } from "@/app/actions/crm/companies";
import { createDefaultTenantForUser } from "@/app/actions/crm/setup";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// Temporary types until database types are regenerated
type Company = {
  id: string;
  tenant_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  annual_revenue: number | null;
  description: string | null;
  address: Record<string, any> | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [needsTenant, setNeedsTenant] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const setupTenant = async () => {
    try {
      setLoading(true);
      await createDefaultTenantForUser();
      setNeedsTenant(false);
      await loadCompanies();
    } catch (error) {
      console.error("Error setting up tenant:", error);
      alert("Failed to set up tenant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
      setNeedsTenant(false);
    } catch (error: any) {
      console.error("Error loading companies:", error);
      if (error.message?.includes("No tenant found")) {
        setNeedsTenant(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) {
      return;
    }

    try {
      await deleteCompany(id);
      await loadCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      alert("Failed to delete company");
    }
  };

  const filteredCompanies = companies.filter((company) => {
    const query = searchQuery.toLowerCase();
    return (
      company.name?.toLowerCase().includes(query) ||
      company.industry?.toLowerCase().includes(query) ||
      company.email?.toLowerCase().includes(query)
    );
  });

  if (loading && !needsTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading companies...</div>
      </div>
    );
  }

  if (needsTenant) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Companies" />
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
      <PageBreadcrumb pageTitle="Companies" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Companies</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage your company accounts and organizations
            </p>
          </div>
          <Link href="/crm/companies/new">
            <Button>
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Company
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Companies Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white dark:bg-gray-900 rounded-lg">
              <p className="text-gray-500">
                {searchQuery ? "No companies found matching your search" : "No companies yet. Create your first company!"}
              </p>
            </div>
          ) : (
            filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link href={`/crm/companies/${company.id}`}>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-brand-500">
                        {company.name}
                      </h3>
                    </Link>
                    {company.industry && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {company.industry}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/crm/companies/${company.id}`}>
                      <button className="text-brand-500 hover:text-brand-700">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  {company.email && (
                    <div className="flex items-center gap-2">
                      <span>Email:</span>
                      <span>{company.email}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2">
                      <span>Phone:</span>
                      <span>{company.phone}</span>
                    </div>
                  )}
                  {company.website && (
                    <div className="flex items-center gap-2">
                      <span>Website:</span>
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline"
                      >
                        {company.website}
                      </a>
                    </div>
                  )}
                  {company.size && (
                    <div className="flex items-center gap-2">
                      <span>Size:</span>
                      <span>{company.size}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
