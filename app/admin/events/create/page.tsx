"use client";
import type { EventType } from "@/lib/types/index";

import {
  useEffect,
  useState,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  DollarSignIcon,
  StarIcon,
  CrownIcon,
  EyeIcon,
  FileTextIcon,
  ClockIcon,
  XIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
} from "@heroui/react";

import { readApiError } from "@/lib/errorHandler";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { eventTypeService } from "@/lib/eventTypes";
import { logError } from "@/lib/logger";

const STEPS = [
  { id: 1, label: "Event Type", icon: FileTextIcon },
  { id: 2, label: "Details", icon: CalendarIcon },
  { id: 3, label: "Review", icon: EyeIcon },
];

interface EventFormData {
  title: string;
  slug: string;
  description: string;
  image: string;
  eventTypeId: string;
  category: string;
  status: "draft" | "review";
  audience: "public" | "member_only" | "exclusive";
  date: string;
  time: string;
  endDate: string;
  venue: string;
  location: string;
  capacity: number;
  registered: number;
  price: number;
  discountPrice: number | null;
  organizerName: string;
  organizerAvatar: string;
  tags: string[];
  isFeatured: boolean;
  isPremium: boolean;
  ownerId: string;
}

export default function AdminCreateEventPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Proposing needs events.create; publishing directly needs events.manage.
  // Checked up front so a grant-less account learns it before filling five
  // steps that can only end in a 403.
  const canPropose =
    hasCapability("events.create") || hasCapability("events.manage");
  const showGate = !authLoading && !!user && !canPropose;

  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [tagInput, setTagInput] = useState("");

  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    slug: "",
    description: "",
    image: "",
    eventTypeId: "",
    category: "conference",
    status: "draft",
    audience: "public",
    date: "",
    time: "",
    endDate: "",
    venue: "",
    location: "",
    capacity: 50,
    registered: 0,
    price: 0,
    discountPrice: null,
    organizerName: "",
    organizerAvatar: "",
    tags: [],
    isFeatured: false,
    isPremium: false,
    ownerId: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    loadEventTypes();
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        ownerId: user.$id || "",
        organizerName: user.name || "",
      }));
    }
  }, [user]);

  const loadEventTypes = async () => {
    try {
      const types = await eventTypeService.getAll();

      setEventTypes(types);
    } catch (error) {
      logError("Error loading event types:", error);
      toast.error("Failed to load event types");
    } finally {
      setLoadingTypes(false);
    }
  };

  const updateForm = useCallback((field: keyof EventFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSelectType = (type: EventType) => {
    setSelectedType(type);
    setFormData((prev) => ({
      ...prev,
      eventTypeId: type.$id!,
    }));
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTitleChange = (value: string) => {
    // Functional update: the slug check must read the latest title/slug,
    // not the render-scope snapshot (rapid typing desynced the old version).
    setFormData((prev) => {
      if (!prev.slug || prev.slug === generateSlug(prev.title)) {
        return { ...prev, title: value, slug: generateSlug(value) };
      }

      return { ...prev, title: value };
    });
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();

    if (trimmed && !formData.tags.includes(trimmed)) {
      updateForm("tags", [...formData.tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateForm(
      "tags",
      formData.tags.filter((t) => t !== tag),
    );
  };

  // Step 2 mirrors the server's required set (title, description, date,
  // time, venue, location) so the submit cannot 400 on a field the wizard
  // never asked for.
  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return !!selectedType;
      case 2:
        return !!(
          formData.title.trim() &&
          formData.description.trim() &&
          formData.date &&
          formData.time &&
          formData.venue.trim() &&
          formData.location.trim()
        );
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(3, s + 1));
    } else if (step === 2) {
      toast.error(
        "Title, description, date, time, venue, and location are required",
      );
    }
  };

  const prevStep = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      toast.error("Please select an event type");

      return;
    }
    if (!formData.title.trim()) {
      toast.error("Event title is required");
      setStep(2);

      return;
    }
    if (!formData.description.trim()) {
      toast.error("Event description is required");
      setStep(2);

      return;
    }
    if (!Number.isInteger(formData.price) || formData.price < 0) {
      toast.error("Price must be a whole number, 0 or more");
      setStep(2);

      return;
    }
    if (
      formData.discountPrice != null &&
      (!Number.isInteger(formData.discountPrice) || formData.discountPrice < 0)
    ) {
      toast.error("Discount price must be a whole number, 0 or more");
      setStep(2);

      return;
    }
    if (formData.endDate && formData.date && formData.endDate < formData.date) {
      toast.error("End date cannot be before the start date");
      setStep(2);

      return;
    }
    if (
      formData.discountPrice != null &&
      formData.discountPrice >= formData.price
    ) {
      toast.error("Discount price must be less than the regular price");
      setStep(2);

      return;
    }

    setSubmitting(true);
    try {
      // The self-service endpoint requires slug + eventTypeId (the admin one
      // derives/defaults them), so always send both.
      const slug =
        formData.slug.trim() ||
        formData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 255);
      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        image: formData.image,
        date: formData.date,
        time: formData.time,
        endDate: formData.endDate || undefined,
        venue: formData.venue.trim(),
        location: formData.location.trim(),
        category: formData.category,
        price: formData.price,
        discountPrice: formData.discountPrice,
        capacity: formData.capacity,
        registered: 0,
        organizerName: formData.organizerName,
        organizerAvatar: formData.organizerAvatar,
        tags: formData.tags,
        isFeatured: formData.isFeatured,
        isPremium: formData.isPremium,
        slug,
        eventTypeId: formData.eventTypeId,
        audience: formData.audience,
        status: formData.status,
      };

      // Endpoint follows entitlement: full event managers use the admin
      // endpoint; leads holding only events.create use the self-service one
      // (which forces draft/review and derives ownership from the session).
      // Without this, the lead-tier create capability was API-only with no UI.
      const managesEvents = hasCapability("events.manage");
      const response = await fetch(
        managesEvents ? "/api/admin/events" : "/api/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(eventData),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to create event"));

      toast.success(
        managesEvents
          ? "Event created successfully!"
          : "Event proposal submitted for review!",
      );
      router.push(managesEvents ? "/admin/events" : "/events");
    } catch (error) {
      // Surface the server's reason (validation, capability, conflict) —
      // the old generic toast hid exactly the answer the admin needed.
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to create event";

      logError("Error creating event:", message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingTypes) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Loading event setup"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-default-500">Loading event setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Create Event
        </h1>
        <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
          Set up a new event — managers publish directly, everyone else submits
          a proposal for review.
        </p>
      </div>

      {showGate && (
        <Card>
          {" "}
          <CardContent className="p-8 text-center space-y-3">
            <h2 className="text-lg font-semibold">Proposing is gated</h2>
            <p className="text-sm text-default-500 max-w-md mx-auto">
              Proposing events needs the event coordinator grant (or
              events.manage). Ask a lead to assign it — filling the form without
              it only ends in a refusal at submit.
            </p>
            <Button variant="secondary" onPress={() => router.back()}>
              Go back
            </Button>
          </CardContent>
        </Card>
      )}

      {!showGate && (
        <>
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;

              return (
                <div key={s.id} className="flex items-center">
                  <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-primary text-white"
                        : isCompleted
                          ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                          : "bg-default-100 text-default-400"
                    }`}
                    onClick={() => {
                      if (s.id < step) setStep(s.id);
                    }}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <ChevronRightIcon className="w-4 h-4 text-default-300 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <Card>
            <CardContent className="p-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-1">
                      Select Event Type
                    </h2>
                    <p className="text-sm text-default-500">
                      Choose the type of event you want to create.
                    </p>
                  </div>
                  {eventTypes.length === 0 ? (
                    <div className="text-center py-12 text-default-400">
                      <FileTextIcon className="w-12 h-12 mx-auto mb-3" />
                      <p>No event types available. Create one first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {eventTypes.map((type) => (
                        <button
                          key={type.$id}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            selectedType?.$id === type.$id
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-default-200 hover:border-primary/50 hover:bg-default-50"
                          }`}
                          type="button"
                          onClick={() => handleSelectType(type)}
                        >
                          <div className="flex items-start gap-3">
                            {type.icon && (
                              <span className="text-2xl">{type.icon}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">
                                {type.displayName}
                              </p>
                              {type.description && (
                                <p className="text-xs text-default-500 mt-1 line-clamp-2">
                                  {type.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Chip
                                  className="text-xs tabular-nums"
                                  size="sm"
                                  variant="primary"
                                >
                                  {type.fields?.length || 0} fields
                                </Chip>
                              </div>
                            </div>
                            {selectedType?.$id === type.$id && (
                              <CheckIcon className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-1">
                      Base Event Details
                    </h2>
                    <p className="text-sm text-default-500">
                      Fill in the core information for your event.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">
                        Event Image URL
                      </label>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={formData.image}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateForm("image", e.target.value)
                        }
                      />
                      {formData.image?.startsWith("http") && (
                        <div className="relative group w-full">
                          <Image
                            unoptimized
                            alt="Event image preview"
                            className="w-full h-40 object-cover rounded-xl border-2 border-border"
                            height={160}
                            src={formData.image}
                            width={800}
                            onError={(e) => {
                              // Never swap in an external placeholder: it would be
                              // submitted as the event image. Hide instead.
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">
                        Title <span className="text-danger">*</span>
                      </label>
                      <Input
                        placeholder="Event title"
                        value={formData.title}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          handleTitleChange(e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Slug</label>
                      <Input
                        placeholder="event-slug"
                        value={formData.slug}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateForm("slug", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="event-description">
                        Description <span className="text-danger">*</span>
                      </Label>
                      <TextArea
                        fullWidth
                        id="event-description"
                        placeholder="Describe your event"
                        rows={4}
                        value={formData.description}
                        onChange={(e) =>
                          updateForm("description", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Select
                        fullWidth
                        value={formData.category}
                        onChange={(value) =>
                          updateForm("category", String(value ?? "conference"))
                        }
                      >
                        <Label>Category</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {[
                              "conference",
                              "workshop",
                              "masterclass",
                              "competition",
                              "bootcamp",
                              "forum",
                              "hackathon",
                              "meetup",
                              "seminar",
                              "other",
                            ].map((category) => (
                              <ListBox.Item
                                key={category}
                                id={category}
                                textValue={
                                  category.charAt(0).toUpperCase() +
                                  category.slice(1)
                                }
                              >
                                {category.charAt(0).toUpperCase() +
                                  category.slice(1)}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Date <span className="text-danger">*</span>
                        </label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateForm("date", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Time <span className="text-danger">*</span>
                        </label>
                        <Input
                          placeholder="e.g., 09:00 AM - 06:00 PM"
                          value={formData.time}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateForm("time", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">End Date</label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateForm("endDate", e.target.value)
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Venue <span className="text-danger">*</span>
                        </label>
                        <Input
                          placeholder="e.g., Grand Convention Center"
                          value={formData.venue}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateForm("venue", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Location <span className="text-danger">*</span>
                        </label>
                        <Input
                          placeholder="e.g., New York, NY"
                          value={formData.location}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateForm("location", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Capacity
                        </label>
                        <Input
                          placeholder="50"
                          type="number"
                          value={formData.capacity?.toString()}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const parsed = parseInt(e.target.value, 10);

                            updateForm(
                              "capacity",
                              Number.isFinite(parsed)
                                ? Math.max(1, parsed)
                                : 50,
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Price ($)
                        </label>
                        <Input
                          placeholder="0"
                          type="number"
                          value={formData.price?.toString()}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const parsed = parseInt(e.target.value, 10);

                            updateForm(
                              "price",
                              Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                            );
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold">
                          Discount Price ($)
                        </label>
                        <Input
                          placeholder="Optional"
                          type="number"
                          value={formData.discountPrice?.toString() || ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            if (!e.target.value) {
                              updateForm("discountPrice", null);

                              return;
                            }
                            const parsed = parseInt(e.target.value, 10);

                            updateForm(
                              "discountPrice",
                              Number.isFinite(parsed) && parsed >= 0
                                ? parsed
                                : null,
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Select
                        fullWidth
                        value={formData.audience}
                        onChange={(value) =>
                          updateForm(
                            "audience",
                            String(value ?? "public") as
                              "public" | "member_only" | "exclusive",
                          )
                        }
                      >
                        <Label>
                          Audience <span className="text-danger">*</span>
                        </Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="public" textValue="Public">
                              Public
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item
                              id="member_only"
                              textValue="Members Only"
                            >
                              Members Only
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="exclusive" textValue="Exclusive">
                              Exclusive
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted rounded-xl">
                      <Checkbox
                        aria-label="Featured"
                        isSelected={formData.isFeatured}
                        onChange={(selected: boolean) =>
                          updateForm("isFeatured", selected)
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <div className="flex items-center gap-2">
                            <StarIcon className="w-4 h-4 text-warning" />
                            <span className="font-semibold text-sm">
                              Featured
                            </span>
                          </div>
                        </Checkbox.Content>
                      </Checkbox>
                      <Checkbox
                        aria-label="Premium"
                        isSelected={formData.isPremium}
                        onChange={(selected: boolean) =>
                          updateForm("isPremium", selected)
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <div className="flex items-center gap-2">
                            <CrownIcon className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-sm">
                              Premium
                            </span>
                          </div>
                        </Checkbox.Content>
                      </Checkbox>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">
                        Organizer Name
                      </label>
                      <Input
                        placeholder="Organizer name"
                        value={formData.organizerName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateForm("organizerName", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Tags</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a tag"
                          value={tagInput}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setTagInput(e.target.value)
                          }
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") {
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
                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {formData.tags.map((tag) => (
                            <button
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                            >
                              {tag}
                              <XIcon className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-1">Review & Submit</h2>
                    <p className="text-sm text-default-500">
                      Review all details before creating the event.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {formData.image && (
                      <Image
                        unoptimized
                        alt="Event preview"
                        className="w-full h-48 object-cover rounded-xl"
                        height={192}
                        src={formData.image}
                        width={800}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}

                    <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        {selectedType?.icon && (
                          <span className="text-lg">{selectedType.icon}</span>
                        )}
                        <Chip color="success" size="sm" variant="primary">
                          {selectedType?.displayName || "No Type"}
                        </Chip>
                        {formData.isFeatured && (
                          <Chip color="warning" size="sm" variant="primary">
                            <StarIcon className="w-3 h-3 mr-1" />
                            Featured
                          </Chip>
                        )}
                        {formData.isPremium && (
                          <Chip color="danger" size="sm" variant="primary">
                            <CrownIcon className="w-3 h-3 mr-1" />
                            Premium
                          </Chip>
                        )}
                      </div>

                      <h3 className="text-xl font-bold">
                        {formData.title || "Untitled Event"}
                      </h3>
                      {formData.description && (
                        <p className="text-sm text-default-600 line-clamp-3">
                          {formData.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-primary" />
                          <span>{formData.date || "TBD"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4 text-primary" />
                          <span>{formData.time || "TBD"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="w-4 h-4 text-primary" />
                          <span className="truncate">
                            {formData.venue || "TBD"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UsersIcon className="w-4 h-4 text-primary" />
                          <span className="tabular-nums">
                            {formData.capacity} spots
                          </span>
                        </div>
                      </div>

                      {formData.price > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSignIcon className="w-4 h-4 text-success" />
                          <span className="font-semibold tabular-nums">
                            ${formData.price}
                          </span>
                          {formData.discountPrice &&
                            formData.discountPrice < formData.price && (
                              <span className="text-success line-through text-xs tabular-nums">
                                ${formData.discountPrice}
                              </span>
                            )}
                        </div>
                      )}

                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {formData.tags.map((tag) => (
                            <Chip key={tag} size="sm" variant="primary">
                              {tag}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-6">
            <Button isDisabled={step === 1} variant="ghost" onPress={prevStep}>
              <ChevronLeftIcon className="w-4 h-4 mr-1" />
              Previous
            </Button>

            {step < 3 ? (
              <Button
                className="bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
                onPress={nextStep}
              >
                Next
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                className="bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
                isPending={submitting}
                onPress={handleSubmit}
              >
                <CheckIcon className="w-4 h-4 mr-1" />
                Create Event
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
