"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function CancelSubscriptionPage() {
  const router = useRouter();
  const confirmModal = useModal();
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const handleCancel = () => {
    // Handle cancellation logic here
    console.log("Cancelling subscription...", { reason, feedback });
    confirmModal.closeModal();
    router.push("/billing");
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Cancel Subscription" />
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-500" />
            </div>
            <h1 className="mb-2 text-3xl font-semibold text-gray-900 dark:text-white">
              Cancel Subscription
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              We&apos;re sorry to see you go. Please let us know why you&apos;re canceling.
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-800/50">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Current Plan Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Plan</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    Professional
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Cost</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    $199.00/month
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    Renewal Date
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    Mar 22, 2028
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason for Cancellation
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="">Select a reason</option>
                <option value="too-expensive">Too expensive</option>
                <option value="not-using">Not using the service</option>
                <option value="missing-features">Missing features</option>
                <option value="found-alternative">Found an alternative</option>
                <option value="technical-issues">Technical issues</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Additional Feedback (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                placeholder="Tell us more about your decision..."
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => router.push("/billing")}
                className="w-full sm:w-auto"
              >
                Keep My Subscription
              </Button>
              <Button
                onClick={confirmModal.openModal}
                className="w-full bg-red-600 hover:bg-red-700 sm:w-auto"
                disabled={!reason}
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={confirmModal.closeModal}
        className="max-w-[500px] m-4"
      >
        <div className="p-6">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Confirm Cancellation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to cancel your subscription? This action
              cannot be undone.
            </p>
          </div>

          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your subscription will remain active until{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                Mar 22, 2028
              </span>
              . After that date, you will lose access to all premium features.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={confirmModal.closeModal}
              className="flex-1"
            >
              Keep Subscription
            </Button>
            <Button
              onClick={handleCancel}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Yes, Cancel Subscription
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

