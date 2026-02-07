"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function UpdateBillingAddressPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "Jane",
    lastName: "Smith",
    street: "800 E Elcamino Real, suite #400",
    country: "United States of America",
    city: "Mountain View",
    state: "CA",
    zipCode: "94040",
    postalCode: "19029",
    town: "New York",
    vatNumber: "DE4920348",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log("Updating billing address...", formData);
    router.push("/billing");
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Update Billing Address" />
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-semibold text-gray-900 dark:text-white">
              Update Billing Address
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Update your billing information to ensure accurate invoicing and
              payment processing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  defaultValue={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  defaultValue={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                type="text"
                defaultValue={formData.street}
                onChange={(e) => handleChange("street", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="country">Country</Label>
                <div className="relative">
                  <select
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 pr-10 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  >
                    <option>United States of America</option>
                    <option>United Kingdom</option>
                    <option>Canada</option>
                    <option>Australia</option>
                    <option>Germany</option>
                    <option>France</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="town">Town/City</Label>
                <div className="relative">
                  <select
                    id="town"
                    value={formData.town}
                    onChange={(e) => handleChange("town", e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 pr-10 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  >
                    <option>New York</option>
                    <option>Los Angeles</option>
                    <option>Chicago</option>
                    <option>Houston</option>
                    <option>Phoenix</option>
                    <option>Mountain View</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  defaultValue={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  type="text"
                  defaultValue={formData.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  type="text"
                  defaultValue={formData.zipCode}
                  onChange={(e) => handleChange("zipCode", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  type="text"
                  defaultValue={formData.postalCode}
                  onChange={(e) => handleChange("postalCode", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  type="text"
                  defaultValue={formData.vatNumber}
                  onChange={(e) => handleChange("vatNumber", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => router.push("/billing")}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button className="w-full sm:w-auto">
                Update Billing Address
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

