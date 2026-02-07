"use client";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import {
  UserCircleIcon,
  EnvelopeIcon,
  CalendarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import React, { useState } from "react";

type TabType = "profile" | "account" | "support";

export default function UserProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-indigo-500 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-pink-500 blur-[140px]" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              <UserCircleIcon className="h-4 w-4" />
              User Profile
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Account Settings
            </h1>
            <p className="max-w-2xl text-white/70">
              Manage your profile information, security settings, and account preferences.
            </p>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "profile"
                ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit Profile
            </div>
          </button>
          <button
            onClick={() => setActiveTab("account")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "account"
                ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.573c-.94 1.543.826 3.31 2.37 2.37.94a1.724 1.724 0 002.572 1.065c.426 1.756 2.924 1.756 3.35 0a1.724 1.724 0 002.573-1.065c1.543.94 3.31-.826 2.37-2.37a1.724 1.724 0 001.065-2.572c1.756-.426 1.756-2.924 0-3.35a1.724 1.724 0 00-1.065-2.573c.94-1.543-.826-3.31-2.37-2.37-.94a1.724 1.724 0 00-2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Account Settings
            </div>
          </button>
          <button
            onClick={() => setActiveTab("support")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "support"
                ? "border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Support
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "profile" && <EditProfileSection />}
          {activeTab === "account" && <AccountSettingsSection />}
          {activeTab === "support" && <SupportSection />}
        </div>
      </section>
    </div>
  );
}

function EditProfileSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 overflow-hidden rounded-full">
            <Image
              src="/images/user/user-17.jpg"
              alt="Profile"
              width={96}
              height={96}
            />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Jane Smith
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              randomuser@pimjo.com
            </p>
            <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              Active
            </span>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Personal Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  type="text"
                  defaultValue="John"
                />
              </div>
              <div>
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  type="text"
                  defaultValue="Smith"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue="randomuser@pimjo.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  defaultValue="+1 (555) 123-4567"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Account Details
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                randomuser@pimjo.com
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                Member since Jan 2023
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">
                Platform Admin
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountSettingsSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Security Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Two-Factor Authentication
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enabled via authenticator app
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Password
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last changed 3 months ago
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Change
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Active Sessions
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    3 active sessions
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Preferences
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Email Notifications
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive email updates about your account
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" defaultChecked />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-gray-700 dark:after:border-gray-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Marketing Emails
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive emails about new features and updates
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-gray-700 dark:after:border-gray-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Danger Zone
          </h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400">
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </Button>
            <Button variant="outline" className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400">
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Get Help
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-6 dark:border-gray-800">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Documentation
              </h4>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Browse our comprehensive guides and tutorials
              </p>
              <Button variant="outline" size="sm">
                View Docs
              </Button>
            </div>

            <div className="rounded-2xl border border-gray-100 p-6 dark:border-gray-800">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Live Chat
              </h4>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Chat with our support team in real-time
              </p>
              <Button variant="outline" size="sm">
                Start Chat
              </Button>
            </div>

            <div className="rounded-2xl border border-gray-100 p-6 dark:border-gray-800">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Email Support
              </h4>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Send us an email and we&apos;ll get back to you
              </p>
              <Button variant="outline" size="sm">
                Contact Us
              </Button>
            </div>

            <div className="rounded-2xl border border-gray-100 p-6 dark:border-gray-800">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Submit Ticket
              </h4>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Create a support ticket for detailed assistance
              </p>
              <Button variant="outline" size="sm">
                Create Ticket
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h3>
          <div className="space-y-3">
            {[
              "How do I reset my password?",
              "How do I enable two-factor authentication?",
              "How do I update my billing information?",
              "How do I export my data?",
            ].map((question) => (
              <div
                key={question}
                className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {question}
                </p>
                <button className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Contact Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Support Email
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                support@tailadmin.com
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Response Time
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Usually within 24 hours
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Business Hours
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monday - Friday, 9 AM - 6 PM EST
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

