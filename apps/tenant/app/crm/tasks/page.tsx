"use client";

import { useEffect, useState } from "react";
import { getTasks, updateTask, deleteTask } from "@/app/actions/crm/tasks";
import { createDefaultTenantForUser } from "@/app/actions/crm/setup";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { PlusIcon, CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// Temporary types until database types are regenerated
type Task = {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  reminder_date: string | null;
  completed_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
  deal?: {
    id: string;
    name: string;
  } | null;
};

const statusColors = {
  todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const priorityColors = {
  low: "text-gray-500",
  medium: "text-yellow-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [needsTenant, setNeedsTenant] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const setupTenant = async () => {
    try {
      setLoading(true);
      await createDefaultTenantForUser();
      setNeedsTenant(false);
      await loadTasks();
    } catch (error) {
      console.error("Error setting up tenant:", error);
      alert("Failed to set up tenant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filter !== "all") {
        filters.status = filter;
      }
      const data = await getTasks(filters);
      setTasks(data);
      setNeedsTenant(false);
    } catch (error: any) {
      console.error("Error loading tasks:", error);
      if (error.message?.includes("No tenant found")) {
        setNeedsTenant(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const newStatus = task.status === "done" ? "todo" : "done";
      await updateTask(task.id, { status: newStatus });
      await loadTasks();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }

    try {
      await deleteTask(id);
      await loadTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const getTaskReference = (task: Task) => {
    if (task.contact) {
      return `${task.contact.first_name} ${task.contact.last_name}`;
    }
    if (task.company) {
      return task.company.name;
    }
    if (task.deal) {
      return task.deal.name;
    }
    return "No reference";
  };

  const isOverdue = (dueDate: string | null, taskId: string) => {
    if (!dueDate) return false;
    const task = tasks.find((t) => t.id === taskId);
    return new Date(dueDate) < new Date() && task?.status !== "done";
  };

  if (loading && !needsTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  if (needsTenant) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Tasks" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Tenant Setup Required
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              You need a tenant to use CRM features. Click below to create a default tenant.
            </p>
            <Button onClick={setupTenant} disabled={loading}>
              {loading ? "Setting up..." : "Create Default Tenant"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Tasks" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Tasks</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Manage your tasks and reminders
            </p>
          </div>
          <Link href="/crm/tasks/new">
            <Button>
              <PlusIcon className="h-5 w-5 mr-2" />
              New Task
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {["all", "todo", "in_progress", "done"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {status === "all" ? "All" : status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg">
              <p className="text-gray-500">No tasks found. Create your first task!</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      task.status === "done"
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {task.status === "done" && <CheckIcon className="h-3 w-3 text-white" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3
                          className={`font-medium ${
                            task.status === "done"
                              ? "line-through text-gray-400"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>Related to: {getTaskReference(task)}</span>
                          {task.due_date && (
                            <span
                              className={
                                isOverdue(task.due_date, task.id)
                                  ? "text-red-500 font-medium"
                                  : ""
                              }
                            >
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            statusColors[task.status as keyof typeof statusColors]
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            priorityColors[task.priority as keyof typeof priorityColors]
                          }`}
                        >
                          {task.priority}
                        </span>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
