// app/admin/events/page.tsx
"use client";
import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/types";
import {getErrorMessage, readApiError} from "@/lib/errorHandler";
import { toast } from "sonner";
import { PlusIcon, Pencil, Trash2, XIcon, Image as ImageIcon, CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, TagIcon, StarIcon, CrownIcon, TrendingUpIcon, LinkIcon } from "lucide-react";
import { Button, Card, CardContent, Chip, Input, Label, ListBox, Select, Modal, ModalBackdrop, ModalContainer, ModalDialog, ModalBody, ModalFooter, ModalHeader, Switch, Tab, TabListContainer, TabList, TabIndicator, TabPanel, Table, TableBody, TableCell, TableColumn, TableHeader, TableContent, TableScrollContainer, TableRow, Tabs, TextArea, useOverlayState } from "@heroui/react";

export default function AdminEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isOpen, open, close } = useOverlayState();

  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lifecycleId, setLifecycleId] = useState<string | null>(null);

  const STATUS_COLORS: Record<Event["status"], "default" | "accent" | "success" | "warning" | "danger"> = {
    draft: "default",
    review: "warning",
    approved: "accent",
    published: "success",
    active: "success",
    completed: "default",
    cancelled: "danger",
  };

  // Form state
  const [formData, setFormData] = useState<Partial<Event>>({
    title: "",
    description: "",
    image: "",
    date: "",
    time: "",
    venue: "",
    location: "",
    category: "conference",
    price: 0,
    discountPrice: null,
    capacity: 50,
    registered: 0,
    organizerName: "",
    organizerAvatar: "",
    tags: [],
    isFeatured: false,
    isPremium: false,
    status: "draft"
  });
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    loadEvents();
  }, [user, loading, router]);

  const loadEvents = async () => {
    try {
      const response = await fetch("/api/admin/events", { credentials: "include" });
      const payload = (await response.json()) as { events?: Event[]; error?: string };
      if (!response.ok) throw new Error(readApiError(payload, "Unable to load events"));
      setEvents(payload.events ?? []);
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error(getErrorMessage(error) || "Unable to load events");
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleInputChange = (field: keyof Event, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(t => t !== tag)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Explicit validation with tab names: required inputs live across tab
    // panels, so native `required` (removed from this form) could block
    // submit from a hidden tab with no visible cue. Check here instead.
    const missing: string[] = [];
    if (!formData.title?.trim()) missing.push("title (Basic Info tab)");
    if (!formData.description?.trim()) missing.push("description (Basic Info tab)");
    if (!formData.date) missing.push("date (Date & Location tab)");
    if (!formData.time?.trim()) missing.push("time (Date & Location tab)");
    if (!formData.venue?.trim()) missing.push("venue (Date & Location tab)");
    if (!formData.location?.trim()) missing.push("location (Date & Location tab)");
    if (!formData.organizerName?.trim()) missing.push("organizer name (Organizer tab)");
    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(", ")}`);
      return;
    }

    // Validation
    if (!formData.image || !formData.image.startsWith('http')) {
      toast.error("Please enter a valid image URL (must start with http:// or https://)");
      return;
    }

    if (!formData.organizerAvatar || !formData.organizerAvatar.startsWith('http')) {
      toast.error("Please enter a valid organizer avatar URL (must start with http:// or https://)");
      return;
    }

    // The server requires whole numbers: decimals 400, NaN 400s, and a
    // cleared field must not silently become free (0) or default (50).
    const price = Number(formData.price);
    const capacity = Number(formData.capacity);
    if (!Number.isInteger(price) || price < 0) {
      toast.error("Price must be a whole number, 0 or more (Pricing tab)");
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      toast.error("Capacity must be a whole number, 1 or more (Pricing tab)");
      return;
    }
    const discountRaw = formData.discountPrice;
    const discountPrice =
      discountRaw === null || discountRaw === undefined
        ? null
        : Number(discountRaw);
    if (discountPrice !== null && (!Number.isFinite(discountPrice) || discountPrice < 0)) {
      toast.error("Discount price must be 0 or more (Pricing tab)");
      return;
    }
    if (discountPrice !== null && discountPrice >= price) {
      toast.error("Discount price must be less than the regular price (Pricing tab)");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/events", {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editingEvent
          ? { action: "update", eventId: editingEvent.$id, ...formData, price, capacity, discountPrice }
          : { ...formData, price, capacity, discountPrice }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to save event"));
      
      await loadEvents();
      handleCloseModal();
      toast.success(editingEvent ? "Event updated successfully!" : "Event created successfully!");
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error saving event:", message);
      toast.error(message || "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData(event);
    open();
  };

  const handleLifecycle = async (eventId: string, action: "approve" | "publish" | "reject") => {
    if (action === "reject") {
      const reason = window.prompt("Reason for rejection (shown to the organizer)?", "");
      if (reason === null) return; // prompt cancelled — abort, do not reject
      return void handleLifecycleConfirm(eventId, action, reason.trim() || undefined);
    }
    const label = action === "approve" ? "Approve this event?" : "Publish this event? It will become publicly visible.";
    if (!confirm(label)) return;
    return void handleLifecycleConfirm(eventId, action);
  };

  const handleLifecycleConfirm = async (eventId: string, action: "approve" | "publish" | "reject", reason?: string) => {
    setLifecycleId(eventId);
    try {
      const response = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(reason !== undefined ? { action, eventId, reason } : { action, eventId }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, `Unable to ${action} event`));
      await loadEvents();
      toast.success(
        action === "approve" ? "Event approved." : action === "publish" ? "Event published." : "Event rejected.",
      );
    } catch (error) {
      console.error(`Error ${action} event:`, error);
      toast.error(getErrorMessage(error) || `Failed to ${action} event`);
    } finally {
      setLifecycleId(null);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
    setDeletingId(eventId);
    try {
      const response = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      // 409 carries registration/ticket counts — surface them so the admin
      // knows why deletion is blocked instead of a generic failure.
      if (!response.ok) throw new Error(readApiError(payload, "Unable to delete event"));
      await loadEvents();
      toast.success("Event deleted successfully!");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePastEvents = async () => {
    if (!confirm("Delete ALL past events? This cannot be undone.")) return;
    try {
      const response = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ past: true }),
      });
      const payload = await response.json().catch(() => null) as { deleted?: number; error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to delete past events"));
      const count = payload?.deleted ?? 0;
      await loadEvents();
      toast.success(`${count} past events deleted successfully!`);
    } catch (error) {
      console.error("Error deleting past events:", error);
      toast.error("Failed to delete past events");
    }
  };

  const handleCloseModal = () => {
    setEditingEvent(null);
    setFormData({
      title: "",
      description: "",
      image: "",
      date: "",
      time: "",
      venue: "",
      location: "",
      category: "conference",
      price: 0,
    discountPrice: undefined,
    capacity: 50,
    registered: 0,
    organizerName: "",
    organizerAvatar: "",
    tags: [],
    isFeatured: false,
    isPremium: false,
    status: "draft"
    });
    setTagInput("");
    close();
  };

  if (loading || loadingEvents) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Event Management
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Manage all events from here
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button variant="primary" 
            className="w-full sm:w-auto"
            size="sm"
            onPress={handleDeletePastEvents}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Delete Past Events</span>
            <span className="sm:hidden ml-2">Delete Past</span>
          </Button>
          <Button onPress={open}
            className="w-full sm:w-auto bg-primary"
            size="sm"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="ml-2">Add Event</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Events</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <CalendarIcon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Upcoming</p>
                <p className="text-2xl font-bold">
                  {events.filter(e => e.status === "active").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUpIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Registered</p>
                <p className="text-2xl font-bold">
                  {events.reduce((sum, e) => sum + e.registered, 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Featured</p>
                <p className="text-2xl font-bold">
                  {events.filter(e => e.isFeatured).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <StarIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableScrollContainer>
                <TableContent aria-label="Events table" className="min-w-full">
              <TableHeader>
                <TableColumn>EVENT</TableColumn>
                <TableColumn className="hidden md:table-cell">DATE</TableColumn>
                <TableColumn className="hidden lg:table-cell">LOCATION</TableColumn>
                <TableColumn className="hidden sm:table-cell">CAPACITY</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.$id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm md:text-base truncate">
                            {event.title}
                          </p>
                          <p className="text-xs md:text-sm text-default-500 truncate">
                            {event.category}
                          </p>
                          <p className="text-xs text-default-400 md:hidden">
                            {new Date(event.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(event.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="truncate max-w-xs block">
                        {event.location}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <UsersIcon className="w-3 h-3 text-default-400" />
                        <span className="text-sm">
                          {event.registered}/{event.capacity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={STATUS_COLORS[event.status] ?? "default"}
                        variant="primary"
                        size="sm"
                        className="text-xs"
                      >
                        {event.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 md:gap-2">
                        {(event.status === "draft" || event.status === "review") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isPending={lifecycleId === event.$id}
                            onPress={() => handleLifecycle(event.$id!, "approve")}
                          >
                            Approve
                          </Button>
                        )}
                        {event.status === "approved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isPending={lifecycleId === event.$id}
                            onPress={() => handleLifecycle(event.$id!, "publish")}
                          >
                            Publish
                          </Button>
                        )}
                        {event.status !== "cancelled" && event.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isPending={lifecycleId === event.$id}
                            onPress={() => handleLifecycle(event.$id!, "reject")}
                          >
                            {event.status === "published" || event.status === "active" ? "Cancel" : "Reject"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          onPress={() => handleEdit(event)}
                        >
                          <Pencil className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          isPending={deletingId === event.$id}
                          onPress={() => handleDelete(event.$id!)}
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </TableContent>
              </TableScrollContainer>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Modal>
        <ModalBackdrop isOpen={isOpen} onOpenChange={(open: boolean) => { if (!open) handleCloseModal(); }}>
          <ModalContainer>
            <ModalDialog>
              {({close: dialogClose}: {close: () => void}) => (
                <form onSubmit={handleSubmit}>
            <ModalHeader className="flex flex-col gap-1 border-b pb-4">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h2>
              <p className="text-sm text-default-500 font-normal">
                Fill in the details below to {editingEvent ? "update" : "create"} an event
              </p>
            </ModalHeader>
            
            <ModalBody className="py-6">
              <Tabs aria-label="Event form sections">
                <TabListContainer>
                  <TabList>
                    <Tab id="basic">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Basic Info</span>
                        <span className="sm:hidden">Basic</span>
                      </div>
                      <TabIndicator />
                    </Tab>
                    <Tab id="details">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Date & Location</span>
                        <span className="sm:hidden">Location</span>
                      </div>
                      <TabIndicator />
                    </Tab>
                    <Tab id="pricing">
                      <div className="flex items-center gap-2">
                        <DollarSignIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Pricing & Capacity</span>
                        <span className="sm:hidden">Pricing</span>
                      </div>
                      <TabIndicator />
                    </Tab>
                    <Tab id="organizer">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Organizer & Tags</span>
                        <span className="sm:hidden">More</span>
                      </div>
                      <TabIndicator />
                    </Tab>
                  </TabList>
                </TabListContainer>

                <TabPanel id="basic">
                  <div className="space-y-6 pt-4">
                    {/* Image URL */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        Event Image URL *
                      </label>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={formData.image}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("image", e.target.value)}
                      />
                      {formData.image && formData.image.startsWith('http') && (
                        <div className="relative group w-full">
                          <img 
                            src={formData.image} 
                            alt="Preview" 
                            className="w-full h-48 object-cover rounded-xl border-2 border-border"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                            <p className="text-white text-sm">Image Preview</p>
                          </div>
                        </div>
                      )}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Tip: use free image hosting services like Imgur, Cloudinary, or Unsplash for reliable image URLs
                        </p>
                      </div>
                    </div>

                    <Input
                      placeholder="Enter event title"
                      value={formData.title}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("title", e.target.value)}
                    />

                    <TextArea
                      placeholder="Describe your event in detail"
                      value={formData.description}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleInputChange("description", e.target.value)}
                    />

                    <Select
                      fullWidth
                      aria-label="Event category"
                      value={formData.category!}
                      onChange={(value) => handleInputChange("category", String(value ?? "conference"))}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {["conference", "workshop", "masterclass", "competition", "bootcamp", "forum"].map((category) => (
                            <ListBox.Item key={category} id={category} textValue={category.charAt(0).toUpperCase() + category.slice(1)}>
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted rounded-xl">
                      <Switch
                        isSelected={formData.isFeatured}
                        onChange={(checked: boolean) => handleInputChange("isFeatured", checked)}
                        aria-label="Featured"
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <div className="flex items-center gap-2">
                            <StarIcon className="w-4 h-4 text-yellow-600" />
                            <span className="font-semibold text-sm">Featured</span>
                          </div>
                        </Switch.Content>
                      </Switch>
                      <Switch
                        isSelected={formData.isPremium}
                        onChange={(checked: boolean) => handleInputChange("isPremium", checked)}
                        aria-label="Premium"
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <div className="flex items-center gap-2">
                            <CrownIcon className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-sm">Premium</span>
                          </div>
                        </Switch.Content>
                      </Switch>
                    </div>
                  </div>
                </TabPanel>

                <TabPanel id="details">
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("date", e.target.value)}
                      />
                      <Input
                        type="text"
                        placeholder="e.g., 09:00 AM - 06:00 PM"
                        value={formData.time}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("time", e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        placeholder="e.g., Grand Convention Center"
                        value={formData.venue}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("venue", e.target.value)}
                      />
                      <Input
                        placeholder="e.g., New York, NY"
                        value={formData.location}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("location", e.target.value)}
                      />
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        📍 Location Tips
                      </p>
                      <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                        <li>• Be specific about the venue name</li>
                        <li>• Include city and state/country</li>
                        <li>• Add nearby landmarks if helpful</li>
                      </ul>
                    </div>
                  </div>
                </TabPanel>

                <TabPanel id="pricing">
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.price?.toString()}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("price", e.target.value === "" ? 0 : Number(e.target.value))}
                      />
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={formData.discountPrice?.toString() || ""}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("discountPrice", e.target.value === "" ? null : Number(e.target.value))}
                      />
                      <Input
                        type="number"
                        placeholder="50"
                        value={formData.capacity?.toString()}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("capacity", e.target.value === "" ? 0 : Number(e.target.value))}
                      />
                    </div>

                    {formData.price && formData.discountPrice && formData.discountPrice < formData.price && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                          💰 Discount Applied!
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Attendees save ${formData.price - formData.discountPrice} ({Math.round(((formData.price - formData.discountPrice) / formData.price) * 100)}% off)
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm font-semibold text-muted-foreground mb-2">
                        Pricing tips
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Set price to $0 for free events</li>
                        <li>• Add discount price for early bird offers</li>
                        <li>• Consider your target audience&apos;s budget</li>
                        <li>• Capacity helps manage registrations</li>
                      </ul>
                    </div>
                  </div>
                </TabPanel>

                <TabPanel id="organizer">
                  <div className="space-y-6 pt-4">
                    <Input
                      placeholder="e.g., John Doe"
                      value={formData.organizerName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("organizerName", e.target.value)}
                    />
                    
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        Organizer Avatar URL *
                      </label>
                      <Input
                        placeholder="https://example.com/avatar.jpg"
                        value={formData.organizerAvatar}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange("organizerAvatar", e.target.value)}
                      />
                      {formData.organizerAvatar && formData.organizerAvatar.startsWith('http') && (
                        <div className="flex items-center gap-3 p-3 bg-default-100 dark:bg-default-50/10 rounded-lg">
                          <img 
                            src={formData.organizerAvatar} 
                            alt="Avatar preview" 
                            className="w-12 h-12 rounded-full object-cover border-2 border-border"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <span className="text-sm text-default-600">Avatar Preview</span>
                        </div>
                      )}
                    </div>

                    {/* Tags Section */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <TagIcon className="w-4 h-4 text-primary" />
                        Event Tags
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a tag (e.g., AI, Networking)"
                          value={tagInput}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          variant="primary"
                          onPress={handleAddTag}
                        >
                          Add
                        </Button>
                      </div>
                      {formData.tags && formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-4 bg-default-100 dark:bg-default-50/10 rounded-xl">
                          {formData.tags.map((tag, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              aria-label={`Remove tag ${tag}`}
                              title="Remove tag"
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              {tag}
                              <XIcon className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                      <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2">
                        🏷️ Tag Best Practices
                      </p>
                      <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                        <li>• Use 3-5 relevant tags</li>
                        <li>• Include topics, skills, or themes</li>
                        <li>• Make tags searchable and specific</li>
                        <li>• Examples: &quot;Machine Learning&quot;, &quot;Beginner Friendly&quot;</li>
                      </ul>
                    </div>
                  </div>
                </TabPanel>
              </Tabs>
            </ModalBody>

            <ModalFooter className="border-t pt-4">
              <Button 
                variant="secondary" 
                className="w-full sm:w-auto"
                onPress={handleCloseModal}
              >
                Cancel
              </Button>
              <Button type="submit" 
                isPending={submitting}
                className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
              >
                {editingEvent ? "Update Event" : "Create Event"}
              </Button>
            </ModalFooter>
              </form>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}