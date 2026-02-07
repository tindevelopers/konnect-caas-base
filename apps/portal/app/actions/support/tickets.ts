"use server";

// Re-export from admin actions for portal use
export {
  getAllSupportTickets,
  getSupportTicket,
  createTicket,
} from "../../../../admin/app/actions/support/tickets";

