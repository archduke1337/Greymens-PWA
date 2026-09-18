"use client";
import type {
  EventType,
  RegistrationConfig,
  TicketConfig,
  WorkflowConfig,
} from "@/lib/types/index";

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
  CogIcon,
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
import DynamicEventFields from "@/components/events/DynamicEventFields";
import { logError } from "@/lib/logger";

const STEPS = [
  { id: 1, label: "Event Type", icon: FileTextIcon },
  { id: 2, label: "Base Details", icon: CalendarIcon },
  { id: 3, label: "Type Fields", icon: CogIcon },
  { id: 4, label: "Registration", icon: UsersIcon },
  { id: 5, label: "Review", icon: EyeIcon },
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
  registrationConfig: RegistrationConfig;
  ticketConfig: TicketConfig;
  workflowConfig: WorkflowConfig;
}

const defaultRegistrationConfig: RegistrationConfig = {
  defaultAudience: "public",
  allowGuestRegistration: false,
  requiresApproval: false,
  maxTeamSize: 1,
  waitlistEnabled: false,
  cancellationAllowed: true,
};

const defaultTicketConfig: TicketConfig = {
  ticketType: "standard",
  maxEntries: 1,
  qrEnabled: true,
  transferAllowed: false,
  verificationMethods: ["qr_scan"],
};

const defaultWorkflowConfig: WorkflowConfig = {
  draftPermission: ["admin"],
  approvalRequired: false,
  approverRoles: ["admin"],
  publishAfterApproval: true,
  autoActivateAtEventTime: true,
};

