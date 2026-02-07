/**
 * Workspace Switcher Component
 * 
 * Allows users to switch between workspaces within their tenant
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/core/multi-tenancy/workspace-context";
import { useTenant } from "@/core/multi-tenancy";
import { getAllWorkspaces } from "@/app/actions/workspaces";
import {
  BuildingOffice2Icon,
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import type { Database } from "@/core/database/types";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

interface WorkspaceSwitcherProps {
  className?: string;
}

export default function WorkspaceSwitcher({ className = "" }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { workspace, workspaceId, isLoading: workspaceLoading } = useWorkspace();
  const { tenantId } = useTenant();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadWorkspaces() {
      if (!tenantId) return;
      
      try {
        setIsLoading(true);
        const workspacesData = await getAllWorkspaces(tenantId);
        setWorkspaces(workspacesData as Workspace[]);
      } catch (error) {
        console.error("Error loading workspaces:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen && tenantId) {
      loadWorkspaces();
    }
  }, [isOpen, tenantId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleWorkspaceSwitch = async (newWorkspaceId: string) => {
    if (newWorkspaceId === workspaceId) {
      setIsOpen(false);
      return;
    }

    try {
      // Set workspace context in localStorage
      localStorage.setItem("current_workspace_id", newWorkspaceId);
      
      // Reload the page to refresh workspace context
      router.refresh();
      setIsOpen(false);
      
      // Small delay to ensure state updates
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error("Error switching workspace:", error);
    }
  };

  if (workspaceLoading || !workspace) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
        <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {workspace.avatar_url ? (
            <Image
              src={workspace.avatar_url}
              alt={workspace.name}
              width={24}
              height={24}
              className="rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <BuildingOffice2Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </div>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {workspace.name}
          </span>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {/* Workspace List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading workspaces...
              </div>
            ) : workspaces.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No workspaces available
              </div>
            ) : (
              workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleWorkspaceSwitch(w.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    w.id === workspaceId ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  {w.avatar_url ? (
                    <Image
                      src={w.avatar_url}
                      alt={w.name}
                      width={32}
                      height={32}
                      className="rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <BuildingOffice2Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {w.name}
                    </div>
                    {w.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {w.description}
                      </div>
                    )}
                  </div>
                  {w.id === workspaceId && (
                    <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-300 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                router.push("/saas/admin/workspaces");
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              <PlusIcon className="h-4 w-4" />
              Create Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


