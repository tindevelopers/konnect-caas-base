import { getSupportTicket } from "@/app/actions/support/tickets";
import { getTicketThreads } from "@/app/actions/support/threads";
import { getTicketAttachments } from "@/app/actions/support/attachments";
import TicketDetail from "@/components/support/TicketDetail";
import { notFound } from "next/navigation";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getSupportTicket(id);
  
  if (!ticket) {
    notFound();
  }

  const [threads, attachments] = await Promise.all([
    getTicketThreads(ticket.id, { includeInternal: true }),
    getTicketAttachments(ticket.id),
  ]);

  return (
    <TicketDetail
      ticket={ticket}
      threads={threads}
      attachments={attachments}
    />
  );
}

