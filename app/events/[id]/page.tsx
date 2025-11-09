// app/events/[id]/page.tsx
"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Badge } from "@heroui/badge";
import { Avatar } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import { Divider } from "@heroui/divider";
import { title } from "@/components/primitives";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { eventService, type Event as EventType } from "@/lib/database";
import { getErrorMessage } from "@/lib/errorHandler";
import { sendRegistrationEmail } from "@/lib/emailService";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
  StarIcon,
  HeartIcon,
  ShareIcon,
  TicketIcon,
  CrownIcon,
  ArrowLeftIcon,
  BuildingIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrendingUpIcon,
  MailIcon
} from "lucide-react";

export default function EventDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [ticketId, setTicketId] = useState<string>("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    loadEvent();
    checkSavedStatus();
    checkRegistrationStatus();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const eventData = await eventService.getEventById(eventId);
      setEvent(eventData);
    } catch (error) {
      console.error("Error loading event:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkSavedStatus = () => {
    const saved = localStorage.getItem("savedEvents");
    if (saved) {
      const savedEvents = JSON.parse(saved);
      setIsSaved(savedEvents.includes(eventId));
    }
  };

  const checkRegistrationStatus = () => {
    const registered = localStorage.getItem("registeredEvents");
    if (registered) {
      const registeredEvents = JSON.parse(registered);
      setIsRegistered(registeredEvents.includes(eventId));
      
      // Check if we have ticket info
      const ticketInfo = localStorage.getItem(`ticket_${eventId}`);
      if (ticketInfo) {
        const { ticketId: tid, emailSent: sent } = JSON.parse(ticketInfo);
        setTicketId(tid);
        setEmailSent(sent);
      }
    }
  };

  const toggleSave = () => {
    const saved = localStorage.getItem("savedEvents");
    const savedEvents = saved ? JSON.parse(saved) : [];
    
    if (isSaved) {
      const filtered = savedEvents.filter((id: string) => id !== eventId);
      localStorage.setItem("savedEvents", JSON.stringify(filtered));
      setIsSaved(false);
    } else {
      savedEvents.push(eventId);
      localStorage.setItem("savedEvents", JSON.stringify(savedEvents));
      setIsSaved(true);
    }
  };

  const handleRegister = async () => {
    if (!user) {
      alert("Please login to register for events");
      router.push("/login");
      return;
    }

    if (isRegistered) {
      const confirmed = confirm("Are you sure you want to unregister from this event?");
      if (!confirmed) return;
      
      const registered = localStorage.getItem("registeredEvents");
      const registeredEvents = registered ? JSON.parse(registered) : [];
      const filtered = registeredEvents.filter((id: string) => id !== eventId);
      localStorage.setItem("registeredEvents", JSON.stringify(filtered));
      localStorage.removeItem(`ticket_${eventId}`);
      setIsRegistered(false);
      setEmailSent(false);
      setTicketId("");
      return;
    }

    setRegistering(true);
    try {
      // Register for event in database
      await eventService.registerForEvent(eventId, user.$id, user.name, user.email);
      
      // Send email with e-ticket
      const emailResult = await sendRegistrationEmail(
        user.email,
        user.name,
        {
          title: event!.title,
          date: event!.date,
          time: event!.time,
          venue: event!.venue,
          location: event!.location,
          image: event!.image,
          organizerName: event!.organizerName,
          price: event!.price,
          discountPrice: event!.discountPrice,
        }
      );

      if (emailResult.success) {
        setTicketId(emailResult.ticketId);
        setEmailSent(true);
        
        // Save to localStorage
        const registered = localStorage.getItem("registeredEvents");
        const registeredEvents = registered ? JSON.parse(registered) : [];
        registeredEvents.push(eventId);
        localStorage.setItem("registeredEvents", JSON.stringify(registeredEvents));
        
        // Save ticket info
        localStorage.setItem(`ticket_${eventId}`, JSON.stringify({
          ticketId: emailResult.ticketId,
          emailSent: true
        }));
        
        setIsRegistered(true);
        
        alert(`✅ Registration successful! \n\n🎫 Your ticket ID: ${emailResult.ticketId}\n📧 E-ticket sent to: ${user.email}\n\nCheck your email for your e-ticket with QR code!`);
        await loadEvent();
      } else {
        // Registration succeeded but email failed
        const registered = localStorage.getItem("registeredEvents");
        const registeredEvents = registered ? JSON.parse(registered) : [];
        registeredEvents.push(eventId);
        localStorage.setItem("registeredEvents", JSON.stringify(registeredEvents));
        setIsRegistered(true);
        
        alert("✅ Registration successful!\n\n⚠️ However, we couldn't send your e-ticket email. Please contact support with your registration details.");
        await loadEvent();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Registration error:", message);
      alert(message || "Failed to register for event");
    } finally {
      setRegistering(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event?.title,
        text: event?.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateDiscount = (original: number, discount: number) => {
    return Math.round(((original - discount) / original) * 100);
  };

  const getSpotsLeft = () => {
    if (!event?.capacity) return null;
    return event.capacity - event.registered;
  };

  const getRegistrationPercentage = () => {
    if (!event?.capacity) return 0;
    return (event.registered / event.capacity) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircleIcon className="w-16 h-16 text-danger mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
          <p className="text-default-500 mb-6">The event you're looking for doesn't exist.</p>
          <Button color="primary" onPress={() => router.push("/events")}>
            Browse Events
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Button
          variant="light"
          startContent={<ArrowLeftIcon className="w-4 h-4" />}
          onPress={() => router.back()}
        >
          Back to Events
        </Button>
      </div>

      {/* Hero Image Section */}
      <div className="relative h-[400px] md:h-[500px] w-full overflow-hidden">
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Floating Action Buttons */}
        <div className="absolute top-6 right-6 flex gap-2">
          <Button
            isIconOnly
            variant="flat"
            className="bg-white/90 dark:bg-black/90 backdrop-blur-sm"
            onPress={toggleSave}
          >
            <HeartIcon 
              className={`w-5 h-5 ${
                isSaved ? "fill-red-500 text-red-500" : "text-gray-600"
              }`} 
            />
          </Button>
          <Button
            isIconOnly
            variant="flat"
            className="bg-white/90 dark:bg-black/90 backdrop-blur-sm"
            onPress={handleShare}
          >
            <ShareIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-4">
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
              <Badge color="primary" variant="solid">
                {event.category}
              </Badge>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {event.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                <span className="font-medium">{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                <span className="font-medium">{event.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-5 h-5" />
                <span className="font-medium">{event.location}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Event Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-0">
                <h2 className="text-2xl font-bold">About This Event</h2>
              </CardHeader>
              <CardBody className="pt-4">
                <p className="text-default-600 leading-relaxed text-lg">
                  {event.description}
                </p>
              </CardBody>
            </Card>

            {/* Event Details Grid */}
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-0">
                <h2 className="text-2xl font-bold">Event Details</h2>
              </CardHeader>
              <CardBody className="pt-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <CalendarIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Date</p>
                      <p className="font-semibold">{formatDate(event.date)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <ClockIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Time</p>
                      <p className="font-semibold">{event.time}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <BuildingIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Venue</p>
                      <p className="font-semibold">{event.venue}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <MapPinIcon className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-default-500 mb-1">Location</p>
                      <p className="font-semibold">{event.location}</p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Tags */}
            {event.tags.length > 0 && (
              <Card className="border-none shadow-lg">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-purple-600" />
                    <h2 className="text-2xl font-bold">Topics</h2>
                  </div>
                </CardHeader>
                <CardBody className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag, index) => (
                      <Chip 
                        key={index} 
                        size="lg" 
                        variant="flat" 
                        color="secondary"
                        className="font-medium"
                      >
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Organizer */}
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-0">
                <h2 className="text-2xl font-bold">Organized By</h2>
              </CardHeader>
              <CardBody className="pt-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={event.organizerAvatar}
                    name={event.organizerName}
                    size="lg"
                    className="w-16 h-16"
                  />
                  <div>
                    <p className="font-bold text-lg">{event.organizerName}</p>
                    <p className="text-default-500">Event Organizer</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Column - Registration Card */}
          <div className="lg:col-span-1">
            <Card className="border-none shadow-2xl sticky top-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardBody className="p-6 space-y-6">
                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-3 mb-2">
                    {event.discountPrice && event.discountPrice < event.price ? (
                      <>
                        <span className="text-4xl font-bold text-foreground">
                          ${event.discountPrice}
                        </span>
                        <span className="text-2xl text-default-400 line-through">
                          ${event.price}
                        </span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold text-foreground">
                        ${event.price}
                      </span>
                    )}
                  </div>
                  {event.discountPrice && event.discountPrice < event.price && (
                    <Badge color="success" variant="flat" size="lg">
                      Save ${event.price - event.discountPrice} ({calculateDiscount(event.price, event.discountPrice)}% OFF)
                    </Badge>
                  )}
                </div>

                <Divider />

                {/* Registration Stats */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="w-5 h-5 text-default-500" />
                      <span className="text-default-600">Registered</span>
                    </div>
                    <span className="font-bold text-lg">
                      {event.registered}{event.capacity && `/${event.capacity}`}
                    </span>
                  </div>

                  {event.capacity && (
                    <>
                      <Progress 
                        value={getRegistrationPercentage()} 
                        size="md" 
                        color={
                          getRegistrationPercentage() > 90 ? "danger" : 
                          getRegistrationPercentage() > 70 ? "warning" : "primary"
                        }
                        className="mt-2"
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-default-500">
                          {getSpotsLeft()} spots remaining
                        </span>
                        <span className={`font-semibold ${
                          getRegistrationPercentage() > 90 ? "text-danger" : 
                          getRegistrationPercentage() > 70 ? "text-warning" : "text-success"
                        }`}>
                          {Math.round(getRegistrationPercentage())}% filled
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <Divider />

                {/* Registration Button */}
                <div className="space-y-3">
                  <Button
                    color={isRegistered ? "default" : "primary"}
                    variant={isRegistered ? "flat" : "solid"}
                    size="lg"
                    className="w-full font-bold text-lg"
                    isLoading={registering}
                    onPress={handleRegister}
                    startContent={
                      isRegistered ? 
                      <CheckCircleIcon className="w-5 h-5" /> : 
                      <TicketIcon className="w-5 h-5" />
                    }
                  >
                    {registering ? "Registering..." : isRegistered ? "You're Registered!" : "Register Now"}
                  </Button>

                  {isRegistered && (
                    <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-200 dark:border-success-800">
                      <div className="flex items-start gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-success text-sm">
                            Registration Confirmed!
                          </p>
                          {emailSent && ticketId && (
                            <>
                              <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                                <MailIcon className="w-3 h-3 inline mr-1" />
                                E-ticket sent to your email
                              </p>
                              <p className="text-xs text-success-700 dark:text-success-300 mt-1 font-mono bg-success-100 dark:bg-success-900/30 p-2 rounded">
                                🎫 {ticketId}
                              </p>
                            </>
                          )}
                          {isRegistered && !emailSent && (
                            <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                              Check your email for event details
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isRegistered && getSpotsLeft() !== null && getSpotsLeft()! < 10 && (
                    <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-800">
                      <div className="flex items-start gap-2">
                        <TrendingUpIcon className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-warning-700 dark:text-warning-300">
                          <span className="font-semibold">Filling fast!</span> Only {getSpotsLeft()} spots left
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Divider />

                {/* Features */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                    <span>Instant confirmation</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                    <span>E-ticket included</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                    <span>Certificate of attendance</span>
                  </div>
                  {event.isPremium && (
                    <div className="flex items-center gap-3 text-sm">
                      <CrownIcon className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold text-purple-600">Premium perks included</span>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}