export default function AdminCreateEventPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    registrationConfig: { ...defaultRegistrationConfig },
    ticketConfig: { ...defaultTicketConfig },
    workflowConfig: { ...defaultWorkflowConfig },
  });

  const [typeFieldValues, setTypeFieldValues] = useState<Record<string, any>>(
    {},
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      registrationConfig: {
        ...defaultRegistrationConfig,
        ...type.registrationConfig,
      },
      ticketConfig: { ...defaultTicketConfig, ...type.ticketConfig },
      workflowConfig: { ...defaultWorkflowConfig, ...type.workflowConfig },
    }));
    setTypeFieldValues({});
    setFieldErrors({});
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

  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return !!selectedType;
      case 2:
        return !!(
          formData.title &&
          formData.date &&
          formData.time &&
          formData.venue &&
          formData.location
        );
      case 3: {
        if (!selectedType?.fields || selectedType.fields.length === 0)
          return true;
        const errors: Record<string, string> = {};
        let valid = true;

        for (const field of selectedType.fields) {
          if (field.required) {
            const val = typeFieldValues[field.name];

            if (val === undefined || val === null || val === "") {
              errors[field.name] = `${field.label} is required`;
              valid = false;
            }
          }
        }
        setFieldErrors(errors);

        return valid;
      }
      case 4:
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setFieldErrors({});
      setStep((s) => Math.min(5, s + 1));
    }
  };

  const prevStep = () => {
    setFieldErrors({});
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
        title: formData.title,
        description: formData.description,
        image: formData.image,
        date: formData.date,
        time: formData.time,
        venue: formData.venue,
        location: formData.location,
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
      logError("Error creating event:", error);
      toast.error("Failed to create event");
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
          Set up a new event with type-specific configuration
        </p>
      </div>

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
                <h2 className="text-lg font-bold mb-1">Select Event Type</h2>
                <p className="text-sm text-default-500">
                  Choose the type of event you want to create. This determines
                  available fields and registration settings.
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
                            {type.registrationConfig?.requiresApproval && (
                              <Chip
                                className="text-xs"
                                size="sm"
                                variant="primary"
                              >
                                Requires Approval
                              </Chip>
                            )}
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
                <h2 className="text-lg font-bold mb-1">Base Event Details</h2>
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
                  <Label htmlFor="event-description">Description</Label>
                  <TextArea
                    fullWidth
                    id="event-description"
                    placeholder="Describe your event"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => updateForm("description", e.target.value)}
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
                    <label className="text-sm font-semibold">Capacity</label>
                    <Input
                      placeholder="50"
                      type="number"
                      value={formData.capacity?.toString()}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const parsed = parseInt(e.target.value, 10);

                        updateForm(
                          "capacity",
                          Number.isFinite(parsed) ? Math.max(1, parsed) : 50,
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Price ($)</label>
                    <Input
                      placeholder="0"
                      type="number"
                      value={formData.price?.toString()}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const parsed = parseFloat(e.target.value);

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
                        const parsed = parseFloat(e.target.value);

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
                        <ListBox.Item id="member_only" textValue="Members Only">
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
                        <span className="font-semibold text-sm">Featured</span>
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
                        <span className="font-semibold text-sm">Premium</span>
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
                <h2 className="text-lg font-bold mb-1">Type-Specific Fields</h2>
                <p className="text-sm text-default-500">
                  {selectedType
                    ? `Fields for ${selectedType.displayName}`
                    : "No event type selected"}
                </p>
              </div>
              {selectedType && (
                <DynamicEventFields
                  errors={fieldErrors}
                  fields={selectedType.fields || []}
                  values={typeFieldValues}
                  onChange={(fieldName, value) =>
                    setTypeFieldValues((prev) => ({
                      ...prev,
                      [fieldName]: value,
                    }))
                  }
                />
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-1">Registration Config</h2>
                <p className="text-sm text-default-500">
                  Configure registration rules for your event.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Select
                    fullWidth
                    value={formData.registrationConfig.defaultAudience}
                    onChange={(value) =>
                      updateForm("registrationConfig", {
                        ...formData.registrationConfig,
                        defaultAudience: String(
                          value ?? "public",
                        ) as RegistrationConfig["defaultAudience"],
                      })
                    }
                  >
                    <Label>Default Audience</Label>
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
                        <ListBox.Item id="member_only" textValue="Members Only">
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

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Max Team Size</label>
                  <Input
                    placeholder="1"
                    type="number"
                    value={
                      formData.registrationConfig.maxTeamSize?.toString() || "1"
                    }
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const parsed = parseInt(e.target.value, 10);

                      updateForm("registrationConfig", {
                        ...formData.registrationConfig,
                        maxTeamSize: Number.isFinite(parsed)
                          ? Math.max(1, parsed)
                          : 1,
                      });
                    }}
                  />
                  <p className="text-xs text-default-400">
                    Set to 1 for individual events
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">
                        Allow Guest Registration
                      </p>
                      <p className="text-xs text-default-500">
                        Allow non-members to register
                      </p>
                    </div>
                    <Checkbox
                      aria-label="Allow Guest Registration"
                      isSelected={
                        formData.registrationConfig.allowGuestRegistration
                      }
                      onChange={(selected: boolean) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          allowGuestRegistration: selected,
                        })
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Requires Approval</p>
                      <p className="text-xs text-default-500">
                        Registrations need admin approval
                      </p>
                    </div>
                    <Checkbox
                      aria-label="Requires Approval"
                      isSelected={formData.registrationConfig.requiresApproval}
                      onChange={(selected: boolean) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          requiresApproval: selected,
                        })
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Enable Waitlist</p>
                      <p className="text-xs text-default-500">
                        Waitlist when event is full
                      </p>
                    </div>
                    <Checkbox
                      aria-label="Enable Waitlist"
                      isSelected={formData.registrationConfig.waitlistEnabled}
                      onChange={(selected: boolean) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          waitlistEnabled: selected,
                        })
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">
                        Allow Cancellation
                      </p>
                      <p className="text-xs text-default-500">
                        Allow users to cancel registration
                      </p>
                    </div>
                    <Checkbox
                      aria-label="Allow Cancellation"
                      isSelected={
                        formData.registrationConfig.cancellationAllowed
                      }
                      onChange={(selected: boolean) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          cancellationAllowed: selected,
                        })
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">
                        Enable Team Formation
                      </p>
                      <p className="text-xs text-default-500">
                        Allow participants to form teams
                      </p>
                    </div>
                    <Checkbox
                      aria-label="Enable Team Formation"
                      isSelected={
                        formData.registrationConfig.teamFormationEnabled ||
                        false
                      }
                      onChange={(selected: boolean) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          teamFormationEnabled: selected,
                        })
                      }
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-bold mb-3">Ticket Config</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Select
                        fullWidth
                        value={formData.ticketConfig.ticketType}
                        onChange={(value) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            ticketType: String(
                              value ?? "standard",
                            ) as TicketConfig["ticketType"],
                          })
                        }
                      >
                        <Label>Ticket Type</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="standard" textValue="Standard">
                              Standard
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="team" textValue="Team">
                              Team
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="exam_seat" textValue="Exam Seat">
                              Exam Seat
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">
                        Max Entries
                      </label>
                      <Input
                        placeholder="1"
                        type="number"
                        value={
                          formData.ticketConfig.maxEntries?.toString() || "1"
                        }
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const parsed = parseInt(e.target.value, 10);

                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            maxEntries: Number.isFinite(parsed)
                              ? Math.max(1, parsed)
                              : 1,
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">QR Enabled</p>
                        <p className="text-xs text-default-500">
                          Generate QR codes for tickets
                        </p>
                      </div>
                      <Checkbox
                        aria-label="QR Enabled"
                        isSelected={formData.ticketConfig.qrEnabled}
                        onChange={(selected: boolean) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            qrEnabled: selected,
                          })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">
                          Transfer Allowed
                        </p>
                        <p className="text-xs text-default-500">
                          Allow ticket transfers between users
                        </p>
                      </div>
                      <Checkbox
                        aria-label="Transfer Allowed"
                        isSelected={formData.ticketConfig.transferAllowed}
                        onChange={(selected: boolean) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            transferAllowed: selected,
                          })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-bold mb-3">Workflow Config</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">
                          Approval Required
                        </p>
                        <p className="text-xs text-default-500">
                          Events need admin approval before publishing
                        </p>
                      </div>
                      <Checkbox
                        aria-label="Approval Required"
                        isSelected={formData.workflowConfig.approvalRequired}
                        onChange={(selected: boolean) =>
                          updateForm("workflowConfig", {
                            ...formData.workflowConfig,
                            approvalRequired: selected,
                          })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">
                          Auto Activate at Event Time
                        </p>
                        <p className="text-xs text-default-500">
                          Automatically activate event when date/time arrives
                        </p>
                      </div>
                      <Checkbox
                        aria-label="Auto Activate at Event Time"
                        isSelected={
                          formData.workflowConfig.autoActivateAtEventTime
                        }
                        onChange={(selected: boolean) =>
                          updateForm("workflowConfig", {
                            ...formData.workflowConfig,
                            autoActivateAtEventTime: selected,
                          })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">
                          Publish After Approval
                        </p>
                        <p className="text-xs text-default-500">
                          Auto-publish once approved
                        </p>
                      </div>
                      <Checkbox
                        aria-label="Publish After Approval"
                        isSelected={
                          formData.workflowConfig.publishAfterApproval
                        }
                        onChange={(selected: boolean) =>
                          updateForm("workflowConfig", {
                            ...formData.workflowConfig,
                            publishAfterApproval: selected,
                          })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
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

                {Object.keys(typeFieldValues).length > 0 && (
                  <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                    <h4 className="font-semibold text-sm mb-2">
                      Type-Specific Data
                    </h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(typeFieldValues).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-default-500 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="font-medium">
                            {typeof val === "object"
                              ? JSON.stringify(val)
                              : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                  <h4 className="font-semibold text-sm mb-2">
                    Registration Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-default-500">Audience</span>
                      <span>{formData.registrationConfig.defaultAudience}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Team Size</span>
                      <span className="tabular-nums">
                        {formData.registrationConfig.maxTeamSize}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Guests</span>
                      <span>
                        {formData.registrationConfig.allowGuestRegistration
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Approval</span>
                      <span>
                        {formData.registrationConfig.requiresApproval
                          ? "Required"
                          : "None"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Waitlist</span>
                      <span>
                        {formData.registrationConfig.waitlistEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Cancellation</span>
                      <span>
                        {formData.registrationConfig.cancellationAllowed
                          ? "Allowed"
                          : "Not Allowed"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                  <h4 className="font-semibold text-sm mb-2">
                    Ticket Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-default-500">Type</span>
                      <span>{formData.ticketConfig.ticketType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Max Entries</span>
                      <span className="tabular-nums">
                        {formData.ticketConfig.maxEntries}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">QR Codes</span>
                      <span>
                        {formData.ticketConfig.qrEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Transfer</span>
                      <span>
                        {formData.ticketConfig.transferAllowed
                          ? "Allowed"
                          : "Not Allowed"}
                      </span>
                    </div>
                  </div>
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

        {step < 5 ? (
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
    </div>
  );
}
