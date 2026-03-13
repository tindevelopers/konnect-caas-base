"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { parseFileFromFormData } from "@/app/actions/import/file";
import {
  importContactsAction,
  previewContactsImport,
  type ContactFieldMapping,
  type ContactsImportPreview,
} from "@/app/actions/crm/contacts-import";

const DEFAULT_MAPPING: ContactFieldMapping = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  mobile: "",
  job_title: "",
  department: "",
  company_name: "",
};

export default function ImportContactsPage() {
  const router = useRouter();

  const [parseHeaders, setParseHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ContactFieldMapping>(DEFAULT_MAPPING);
  const [preview, setPreview] = useState<ContactsImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createCompanies, setCreateCompanies] = useState(true);

  const canPreview = rows.length > 0 && mapping.first_name && mapping.last_name;
  const canImport = !!preview && preview.validRows > 0 && mapping.first_name && mapping.last_name;

  const headerOptions = useMemo(() => {
    return ["", ...parseHeaders];
  }, [parseHeaders]);

  const autoMapFromHeaders = (headers: string[]) => {
    const next: ContactFieldMapping = { ...DEFAULT_MAPPING };
    for (const h of headers) {
      const key = h.toLowerCase().replace(/\s+/g, "_");
      if (key.includes("first") || key === "firstname") next.first_name = h;
      else if (key.includes("last") || key === "lastname") next.last_name = h;
      else if (key.includes("email")) next.email = h;
      else if (key === "phone" || key.includes("phone_number") || key.includes("telephone"))
        next.phone = h;
      else if (key.includes("mobile") || key.includes("cell")) next.mobile = h;
      else if (key.includes("job") || key.includes("title")) next.job_title = h;
      else if (key.includes("department")) next.department = h;
      else if (key.includes("company") || key.includes("organization") || key.includes("org"))
        next.company_name = h;
    }
    return next;
  };

  const refreshPreview = async (nextMapping: ContactFieldMapping) => {
    if (!rows.length) return;
    if (!nextMapping.first_name || !nextMapping.last_name) {
      setPreview(null);
      return;
    }
    const p = await previewContactsImport(rows, nextMapping);
    setPreview(p);
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await parseFileFromFormData(formData);
      if (!result) {
        setError("Unsupported file type. Please upload a CSV or Excel file.");
        return;
      }
      setParseHeaders(result.headers);
      setRows(result.rows);
      setParseErrors(result.errors);
      const next = autoMapFromHeaders(result.headers);
      setMapping(next);
      await refreshPreview(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    disabled: loading,
  });

  const handleMappingChange = async (
    target: keyof ContactFieldMapping,
    value: string
  ) => {
    const next = { ...mapping, [target]: value };
    setMapping(next);
    await refreshPreview(next);
  };

  const handleImport = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await importContactsAction({
        rows,
        mapping,
        createMissingCompanies: createCompanies,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/crm/contacts?imported=${res.imported}&companiesCreated=${res.companiesCreated}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Import Contacts" />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/crm/contacts">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Import Contacts
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Upload a CSV or Excel file, map columns, preview, and import into your CRM.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <div className="font-medium mb-1">File parse warnings</div>
            <ul className="list-disc pl-5 space-y-1">
              {parseErrors.slice(0, 5).map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 space-y-6">
          <div
            {...getRootProps()}
            className={[
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer",
              "border-gray-200 dark:border-gray-700",
              isDragActive ? "bg-gray-50 dark:bg-gray-800/50" : "",
              loading ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <input {...getInputProps()} />
            <div className="text-gray-700 dark:text-gray-200 font-medium">
              Drag & drop CSV or Excel, or click to browse
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Supported: .csv, .xls, .xlsx (first row must be headers)
            </div>
          </div>

          {rows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-medium mb-1">Column mapping</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    First name and last name are required.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={createCompanies}
                    onChange={(e) => setCreateCompanies(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                  />
                  Create missing companies (by name)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MappingSelect
                  label="First Name *"
                  value={mapping.first_name}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("first_name", v)}
                />
                <MappingSelect
                  label="Last Name *"
                  value={mapping.last_name}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("last_name", v)}
                />
                <MappingSelect
                  label="Email"
                  value={mapping.email ?? ""}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("email", v)}
                />
                <MappingSelect
                  label="Phone"
                  value={mapping.phone ?? ""}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("phone", v)}
                />
                <MappingSelect
                  label="Mobile"
                  value={mapping.mobile ?? ""}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("mobile", v)}
                />
                <MappingSelect
                  label="Company"
                  value={mapping.company_name ?? ""}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("company_name", v)}
                />
                <MappingSelect
                  label="Job Title"
                  value={mapping.job_title ?? ""}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("job_title", v)}
                />
                <MappingSelect
                  label="Department"
                  value={mapping.department ?? ""}
                  options={headerOptions}
                  onChange={(v) => handleMappingChange("department", v)}
                />
              </div>

              {!canPreview && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Map <span className="font-medium">First Name</span> and{" "}
                  <span className="font-medium">Last Name</span> to see a preview.
                </div>
              )}

              {preview && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      <span className="font-medium">{preview.validRows}</span> valid contacts
                      <span className="text-gray-500 dark:text-gray-400">
                        {" "}
                        (out of {preview.totalRows})
                      </span>
                      {preview.duplicateCount > 0 && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {" "}
                          · {preview.duplicateCount} duplicates removed
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={handleImport}
                      disabled={!canImport || loading}
                    >
                      {loading ? "Importing..." : "Import contacts"}
                    </Button>
                  </div>

                  {preview.errors.length > 0 && (
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      <div className="font-medium mb-1">Preview warnings</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {preview.errors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="py-2 pr-4 text-left">Name</th>
                          <th className="py-2 pr-4 text-left">Company</th>
                          <th className="py-2 pr-4 text-left">Email</th>
                          <th className="py-2 pr-4 text-left">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {preview.sample.map((r, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-4">
                              {r.first_name} {r.last_name}
                            </td>
                            <td className="py-2 pr-4">{r.company_name ?? "-"}</td>
                            <td className="py-2 pr-4">{r.email ?? "-"}</td>
                            <td className="py-2 pr-4">
                              {r.mobile ?? r.phone ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!preview && rows.length > 0 && mapping.first_name && mapping.last_name && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Generating preview…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MappingSelect(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {props.label}
      </label>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      >
        {props.options.map((h) => (
          <option key={h || "__empty"} value={h}>
            {h || "-- Skip --"}
          </option>
        ))}
      </select>
    </div>
  );
}

