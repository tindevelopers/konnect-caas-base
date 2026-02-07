"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDeal, updateDeal, deleteDeal, getDealStages } from "@/app/actions/crm/deals";
import { getNotes, createNote } from "@/app/actions/crm/notes";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import ActivityHistory from "@/components/crm/ActivityHistory";
import { ArrowLeftIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

type Deal = {
  id: string;
  name: string;
  stage_id: string;
  value: number;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  description: string | null;
  contact?: { id: string; first_name: string; last_name: string } | null;
  company?: { id: string; name: string } | null;
  stage?: { id: string; name: string; color: string } | null;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<Array<{ id: string; name: string }>>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (dealId) {
      loadDeal();
      loadNotes();
      loadStages();
    }
  }, [dealId]);

  const loadDeal = async () => {
    try {
      setLoading(true);
      const data = await getDeal(dealId);
      if (data) {
        setDeal(data);
        setFormData({
          name: data.name,
          stage_id: data.stage_id,
          value: data.value.toString(),
          currency: data.currency,
          probability: data.probability?.toString() || "",
          expected_close_date: data.expected_close_date || "",
          description: data.description || "",
        });
      }
    } catch (error) {
      console.error("Error loading deal:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async () => {
    try {
      const data = await getDealStages();
      setStages(data);
    } catch (error) {
      console.error("Error loading stages:", error);
    }
  };

  const loadNotes = async () => {
    try {
      const data = await getNotes({ deal_id: dealId });
      setNotes(data);
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateDeal(dealId, {
        name: formData.name,
        stage_id: formData.stage_id,
        value: parseFloat(formData.value) || 0,
        currency: formData.currency,
        probability: formData.probability ? parseInt(formData.probability) : null,
        expected_close_date: formData.expected_close_date || null,
        description: formData.description || null,
      });
      await loadDeal();
      setEditing(false);
    } catch (error: any) {
      console.error("Error updating deal:", error);
      alert(error.message || "Failed to update deal");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this deal?")) {
      return;
    }

    try {
      await deleteDeal(dealId);
      router.push("/crm/deals");
    } catch (error: any) {
      console.error("Error deleting deal:", error);
      alert(error.message || "Failed to delete deal");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSavingNote(true);
      await createNote({
        contact_id: null,
        company_id: null,
        deal_id: dealId,
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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !deal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading deal...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Deal Not Found" />
        <div className="text-center py-12">
          <p className="text-gray-500">Deal not found</p>
          <Link href="/crm/deals">
            <Button className="mt-4">Back to Deals</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={deal.name} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/crm/deals">
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Deal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Deal Name *
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
                        Stage *
                      </label>
                      <select
                        required
                        value={formData.stage_id}
                        onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        {stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Value *
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                        <input
                          type="number"
                          required
                          step="0.01"
                          value={formData.value}
                          onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Probability (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.probability}
                        onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Expected Close Date
                      </label>
                      <input
                        type="date"
                        value={formData.expected_close_date}
                        onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        rows={4}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Deal Name</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{deal.name}</p>
                    </div>
                    {deal.stage && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Stage</p>
                        <span
                          className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                          style={{ backgroundColor: deal.stage.color + "20", color: deal.stage.color }}
                        >
                          {deal.stage.name}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Value</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(deal.value, deal.currency)}
                      </p>
                    </div>
                    {deal.probability !== null && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Probability</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{deal.probability}%</p>
                      </div>
                    )}
                    {deal.expected_close_date && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Expected Close Date</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">
                          {new Date(deal.expected_close_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {deal.contact && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                        <Link
                          href={`/crm/contacts/${deal.contact.id}`}
                          className="text-lg font-medium text-brand-500 hover:underline"
                        >
                          {deal.contact.first_name} {deal.contact.last_name}
                        </Link>
                      </div>
                    )}
                    {deal.company && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                        <Link
                          href={`/crm/companies/${deal.company.id}`}
                          className="text-lg font-medium text-brand-500 hover:underline"
                        >
                          {deal.company.name}
                        </Link>
                      </div>
                    )}
                    {deal.description && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
                        <p className="text-gray-900 dark:text-white">{deal.description}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Activity History */}
            <ActivityHistory dealId={dealId} />

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
