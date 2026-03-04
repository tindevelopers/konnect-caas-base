import * as React from "react";
import EmailLayout from "../base/email-layout";

export interface ProductLinkItem {
  title?: string;
  url: string;
}

export interface ProductLinksEmailProps {
  recipientName?: string;
  assistantName?: string;
  tenantName?: string;
  introText?: string;
  links: ProductLinkItem[];
}

export default function ProductLinksEmail({
  recipientName,
  assistantName = "AI Assistant",
  tenantName = "PetStore Direct",
  introText,
  links,
}: ProductLinksEmailProps) {
  return (
    <EmailLayout
      tenantName={tenantName}
      previewText="Your product links are ready"
    >
      <h2 style={{ marginBottom: "12px" }}>Your product links are ready</h2>
      <p style={{ marginTop: 0 }}>
        Hi {recipientName?.trim() || "there"},
      </p>
      <p>
        {introText?.trim() ||
          `${assistantName} found these products for you. Use the links below to open each product page.`}
      </p>

      <ul style={{ paddingLeft: "20px", margin: "18px 0" }}>
        {links.map((link, index) => (
          <li key={`${link.url}-${index}`} style={{ marginBottom: "12px" }}>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
              {link.title?.trim() || `Product ${index + 1}`}
            </div>
            <a href={link.url} target="_blank" rel="noreferrer">
              {link.url}
            </a>
          </li>
        ))}
      </ul>

      <p>
        If you want more recommendations, reply in the same conversation and
        ask for additional options.
      </p>
    </EmailLayout>
  );
}
