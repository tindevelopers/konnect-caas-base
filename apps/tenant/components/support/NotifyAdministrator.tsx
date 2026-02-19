"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button/Button";
import { createSupportTicketFromError, parseSupportCodeAndRef } from "@/app/actions/support/tickets";
import { BellAlertIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

interface NotifyAdministratorProps {
  /** Full error message (may contain "Support code: KX-XXX, Ref: ref_xxx") */
  errorMessage: string;
  /** Optional context, e.g. "Place number order" */
  actionContext?: string;
  /** If true, only show when error contains a support code */
  onlyWhenSupportCode?: boolean;
}

/**
 * Renders a "Notify administrator" action that creates a support ticket from the current error.
 * Ticket is assigned to the organization admin; they can escalate to platform admin from the ticket.
 */
export default function NotifyAdministrator({
  errorMessage,
  actionContext,
  onlyWhenSupportCode = false,
}: NotifyAdministratorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; ticket_number: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { supportCode } = parseSupportCodeAndRef(errorMessage);
  if (onlyWhenSupportCode && !supportCode) return null;

  const handleNotify = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await createSupportTicketFromError({
        errorMessage,
        actionContext,
      });
      setCreated(result);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <div className="flex items-center gap-2 text-sm font-medium text-green-900 dark:text-green-100">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Support ticket created: {created.ticket_number}
        </div>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          Your organization administrator has been notified. You can view the ticket below.
        </p>
        <Link
          href={`/saas/support/tickets/${created.id}`}
          className="mt-3 inline-block text-sm font-medium text-green-700 underline hover:text-green-800 dark:text-green-300 dark:hover:text-green-200"
        >
          View ticket →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Notify your organization administrator so they can assist or escalate to platform support.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={handleNotify}
        disabled={submitting}
      >
        <BellAlertIcon className="mr-2 h-4 w-4" />
        {submitting ? "Creating ticket…" : "Notify administrator"}
      </Button>
      {submitError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{submitError}</p>
      )}
    </div>
  );
}
