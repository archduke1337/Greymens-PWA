// app/events/[id]/tickets/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ticketService } from "@/lib/tickets";
import type { Ticket } from "@/lib/types";
import { eventService, type Event } from "@/lib/database";
import { toast } from "sonner";
import {
  Ticket as TicketIcon,
  CheckCircle,
  XCircle,
  Search,
  ArrowLeft,
  Users,
  Clock,
  Filter,
  Loader2,
  QrCode,
  ShieldCheck,
  Ban,
  User,
  Mail,
  Hash,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Badge,
} from "@heroui/react";

export default function EventTicketsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      const [eventData, ticketsData] = await Promise.all([
        eventService.getEventById(eventId),
        ticketService.getByEvent(eventId),
      ]);
      setEvent(eventData);
      setTickets(ticketsData);
    } catch (error) {
      console.error("Error loading tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckIn = async (ticketId: string) => {
    if (!user) {
      toast.error("You must be logged in to check in tickets");
      return;
    }

    setCheckingIn(ticketId);
    try {
      const result = await ticketService.checkIn(ticketId, user.$id, "manual_search");
      if (result.success) {
        toast.success(result.message);
        await loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Failed to check in ticket");
    } finally {
      setCheckingIn(null);
    }
  };

  const handleInvalidate = async (ticketId: string) => {
    const confirmed = window.confirm("Are you sure you want to invalidate this ticket?");
    if (!confirmed) return;

    try {
      await ticketService.invalidate(ticketId, "Manually invalidated by admin");
      toast.success("Ticket invalidated");
      await loadData();
    } catch (error) {
      console.error("Invalidate error:", error);
      toast.error("Failed to invalidate ticket");
    }
  };

  const stats = {
    total: tickets.length,
    issued: tickets.filter((t) => t.status === "issued" || t.status === "active").length,
    checkedIn: tickets.filter((t) => t.status === "checked_in").length,
    invalidated: tickets.filter((t) => t.status === "invalidated").length,
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      searchQuery === "" ||
      ticket.ticketCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.userId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && (ticket.status === "issued" || ticket.status === "active")) ||
      (statusFilter === "checked_in" && ticket.status === "checked_in") ||
      (statusFilter === "invalidated" && ticket.status === "invalidated");

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "issued":
      case "active":
        return "primary";
      case "checked_in":
        return "primary";
      case "invalidated":
        return "secondary";
      case "completed":
        return "soft";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "issued":
        return "Issued";
      case "active":
        return "Active";
      case "checked_in":
        return "Checked In";
      case "invalidated":
        return "Invalidated";
      case "completed":
        return "Completed";
      case "transferred":
        return "Transferred";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading tickets...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-danger mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
          <p className="text-default-500 mb-6">
            The event you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button onPress={() => router.push("/events")}>Browse Events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onPress={() => router.push(`/events/${eventId}`)}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Event
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Ticket Management
        </h1>
        <p className="text-default-500 mt-1">
          {event.title} &mdash; {new Date(event.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Issued</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TicketIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Active</p>
                <p className="text-2xl font-bold">{stats.issued}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Checked In</p>
                <p className="text-2xl font-bold">{stats.checkedIn}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Invalidated</p>
                <p className="text-2xl font-bold">{stats.invalidated}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-none shadow-md mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by ticket code or user ID..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}

              />
            </div>
            <div className="flex gap-2">
              {[
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "checked_in", label: "Checked In" },
                { key: "invalidated", label: "Invalidated" },
              ].map((filter) => (
                <Button
                  key={filter.key}
                  variant={statusFilter === filter.key ? "primary" : "ghost"}
                  size="sm"
                  onPress={() => setStatusFilter(filter.key)}
                >
                  <Filter className="w-3 h-3 mr-1" />
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12">
            <div className="text-center">
              <TicketIcon className="w-16 h-16 text-default-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Tickets Found</h3>
              <p className="text-default-500">
                {searchQuery
                  ? "No tickets match your search criteria."
                  : "No tickets have been issued for this event yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.$id} className="border-none shadow-md">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Ticket Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant={getStatusColor(ticket.status) as any} size="lg">
                        {getStatusLabel(ticket.status)}
                      </Badge>
                      <span className="text-sm font-mono text-default-500">
                        {ticket.ticketCode}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-default-600">
                        <User className="w-4 h-4 text-default-400 flex-shrink-0" />
                        <span className="truncate">User: {ticket.userId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-default-600">
                        <Hash className="w-4 h-4 text-default-400 flex-shrink-0" />
                        <span className="truncate">QR: {ticket.qrData}</span>
                      </div>
                      {ticket.issuedAt && (
                        <div className="flex items-center gap-2 text-default-600">
                          <Clock className="w-4 h-4 text-default-400 flex-shrink-0" />
                          <span>Issued: {new Date(ticket.issuedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {ticket.checkedInAt && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Checked in: {new Date(ticket.checkedInAt).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-default-600">
                        <Users className="w-4 h-4 text-default-400 flex-shrink-0" />
                        <span>Entries: {ticket.entryCount}/{ticket.maxEntries}</span>
                      </div>
                    </div>

                    {ticket.invalidatedReason && (
                      <div className="mt-2 p-2 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                        <p className="text-xs text-danger">
                          Reason: {ticket.invalidatedReason}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {(ticket.status === "issued" || ticket.status === "active") && (
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => handleCheckIn(ticket.$id!)}
                        isPending={checkingIn === ticket.$id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Check In
                      </Button>
                    )}
                    {ticket.status !== "invalidated" && ticket.status !== "checked_in" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => handleInvalidate(ticket.$id!)}
                        className="text-danger hover:bg-danger-50 dark:hover:bg-danger-900/20"
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        Invalidate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom Summary */}
      {filteredTickets.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-default-500">
            Showing {filteredTickets.length} of {tickets.length} tickets
          </p>
        </div>
      )}
    </div>
  );
}
