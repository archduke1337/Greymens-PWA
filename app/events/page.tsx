// app/events/page.tsx
"use client";

import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Badge } from "@heroui/badge";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { title, subtitle } from "@/components/primitives";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { eventService, type Event as EventType } from "@/lib/database";
import { getErrorMessage } from "@/lib/errorHandler";
import { sendRegistrationEmail } from "@/lib/emailService";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
  SearchIcon,
  StarIcon,
  HeartIcon,
  ShareIcon,
  TicketIcon,
  SparklesIcon,
  CrownIcon,
  ZapIcon,
  TrendingUpIcon,
  ArrowRightIcon
} from "lucide-react";

export default function EventsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [savedEvents, setSavedEvents] = useState<string[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
    loadSavedEvents();
  }, []);

  const loadEvents = async () => {
    try {
      console.log('🔄 Loading events from database...');
      const allEvents = await eventService.getUpcomingEvents();
      console.log('✅ Events loaded:', allEvents.length);
      console.log('📋 Events data:', allEvents);
      setEvents(allEvents);
    } catch (error) {
      console.error("❌ Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedEvents = () => {
    const saved = localStorage.getItem("savedEvents");
    if (saved) setSavedEvents(JSON.parse(saved));
    
    const registered = localStorage.getItem("registeredEvents");
    if (registered) setRegisteredEvents(JSON.parse(registered));
  };

  const categories = [
    { key: "all", label: "All Events" },
    { key: "conference", label: "Conferences" },
    { key: "workshop", label: "Workshops" },
    { key: "masterclass", label: "Masterclasses" },
    { key: "competition", label: "Competitions" },
    { key: "bootcamp", label: "Bootcamps" },
    { key: "forum", label: "Forums" },
  ];

  const filteredEvents = events
    .filter(event =>
      selectedCategory === "all" || event.category === selectedCategory
    )
    .filter(event =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "price":
          return (a.discountPrice || a.price) - (b.discountPrice || b.price);
        case "popularity":
          return b.registered - a.registered;
        default:
          return 0;
      }
    });

  const toggleSaveEvent = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    const newSaved = savedEvents.includes(eventId)
      ? savedEvents.filter(id => id !== eventId)
      : [...savedEvents, eventId];
    
    setSavedEvents(newSaved);
    localStorage.setItem("savedEvents", JSON.stringify(newSaved));
  };

  const toggleRegisterEvent = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    
    if (!user) {
      alert("Please login to register for events");
      router.push("/login");
      return;
    }

    if (registeredEvents.includes(eventId)) {
      const confirmed = confirm("Are you sure you want to unregister from this event?");
      if (!confirmed) return;
      
      const newRegistered = registeredEvents.filter(id => id !== eventId);
      setRegisteredEvents(newRegistered);
      localStorage.setItem("registeredEvents", JSON.stringify(newRegistered));
      localStorage.removeItem(`ticket_${eventId}`);
      alert("Successfully unregistered from event");
      return;
    }

    setRegistering(eventId);
    try {
      // Find the event details
      const event = events.find(e => e.$id === eventId);
      if (!event) throw new Error("Event not found");

      // Register for event in database
      await eventService.registerForEvent(eventId, user.$id, user.name, user.email);
      
      // Try to send email with e-ticket
      const emailResult = await sendRegistrationEmail(
        user.email,
        user.name,
        {
          title: event.title,
          date: event.date,
          time: event.time,
          venue: event.venue,
          location: event.location,
          image: event.image,
          organizerName: event.organizerName,
          price: event.price,
          discountPrice: event.discountPrice,
        }
      );

      // Store ticket data locally
      const ticketData = {
        ticketId: emailResult.ticketId || `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventId: event.$id,
        eventTitle: event.title,
        userName: user.name,
        userEmail: user.email,
        date: event.date,
        time: event.time,
        venue: event.venue,
        location: event.location,
        registeredAt: new Date().toISOString(),
      };
      
      localStorage.setItem(`ticket_${eventId}`, JSON.stringify(ticketData));
      
      // Update registered events
      const newRegistered = [...registeredEvents, eventId];
      setRegisteredEvents(newRegistered);
      localStorage.setItem("registeredEvents", JSON.stringify(newRegistered));
      
      // Show appropriate message with better formatting
      if (emailResult.success) {
        alert(
          "🎉 Registration Successful!\n\n" +
          "✅ You're registered for the event\n" +
          "📧 E-ticket sent to: " + user.email + "\n" +
          "🎫 Ticket ID: " + emailResult.ticketId + "\n\n" +
          "Please check your email inbox (and spam folder) for your e-ticket."
        );
      } else {
        alert(
          "⚠️ Registration Successful (Email Issue)\n\n" +
          "✅ You're registered for the event\n" +
          "❌ E-ticket email failed to send\n" +
          "🎫 Ticket ID: " + ticketData.ticketId + "\n\n" +
          "Your ticket is saved locally. You can view it in your dashboard.\n\n" +
          "If you need help, contact: hello@mindmesh.club"
        );
      }
      
      // Reload events to update registration count
      await loadEvents();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Registration error:", message);
      alert("❌ " + message);
    } finally {
      setRegistering(null);
    }
  };

  const handleEventClick = (eventId: string) => {
    router.push(`/events/${eventId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateDiscount = (original: number, discount: number) => {
    return Math.round(((original - discount) / original) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <div className="text-center space-y-6 relative py-12">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-6">
          <SparklesIcon className="w-5 h-5 text-purple-500" />
          <span className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Upcoming Events
          </span>
        </div>
        <div className="relative z-10">
          <h1 className={title({ size: "lg" })}>
            Discover{" "}
            <span className={title({ color: "violet", size: "lg" })}>
              Amazing Events
            </span>
          </h1>
          <p className={subtitle({ class: "mt-6 max-w-3xl mx-auto text-xl" })}>
            Join our community events, workshops, and conferences to learn, network, and grow together
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-6">
        <Card className="border-none shadow-lg bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl">
          <CardBody className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full lg:max-w-md">
                <Input
                  placeholder="Search events, topics, or locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  startContent={<SearchIcon className="w-5 h-5 text-default-400" />}
                  classNames={{ input: "text-lg" }}
                  size="lg"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <Select
                  label="Sort by"
                  selectedKeys={[sortBy]}
                  onChange={(e) => setSortBy(e.target.value)}
                  size="sm"
                  className="min-w-[150px]"
                >
                  <SelectItem key="date">Date</SelectItem>
                  <SelectItem key="price">Price</SelectItem>
                  <SelectItem key="popularity">Popularity</SelectItem>
                </Select>

                <Select
                  label="Category"
                  selectedKeys={[selectedCategory]}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  size="sm"
                  className="min-w-[150px]"
                >
                  {categories.map(category => (
                    <SelectItem key={category.key}>{category.label}</SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <Card
              key={event.$id}
              className="border-none hover:shadow-2xl transition-all duration-300 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl group cursor-pointer"
              shadow="lg"
              isPressable
              onPress={() => handleEventClick(event.$id!)}
            >
              <CardBody className="p-0 overflow-hidden">
                <div className="relative">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {event.isFeatured && (
                      <Badge color="warning" variant="solid" className="font-bold">
                        <StarIcon className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                    {event.isPremium && (
                      <Badge color="secondary" variant="solid" className="font-bold">
                        <CrownIcon className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>

                  <Button
                    isIconOnly
                    variant="flat"
                    className="absolute top-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-sm"
                    size="sm"
                    onPress={(e) => toggleSaveEvent(e as any, event.$id!)}
                  >
                    <HeartIcon 
                      className={`w-4 h-4 ${
                        savedEvents.includes(event.$id!) 
                          ? "fill-red-500 text-red-500" 
                          : "text-gray-600"
                      }`} 
                    />
                  </Button>

                  {event.discountPrice && event.discountPrice < event.price && (
                    <div className="absolute bottom-4 left-4">
                      <Badge color="danger" variant="solid">
                        {calculateDiscount(event.price, event.discountPrice)}% OFF
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-primary transition-colors">
                      {event.title}
                    </h3>
                  </div>

                  <p className="text-default-600 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(event.date)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <MapPinIcon className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-default-500">
                      <UsersIcon className="w-4 h-4" />
                      <span>{event.registered} registered</span>
                      {event.capacity && (
                        <span className="text-xs text-default-400">
                          • {event.capacity - event.registered} spots left
                        </span>
                      )}
                    </div>
                  </div>

                  {event.capacity && (
                    <Progress 
                      value={(event.registered / event.capacity) * 100} 
                      size="sm" 
                      color="primary" 
                      className="mt-2"
                    />
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {event.tags.slice(0, 3).map((tag, index) => (
                      <Chip key={index} size="sm" variant="flat" color="primary">
                        {tag}
                      </Chip>
                    ))}
                    {event.tags.length > 3 && (
                      <Chip size="sm" variant="flat">
                        +{event.tags.length - 3}
                      </Chip>
                    )}
                  </div>
                </div>
              </CardBody>

              <CardFooter className="px-6 pb-6 pt-0">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {event.discountPrice && event.discountPrice < event.price ? (
                      <>
                        <span className="text-2xl font-bold text-foreground">
                          ${event.discountPrice}
                        </span>
                        <span className="text-lg text-default-400 line-through">
                          ${event.price}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-foreground">
                        ${event.price}
                      </span>
                    )}
                  </div>

                  <Button
                    color={registeredEvents.includes(event.$id!) ? "default" : "primary"}
                    variant={registeredEvents.includes(event.$id!) ? "flat" : "solid"}
                    size="md"
                    isLoading={registering === event.$id}
                    onPress={(e) => toggleRegisterEvent(e as any, event.$id!)}
                    endContent={
                      !registeredEvents.includes(event.$id!) && <TicketIcon className="w-4 h-4" />
                    }
                  >
                    {registeredEvents.includes(event.$id!) ? "Registered" : "Register"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">No events found</h3>
            <p className="text-default-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
}