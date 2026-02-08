"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

interface WebcallCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (credentials: { login: string; password: string }) => void;
}

export default function WebcallCredentialsModal({
  isOpen,
  onClose,
  onSubmit,
}: WebcallCredentialsModalProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!login.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    onSubmit({ login: login.trim(), password: password.trim() });
    setLogin("");
    setPassword("");
    setError(null);
  };

  const handleClose = () => {
    setLogin("");
    setPassword("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="relative w-full max-w-[480px] m-5 sm:m-0 rounded-3xl bg-white p-8 dark:bg-gray-900"
    >
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Enter SIP Credentials
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Enter your Telnyx SIP connection credentials to start a webcall.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sip-username">SIP Username</Label>
              <Input
                id="sip-username"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Enter SIP username"
                required
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="sip-password">SIP Password</Label>
              <Input
                id="sip-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter SIP password"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Connect
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
