"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  preview: string;
  installCommand: string;
}

interface TemplateCardProps {
  template: Template;
}

export default function TemplateCard({ template }: TemplateCardProps) {
  const [showInstallCommand, setShowInstallCommand] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(template.installCommand);
    setShowInstallCommand(true);
    setTimeout(() => setShowInstallCommand(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
      {/* Preview Image */}
      <div className={`h-48 ${template.color} flex items-center justify-center relative overflow-hidden`}>
        <div className="text-6xl opacity-80 group-hover:scale-110 transition-transform duration-300">
          {template.icon}
        </div>
        <div className="absolute inset-0 bg-black bg-opacity-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Link 
            href={`/templates/${template.id}`}
            className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200"
          >
            View Demo
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {template.name}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">
          {template.description}
        </p>

        {/* Features */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Key Features:
          </h4>
          <ul className="grid grid-cols-2 gap-1">
            {template.features.map((feature, index) => (
              <li key={index} className="text-xs text-gray-600 dark:text-gray-300 flex items-center">
                <svg className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link 
            href={`/templates/${template.id}`}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold text-center hover:bg-blue-700 transition-colors duration-200"
          >
            View Template
          </Link>
          
          <button
            onClick={copyToClipboard}
            className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 text-sm"
          >
            {showInstallCommand ? (
              <span className="flex items-center justify-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Copied!
              </span>
            ) : (
              "Copy Install Command"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
