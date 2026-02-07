"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { PlusIcon, PencilIcon, CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  billingCycle: "monthly" | "annual";
  features: string[];
  status: "active" | "archived";
  userCount: number;
}

const initialPlans: Plan[] = [
  {
    id: "1",
    name: "Starter",
    price: 29,
    billingCycle: "monthly",
    features: ["10,000 orders/month", "Basic support", "5 GB storage"],
    status: "active",
    userCount: 245,
  },
  {
    id: "2",
    name: "Professional",
    price: 199,
    billingCycle: "monthly",
    features: ["25,500 orders/month", "Priority support", "10 GB storage", "Unlimited integrations"],
    status: "active",
    userCount: 128,
  },
  {
    id: "3",
    name: "Pro",
    price: 399,
    billingCycle: "monthly",
    features: ["50,000 orders/month", "24/7 support", "50 GB storage", "Custom templates", "Advanced analytics"],
    status: "active",
    userCount: 45,
  },
];

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const createModal = useModal();
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    billingCycle: "monthly" as "monthly" | "annual",
    features: [""],
  });

  const handleCreatePlan = () => {
    const newPlan: Plan = {
      id: Date.now().toString(),
      name: formData.name,
      price: parseFloat(formData.price),
      billingCycle: formData.billingCycle,
      features: formData.features.filter((f) => f.trim() !== ""),
      status: "active",
      userCount: 0,
    };
    setPlans([...plans, newPlan]);
    createModal.closeModal();
    setFormData({ name: "", price: "", billingCycle: "monthly", features: [""] });
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Subscription Plans" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Subscription Plans</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Create and manage subscription plans for your customers
            </p>
          </div>
          <Button onClick={createModal.openModal}>
            <PlusIcon className="h-4 w-4" />
            Create Plan
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">${plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400">/{plan.billingCycle}</span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    plan.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-500"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {plan.status}
                </span>
              </div>

              <div className="mb-4 space-y-2">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mb-4 border-t border-gray-200 pt-4 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-white">{plan.userCount}</span> active
                  subscribers
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <TrashIcon className="h-4 w-4" />
                  Archive
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Plan Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.closeModal} className="max-w-[600px] m-4">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Create New Plan</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plan-name">Plan Name</Label>
              <Input
                id="plan-name"
                type="text"
                defaultValue={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Enterprise"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-price">Price</Label>
                <Input
                  id="plan-price"
                  type="number"
                  defaultValue={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="billing-cycle">Billing Cycle</Label>
                <select
                  id="billing-cycle"
                  value={formData.billingCycle}
                  onChange={(e) =>
                    setFormData({ ...formData, billingCycle: e.target.value as "monthly" | "annual" })
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Features</Label>
              {formData.features.map((feature, idx) => (
                <div key={idx} className="mb-2 flex gap-2">
                  <Input
                    type="text"
                    defaultValue={feature}
                    onChange={(e) => {
                      const newFeatures = [...formData.features];
                      newFeatures[idx] = e.target.value;
                      setFormData({ ...formData, features: newFeatures });
                    }}
                    placeholder="Feature description"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, features: [...formData.features, ""] })}
              >
                <PlusIcon className="h-4 w-4" />
                Add Feature
              </Button>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={createModal.closeModal} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreatePlan} className="flex-1">
                Create Plan
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

