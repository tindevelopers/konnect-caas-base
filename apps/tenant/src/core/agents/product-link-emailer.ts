import "server-only";

import {
  ProductLinksEmail,
  sendTemplateEmail,
  type ProductLinkItem,
} from "@tinadmin/core/email";

export interface SendProductLinksEmailParams {
  to: string;
  tenantId: string;
  links: ProductLinkItem[];
  tenantName?: string;
  assistantName?: string;
  recipientName?: string;
  introText?: string;
}

const EMAIL_PATTERN =
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/;

export function extractEmailFromMessage(text: string): string | null {
  const match = text.match(EMAIL_PATTERN);
  if (!match) return null;
  return match[0].trim().toLowerCase();
}

export async function sendProductLinksEmail(
  params: SendProductLinksEmailParams
): Promise<{ success: boolean; error?: string }> {
  const fromAddress = process.env.EMAIL_FROM?.trim();
  if (!fromAddress) {
    return { success: false, error: "EMAIL_FROM is not configured." };
  }

  const cleanedLinks = params.links
    .map((item) => ({
      title: item.title?.trim(),
      url: item.url.trim(),
    }))
    .filter((item) => /^https?:\/\//i.test(item.url));

  if (cleanedLinks.length === 0) {
    return { success: false, error: "No valid product links to send." };
  }

  const result = await sendTemplateEmail(
    {
      to: params.to,
      from: fromAddress,
      subject: "Your product links from PetStore Direct",
      tenantId: params.tenantId,
    },
    ProductLinksEmail,
    {
      links: cleanedLinks,
      tenantName: params.tenantName ?? "PetStore Direct",
      assistantName: params.assistantName ?? "AI Assistant",
      recipientName: params.recipientName,
      introText: params.introText,
    }
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "Failed to send product links email.",
    };
  }

  return { success: true };
}
