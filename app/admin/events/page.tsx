// app/admin/events/page.tsx
"use client";
import { Card, CardContent, CardHeader, Button, Input, TextArea, Switch, Modal, ModalDialog, ModalHeader, ModalBody, ModalFooter, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tabs, Tab } from "@heroui/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { eventService, Event } from "@/lib/database";
import { getErrorMessage } from "@/lib/errorHandler";
import { toast } from "sonner";
import { PlusIcon, Pencil, Trash2, Image as ImageIcon, CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, TagIcon, StarIcon, CrownIcon, TrendingUpIcon, LinkIcon } from "lucide-react";
import { useDisclosure } from "@/components/compat";
export default function AdminEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    status: "upcoming"
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
      const allEvents = await eventService.getAllEvents();
      setEvents(allEvents);
    } catch (error) {
      console.error("Error loading events:", error);
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

    // Validation
    if (!formData.image || !formData.image.startsWith('http')) {
      toast.error("Please enter a valid image URL (must start with http:// or https://)");
      return;
    }

    if (!formData.organizerAvatar || !formData.organizerAvatar.startsWith('http')) {
      toast.error("Please enter a valid organizer avatar URL (must start with http:// or https://)");
      return;
    }

    setSubmitting(true);

    try {
      if (editingEvent) {
        await eventService.updateEvent(editingEvent.$id!, formData);
      } else {
        await eventService.createEvent(formData as Omit<Event, '$id' | '$createdAt' | '$updatedAt'>);
      }
      
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
    onOpen();
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
    setDeletingId(eventId);
    try {
      await eventService.deleteEvent(eventId);
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
      const count = await eventService.deletePastEvents();
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
      discountPrice: null,
      capacity: 50,
      registered: 0,
      organizerName: "",
      organizerAvatar: "",
      tags: [],
      isFeatured: false,
      isPremium: false,
      status: "upcoming"
    });
    setTagInput("");
    onClose();
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
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Event Management
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Manage all events from here
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button 
            variant="danger" 
                type="submit" 
                isLoading={submitting}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold"
              >
                {editingEvent ? "Update Event" : "Create Event"}
              </Button>
            </ModalFooter>
          </form>
        </ModalDialog>
      </Modal>
    </div>
  );
}