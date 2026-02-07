import React from "react";
import TemplateCard from "./TemplateCard";

const templates = [
  {
    id: "saas",
    name: "SaaS",
    description: "Software-as-a-Service dashboard with users, subscriptions, analytics, and billing",
    icon: "💼",
    color: "bg-indigo-500",
    features: ["User Management", "Subscription Plans", "Usage Analytics", "Billing System"],
    preview: "/images/templates/saas-preview.png",
    installCommand: "npx create-tinadmin@latest saas my-saas-app"
  }
];

export default function TemplateGrid() {
  return (
    <div id="templates" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}
