"use server";

import { sendEmail } from "@tinadmin/core/email";
import { createClient } from "@/core/database/server";
import type { SupportTicket, SupportTicketThread } from "@tinadmin/core/support";

/**
 * Send email notification when a ticket is created
 */
export async function notifyTicketCreated(ticket: SupportTicket) {
  try {
    const supabase = await createClient();
    
    // Get customer email
    const { data: customer } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", ticket.created_by)
      .single();
    
    if (!customer || !(customer as { email: string }).email) {
      console.warn("Customer email not found for ticket notification");
      return;
    }
    
    // Send to customer
    await sendEmail({
      to: (customer as { email: string }).email,
      from: process.env.EMAIL_FROM || "noreply@example.com",
      subject: `Support Ticket Created: ${ticket.ticket_number}`,
      html: `
        <h2>Your support ticket has been created</h2>
        <p>Hello ${(customer as { full_name?: string }).full_name || "there"},</p>
        <p>Your support ticket <strong>${ticket.ticket_number}</strong> has been created successfully.</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        ${ticket.description ? `<p><strong>Description:</strong><br>${ticket.description}</p>` : ""}
        <p>We'll get back to you soon!</p>
      `,
      text: `
        Your support ticket ${ticket.ticket_number} has been created successfully.
        Subject: ${ticket.subject}
        Status: ${ticket.status}
        Priority: ${ticket.priority}
        ${ticket.description ? `Description: ${ticket.description}` : ""}
      `,
      tenantId: ticket.tenant_id,
    });
    
    // Send to assigned agent if assigned
    if (ticket.assigned_to) {
      const { data: agent } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", ticket.assigned_to)
        .single();
      
      const agentEmail = agent ? (agent as { email?: string })?.email : undefined;
      const agentName = agent ? (agent as { full_name?: string })?.full_name : undefined;
      if (agentEmail) {
        await sendEmail({
          to: agentEmail,
          from: process.env.EMAIL_FROM || "noreply@example.com",
          subject: `New Support Ticket Assigned: ${ticket.ticket_number}`,
          html: `
            <h2>New support ticket assigned to you</h2>
            <p>Hello ${agentName || "there"},</p>
            <p>A new support ticket <strong>${ticket.ticket_number}</strong> has been assigned to you.</p>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <p><strong>Customer:</strong> ${(customer as { full_name?: string; email: string }).full_name || (customer as { email: string }).email}</p>
            <p><strong>Priority:</strong> ${ticket.priority}</p>
            ${ticket.description ? `<p><strong>Description:</strong><br>${ticket.description}</p>` : ""}
          `,
          text: `
            A new support ticket ${ticket.ticket_number} has been assigned to you.
            Subject: ${ticket.subject}
            Customer: ${(customer as { full_name?: string; email: string }).full_name || (customer as { email: string }).email}
            Priority: ${ticket.priority}
            ${ticket.description ? `Description: ${ticket.description}` : ""}
          `,
          tenantId: ticket.tenant_id,
        });
      }
    }
  } catch (error) {
    console.error("Failed to send ticket creation notification:", error);
    // Don't throw - email failures shouldn't break ticket creation
  }
}

/**
 * Send email notification when a ticket is updated
 */
export async function notifyTicketUpdated(
  ticket: SupportTicket,
  changes: { status?: string; priority?: string; assigned_to?: string }
) {
  try {
    const supabase = await createClient();
    
    // Get customer email
    const { data: customer } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", ticket.created_by)
      .single();
    
    if (!customer || !(customer as { email: string }).email) {
      return;
    }
    
    const changeMessages: string[] = [];
    if (changes.status) changeMessages.push(`Status changed to: ${changes.status}`);
    if (changes.priority) changeMessages.push(`Priority changed to: ${changes.priority}`);
    if (changes.assigned_to) {
      const { data: agent } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", changes.assigned_to)
        .single();
      const agentName = agent ? (agent as { full_name?: string })?.full_name : undefined;
      changeMessages.push(`Assigned to: ${agentName || "Agent"}`);
    }
    
    if (changeMessages.length === 0) return;
    
    await sendEmail({
      to: (customer as { email: string }).email,
      from: process.env.EMAIL_FROM || "noreply@example.com",
      subject: `Support Ticket Updated: ${ticket.ticket_number}`,
      html: `
        <h2>Your support ticket has been updated</h2>
        <p>Hello ${(customer as { full_name?: string }).full_name || "there"},</p>
        <p>Your support ticket <strong>${ticket.ticket_number}</strong> has been updated:</p>
        <ul>
          ${changeMessages.map((msg) => `<li>${msg}</li>`).join("")}
        </ul>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
      `,
      text: `
        Your support ticket ${ticket.ticket_number} has been updated:
        ${changeMessages.join("\n")}
        Subject: ${ticket.subject}
      `,
      tenantId: ticket.tenant_id,
    });
  } catch (error) {
    console.error("Failed to send ticket update notification:", error);
  }
}

/**
 * Send email notification when a reply is added to a ticket
 */
export async function notifyTicketReply(
  ticket: SupportTicket,
  thread: SupportTicketThread,
  isAgentReply: boolean
) {
  try {
    const supabase = await createClient();
    
    // Skip internal notes
    if (thread.is_internal) return;
    
    if (isAgentReply) {
      // Agent replied - notify customer
      const { data: customer } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", ticket.created_by)
        .single();
      
      if (customer && (customer as { email: string }).email) {
        await sendEmail({
          to: (customer as { email: string }).email,
          from: process.env.EMAIL_FROM || "noreply@example.com",
          subject: `New Reply on Support Ticket: ${ticket.ticket_number}`,
          html: `
            <h2>New reply on your support ticket</h2>
            <p>Hello ${(customer as { full_name?: string }).full_name || "there"},</p>
            <p>You have received a new reply on support ticket <strong>${ticket.ticket_number}</strong>.</p>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              ${thread.message.replace(/\n/g, "<br>")}
            </div>
            <p>You can view and reply to this ticket in your support portal.</p>
          `,
          text: `
            New reply on your support ticket ${ticket.ticket_number}
            Subject: ${ticket.subject}
            
            ${thread.message}
          `,
          tenantId: ticket.tenant_id,
        });
      }
    } else {
      // Customer replied - notify assigned agent or all agents
      const recipients: string[] = [];
      
      if (ticket.assigned_to) {
        const { data: agent } = await supabase
          .from("users")
          .select("email")
          .eq("id", ticket.assigned_to)
          .single();
        if (agent && (agent as { email: string }).email) recipients.push((agent as { email: string }).email);
      }
      
      // If no assigned agent, notify all agents in tenant (optional)
      // For now, just notify assigned agent
      
      for (const email of recipients) {
        await sendEmail({
          to: email,
          from: process.env.EMAIL_FROM || "noreply@example.com",
          subject: `New Customer Reply on Ticket: ${ticket.ticket_number}`,
          html: `
            <h2>New customer reply</h2>
            <p>A customer has replied to support ticket <strong>${ticket.ticket_number}</strong>.</p>
            <p><strong>Subject:</strong> ${ticket.subject}</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              ${thread.message.replace(/\n/g, "<br>")}
            </div>
          `,
          text: `
            New customer reply on ticket ${ticket.ticket_number}
            Subject: ${ticket.subject}
            
            ${thread.message}
          `,
          tenantId: ticket.tenant_id,
        });
      }
    }
  } catch (error) {
    console.error("Failed to send ticket reply notification:", error);
  }
}

