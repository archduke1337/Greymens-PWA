// app/admin/events/page.tsx
"use client";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { eventService, Event } from "@/lib/database";
import { PlusIcon, Pencil, Trash2, Image as ImageIcon, CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, TagIcon, StarIcon, CrownIcon, TrendingUpIcon, LinkIcon } from "lucide-react";

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
      alert("Please enter a valid image URL (must start with http:// or https://)");
      return;
    }

    if (!formData.organizerAvatar || !formData.organizerAvatar.startsWith('http')) {
      alert("Please enter a valid organizer avatar URL (must start with http:// or https://)");
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
      alert(editingEvent ? "Event updated successfully!" : "Event created successfully!");
    } catch (error: any) {
      console.error("Error saving event:", error);
      alert(error.message || "Failed to save event");
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
    if (!confirm("Are you sure you want to delete this event?")) return;

    setDeletingId(eventId);
    try {
      await eventService.deleteEvent(eventId);
      await loadEvents();
      alert("Event deleted successfully!");
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePastEvents = async () => {
    if (!confirm("Are you sure you want to delete all past events?")) return;

    try {
      const count = await eventService.deletePastEvents();
      await loadEvents();
      alert(`${count} past events deleted successfully!`);
    } catch (error) {
      console.error("Error deleting past events:", error);
      alert("Failed to delete past events");
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
            color="danger" 
            variant="flat" 
            onPress={handleDeletePastEvents}
            className="w-full sm:w-auto"
            size="sm"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Delete Past Events</span>
            <span className="sm:hidden ml-2">Delete Past</span>
          </Button>
          <Button 
            color="primary" 
            onPress={onOpen}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600"
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
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Events</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CalendarIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-none shadow-md">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Upcoming</p>
                <p className="text-2xl font-bold">
                  {events.filter(e => e.status === "upcoming").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUpIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-none shadow-md">
          <CardBody className="p-4">
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
          </CardBody>
        </Card>

        <Card className="border-none shadow-md">
          <CardBody className="p-4">
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
          </CardBody>
        </Card>
      </div>

      {/* Events Table */}
      <Card className="border-none shadow-lg">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label="Events table" className="min-w-full">
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
                        color={event.status === "upcoming" ? "success" : "default"}
                        variant="flat"
                        size="sm"
                        className="text-xs"
                      >
                        {event.status}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 md:gap-2">
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleEdit(event)}
                        >
                          <Pencil className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="light"
                          isIconOnly
                          onPress={() => handleDelete(event.$id!)}
                          isLoading={deletingId === event.$id}
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={handleCloseModal} 
        size="3xl" 
        scrollBehavior="inside"
        classNames={{
          base: "max-h-[95vh]",
          wrapper: "items-center"
        }}
      >
        <ModalContent>
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex flex-col gap-1 border-b pb-4">
              <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h2>
              <p className="text-sm text-default-500 font-normal">
                Fill in the details below to {editingEvent ? "update" : "create"} an event
              </p>
            </ModalHeader>
            
            <ModalBody className="py-6">
              <Tabs aria-label="Event form sections" color="primary" variant="underlined">
                <Tab key="basic" title={
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Basic Info</span>
                    <span className="sm:hidden">Basic</span>
                  </div>
                }>
                  <div className="space-y-6 pt-4">
                    {/* Image URL */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        Event Image URL *
                      </label>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={formData.image}
                        onChange={(e) => handleInputChange("image", e.target.value)}
                        required
                        startContent={<LinkIcon className="w-4 h-4 text-default-400" />}
                        description="Enter a direct link to the event image"
                        classNames={{
                          input: "text-sm"
                        }}
                      />
                      {formData.image && formData.image.startsWith('http') && (
                        <div className="relative group w-full">
                          <img 
                            src={formData.image} 
                            alt="Preview" 
                            className="w-full h-48 object-cover rounded-xl border-2 border-purple-200 dark:border-purple-800"
                            onError={(e) => {
                              e.currentTarget.src = "https://via.placeholder.com/400x300?text=Invalid+Image+URL";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                            <p className="text-white text-sm">Image Preview</p>
                          </div>
                        </div>
                      )}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          💡 Tip: Use free image hosting services like Imgur, Cloudinary, or Unsplash for reliable image URLs
                        </p>
                      </div>
                    </div>

                    <Input
                      label="Event Title"
                      placeholder="Enter event title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                      classNames={{
                        label: "font-semibold",
                        input: "text-base"
                      }}
                    />

                    <Textarea
                      label="Description"
                      placeholder="Describe your event in detail"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      required
                      minRows={4}
                      classNames={{
                        label: "font-semibold"
                      }}
                    />

                    <Select
                      label="Category"
                      placeholder="Select event category"
                      selectedKeys={[formData.category!]}
                      onChange={(e) => handleInputChange("category", e.target.value)}
                      required
                      classNames={{
                        label: "font-semibold"
                      }}
                    >
                      <SelectItem key="conference">Conference</SelectItem>
                      <SelectItem key="workshop">Workshop</SelectItem>
                      <SelectItem key="masterclass">Masterclass</SelectItem>
                      <SelectItem key="competition">Competition</SelectItem>
                      <SelectItem key="bootcamp">Bootcamp</SelectItem>
                      <SelectItem key="forum">Forum</SelectItem>
                    </Select>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <Switch
                        isSelected={formData.isFeatured}
                        onValueChange={(checked) => handleInputChange("isFeatured", checked)}
                        color="warning"
                      >
                        <div className="flex items-center gap-2">
                          <StarIcon className="w-4 h-4 text-yellow-600" />
                          <span className="font-semibold text-sm">Featured</span>
                        </div>
                      </Switch>
                      <Switch
                        isSelected={formData.isPremium}
                        onValueChange={(checked) => handleInputChange("isPremium", checked)}
                        color="secondary"
                      >
                        <div className="flex items-center gap-2">
                          <CrownIcon className="w-4 h-4 text-purple-600" />
                          <span className="font-semibold text-sm">Premium</span>
                        </div>
                      </Switch>
                    </div>
                  </div>
                </Tab>

                <Tab key="details" title={
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Date & Location</span>
                    <span className="sm:hidden">Location</span>
                  </div>
                }>
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange("date", e.target.value)}
                        required
                        classNames={{
                          label: "font-semibold"
                        }}
                      />
                      <Input
                        label="Time"
                        type="text"
                        placeholder="e.g., 09:00 AM - 06:00 PM"
                        value={formData.time}
                        onChange={(e) => handleInputChange("time", e.target.value)}
                        required
                        classNames={{
                          label: "font-semibold"
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Venue"
                        placeholder="e.g., Grand Convention Center"
                        value={formData.venue}
                        onChange={(e) => handleInputChange("venue", e.target.value)}
                        required
                        classNames={{
                          label: "font-semibold"
                        }}
                      />
                      <Input
                        label="Location"
                        placeholder="e.g., New York, NY"
                        value={formData.location}
                        onChange={(e) => handleInputChange("location", e.target.value)}
                        required
                        classNames={{
                          label: "font-semibold"
                        }}
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
                </Tab>

                <Tab key="pricing" title={
                  <div className="flex items-center gap-2">
                    <DollarSignIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Pricing & Capacity</span>
                    <span className="sm:hidden">Pricing</span>
                  </div>
                }>
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input
                        label="Regular Price ($)"
                        type="number"
                        placeholder="0"
                        value={formData.price?.toString()}
                        onChange={(e) => handleInputChange("price", parseFloat(e.target.value) || 0)}
                        required
                        startContent={<DollarSignIcon className="w-4 h-4 text-default-400" />}
                        classNames={{
                          label: "font-semibold"
                        }}
                      />
                      <Input
                        label="Discount Price ($)"
                        type="number"
                        placeholder="Optional"
                        value={formData.discountPrice?.toString() || ""}
                        onChange={(e) => handleInputChange("discountPrice", e.target.value ? parseFloat(e.target.value) : null)}
                        startContent={<DollarSignIcon className="w-4 h-4 text-default-400" />}
                        classNames={{
                          label: "font-semibold"
                        }}
                      />
                      <Input
                        label="Capacity"
                        type="number"
                        placeholder="50"
                        value={formData.capacity?.toString()}
                        onChange={(e) => handleInputChange("capacity", parseInt(e.target.value) || 50)}
                        required
                        startContent={<UsersIcon className="w-4 h-4 text-default-400" />}
                        classNames={{
                          label: "font-semibold"
                        }}
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

                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
                        💡 Pricing Tips
                      </p>
                      <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                        <li>• Set price to $0 for free events</li>
                        <li>• Add discount price for early bird offers</li>
                        <li>• Consider your target audience's budget</li>
                        <li>• Capacity helps manage registrations</li>
                      </ul>
                    </div>
                  </div>
                </Tab>

                <Tab key="organizer" title={
                  <div className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Organizer & Tags</span>
                    <span className="sm:hidden">More</span>
                  </div>
                }>
                  <div className="space-y-6 pt-4">
                    <Input
                      label="Organizer Name"
                      placeholder="e.g., John Doe"
                      value={formData.organizerName}
                      onChange={(e) => handleInputChange("organizerName", e.target.value)}
                      required
                      classNames={{
                        label: "font-semibold"
                      }}
                    />
                    
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        Organizer Avatar URL *
                      </label>
                      <Input
                        placeholder="https://example.com/avatar.jpg"
                        value={formData.organizerAvatar}
                        onChange={(e) => handleInputChange("organizerAvatar", e.target.value)}
                        required
                        startContent={<LinkIcon className="w-4 h-4 text-default-400" />}
                        description="Enter a direct link to the organizer's avatar"
                        classNames={{
                          input: "text-sm"
                        }}
                      />
                      {formData.organizerAvatar && formData.organizerAvatar.startsWith('http') && (
                        <div className="flex items-center gap-3 p-3 bg-default-100 dark:bg-default-50/10 rounded-lg">
                          <img 
                            src={formData.organizerAvatar} 
                            alt="Avatar preview" 
                            className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 dark:border-purple-800"
                            onError={(e) => {
                              e.currentTarget.src = "https://via.placeholder.com/100?text=Invalid";
                            }}
                          />
                          <span className="text-sm text-default-600">Avatar Preview</span>
                        </div>
                      )}
                    </div>

                    {/* Tags Section */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <TagIcon className="w-4 h-4 text-purple-600" />
                        Event Tags
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a tag (e.g., AI, Networking)"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          onPress={handleAddTag}
                          color="primary"
                          variant="flat"
                        >
                          Add
                        </Button>
                      </div>
                      {formData.tags && formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-4 bg-default-100 dark:bg-default-50/10 rounded-xl">
                          {formData.tags.map((tag, index) => (
                            <Chip 
                              key={index} 
                              onClose={() => handleRemoveTag(tag)} 
                              variant="flat"
                              color="secondary"
                              className="font-medium"
                            >
                              {tag}
                            </Chip>
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
                        <li>• Examples: "Machine Learning", "Beginner Friendly"</li>
                      </ul>
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </ModalBody>

            <ModalFooter className="border-t pt-4">
              <Button 
                variant="flat" 
                onPress={handleCloseModal}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                color="primary" 
                type="submit" 
                isLoading={submitting}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold"
              >
                {editingEvent ? "Update Event" : "Create Event"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}