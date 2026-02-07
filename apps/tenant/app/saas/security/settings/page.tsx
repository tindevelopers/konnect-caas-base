"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import React, { useState } from "react";

export default function SecuritySettingsPage() {
  const [settings, setSettings] = useState({
    requireMFA: true,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecial: true,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    requireEmailVerification: true,
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Security Settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Security Settings</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Configure authentication and security policies
          </p>
        </div>

        {/* Password Policy */}
        <div className="rounded-2xl border border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="w-full space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Password Policy</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="min-length">Minimum Length</Label>
                <Input
                  id="min-length"
                  type="number"
                  defaultValue={settings.passwordMinLength.toString()}
                  onChange={(e) =>
                    setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="require-uppercase">Require Uppercase</Label>
                  <Switch
                    id="require-uppercase"
                    defaultChecked={settings.passwordRequireUppercase}
                    onChange={(checked) =>
                      setSettings({ ...settings, passwordRequireUppercase: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="require-lowercase">Require Lowercase</Label>
                  <Switch
                    id="require-lowercase"
                    defaultChecked={settings.passwordRequireLowercase}
                    onChange={(checked) =>
                      setSettings({ ...settings, passwordRequireLowercase: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="require-numbers">Require Numbers</Label>
                  <Switch
                    id="require-numbers"
                    defaultChecked={settings.passwordRequireNumbers}
                    onChange={(checked) =>
                      setSettings({ ...settings, passwordRequireNumbers: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="require-special">Require Special Characters</Label>
                  <Switch
                    id="require-special"
                    defaultChecked={settings.passwordRequireSpecial}
                    onChange={(checked) =>
                      setSettings({ ...settings, passwordRequireSpecial: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Factor Authentication */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Multi-Factor Authentication
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Require MFA for all users
                </p>
              </div>
              <Switch
                defaultChecked={settings.requireMFA}
                onChange={(checked) => setSettings({ ...settings, requireMFA: checked })}
              />
            </div>
          </div>
        </div>

        {/* Session Management */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Session Management
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                defaultValue={settings.sessionTimeout.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        {/* Account Lockout */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Account Lockout</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="max-attempts">Max Login Attempts</Label>
              <Input
                id="max-attempts"
                type="number"
                defaultValue={settings.maxLoginAttempts.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="lockout-duration">Lockout Duration (minutes)</Label>
              <Input
                id="lockout-duration"
                type="number"
                defaultValue={settings.lockoutDuration.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, lockoutDuration: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        {/* Email Verification */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Email Verification
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Require email verification for new accounts
              </p>
            </div>
            <Switch
              defaultChecked={settings.requireEmailVerification}
              onChange={(checked) =>
                setSettings({ ...settings, requireEmailVerification: checked })
              }
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button>Save Security Settings</Button>
        </div>
      </div>
    </div>
  );
}

