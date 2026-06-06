"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { eventTypeService } from "@/lib/eventTypes";
import { eventService } from "@/lib/database";
import { toast } from "sonner";
import DynamicEventFields from "@/components/events/DynamicEventFields";
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
  Chip,
  Input,
} from "@heroui/react";
import type { EventType, RegistrationConfig, TicketConfig, WorkflowConfig } from "@/lib/types/index";

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

  const [typeFieldValues, setTypeFieldValues] = useState<Record<string, any>>({});
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
      console.error("Error loading event types:", error);
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
      registrationConfig: { ...defaultRegistrationConfig, ...type.registrationConfig },
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
    updateForm("title", value);
    if (!formData.slug || formData.slug === generateSlug(formData.title)) {
      updateForm("slug", generateSlug(value));
    }
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
      formData.tags.filter((t) => t !== tag)
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
        if (!selectedType?.fields || selectedType.fields.length === 0) return true;
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

    setSubmitting(true);
    try {
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
      };

      await eventService.createEvent(
        eventData as Omit<import("@/lib/database").Event, "$id" | "$createdAt" | "$updatedAt">
      );

      toast.success("Event created successfully!");
      router.push("/admin/events");
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingTypes) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
                onClick={() => {
                  if (s.id < step) setStep(s.id);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-white"
                    : isCompleted
                    ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                    : "bg-default-100 text-default-400"
                }`}
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

      <Card className="border-none shadow-lg">
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-1">Select Event Type</h2>
                <p className="text-sm text-default-500">
                  Choose the type of event you want to create. This determines available fields and registration settings.
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
                      type="button"
                      onClick={() => handleSelectType(type)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedType?.$id === type.$id
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-default-200 hover:border-primary/50 hover:bg-default-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {type.icon && (
                          <span className="text-2xl">{type.icon}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{type.displayName}</p>
                          {type.description && (
                            <p className="text-xs text-default-500 mt-1 line-clamp-2">
                              {type.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Chip size="sm" variant="primary" className="text-xs">
                              {type.fields?.length || 0} fields
                            </Chip>
                            {type.registrationConfig?.requiresApproval && (
                              <Chip size="sm" variant="primary" className="text-xs">
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
                  <label className="text-sm font-semibold">Event Image URL</label>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={formData.image}
                    onChange={(e: any) => updateForm("image", e.target.value)}
                  />
                  {formData.image?.startsWith("http") && (
                    <div className="relative group w-full">
                      <img
                        src={formData.image}
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-xl border-2 border-purple-200 dark:border-purple-800"
                        onError={(e: any) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/400x200?text=Invalid+Image+URL";
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Event title"
                    value={formData.title}
                    onChange={(e: any) => handleTitleChange(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Slug</label>
                  <Input
                    placeholder="event-slug"
                    value={formData.slug}
                    onChange={(e: any) => updateForm("slug", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Description</label>
                  <textarea
                    placeholder="Describe your event"
                    value={formData.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-y"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="conference">Conference</option>
                    <option value="workshop">Workshop</option>
                    <option value="masterclass">Masterclass</option>
                    <option value="competition">Competition</option>
                    <option value="bootcamp">Bootcamp</option>
                    <option value="forum">Forum</option>
                    <option value="hackathon">Hackathon</option>
                    <option value="meetup">Meetup</option>
                    <option value="seminar">Seminar</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e: any) => updateForm("date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., 09:00 AM - 06:00 PM"
                      value={formData.time}
                      onChange={(e: any) => updateForm("time", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">End Date</label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e: any) => updateForm("endDate", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">
                      Venue <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., Grand Convention Center"
                      value={formData.venue}
                      onChange={(e: any) => updateForm("venue", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g., New York, NY"
                      value={formData.location}
                      onChange={(e: any) => updateForm("location", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Capacity</label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={formData.capacity?.toString()}
                      onChange={(e: any) =>
                        updateForm("capacity", parseInt(e.target.value) || 50)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Price ($)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.price?.toString()}
                      onChange={(e: any) =>
                        updateForm("price", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Discount Price ($)</label>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={formData.discountPrice?.toString() || ""}
                      onChange={(e: any) =>
                        updateForm(
                          "discountPrice",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">
                    Audience <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.audience}
                    onChange={(e) =>
                      updateForm(
                        "audience",
                        e.target.value as "public" | "member_only" | "exclusive"
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="member_only">Members Only</option>
                    <option value="exclusive">Exclusive</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => updateForm("isFeatured", e.target.checked)}
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                    <StarIcon className="w-4 h-4 text-yellow-600" />
                    <span className="font-semibold text-sm">Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPremium}
                      onChange={(e) => updateForm("isPremium", e.target.checked)}
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                    <CrownIcon className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-sm">Premium</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Organizer Name</label>
                  <Input
                    placeholder="Organizer name"
                    value={formData.organizerName}
                    onChange={(e: any) => updateForm("organizerName", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Tags</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag"
                      value={tagInput}
                      onChange={(e: any) => setTagInput(e.target.value)}
                      onKeyPress={(e: any) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button type="button" variant="primary" onPress={handleAddTag}>
                      Add
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formData.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
                  fields={selectedType.fields || []}
                  values={typeFieldValues}
                  onChange={(fieldName, value) =>
                    setTypeFieldValues((prev) => ({ ...prev, [fieldName]: value }))
                  }
                  errors={fieldErrors}
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
                  <label className="text-sm font-semibold">Default Audience</label>
                  <select
                    value={formData.registrationConfig.defaultAudience}
                    onChange={(e) =>
                      updateForm("registrationConfig", {
                        ...formData.registrationConfig,
                        defaultAudience: e.target.value as RegistrationConfig["defaultAudience"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="member_only">Members Only</option>
                    <option value="exclusive">Exclusive</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Max Team Size</label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={formData.registrationConfig.maxTeamSize?.toString() || "1"}
                    onChange={(e: any) =>
                      updateForm("registrationConfig", {
                        ...formData.registrationConfig,
                        maxTeamSize: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                  <p className="text-xs text-default-400">
                    Set to 1 for individual events
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Allow Guest Registration</p>
                      <p className="text-xs text-default-500">
                        Allow non-members to register
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.registrationConfig.allowGuestRegistration}
                      onChange={(e) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          allowGuestRegistration: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Requires Approval</p>
                      <p className="text-xs text-default-500">
                        Registrations need admin approval
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.registrationConfig.requiresApproval}
                      onChange={(e) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          requiresApproval: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Enable Waitlist</p>
                      <p className="text-xs text-default-500">
                        Waitlist when event is full
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.registrationConfig.waitlistEnabled}
                      onChange={(e) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          waitlistEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Allow Cancellation</p>
                      <p className="text-xs text-default-500">
                        Allow users to cancel registration
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.registrationConfig.cancellationAllowed}
                      onChange={(e) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          cancellationAllowed: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold">Enable Team Formation</p>
                      <p className="text-xs text-default-500">
                        Allow participants to form teams
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.registrationConfig.teamFormationEnabled || false}
                      onChange={(e) =>
                        updateForm("registrationConfig", {
                          ...formData.registrationConfig,
                          teamFormationEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-bold mb-3">Ticket Config</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Ticket Type</label>
                      <select
                        value={formData.ticketConfig.ticketType}
                        onChange={(e) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            ticketType: e.target.value as TicketConfig["ticketType"],
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="standard">Standard</option>
                        <option value="team">Team</option>
                        <option value="exam_seat">Exam Seat</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Max Entries</label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={formData.ticketConfig.maxEntries?.toString() || "1"}
                        onChange={(e: any) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            maxEntries: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">QR Enabled</p>
                        <p className="text-xs text-default-500">
                          Generate QR codes for tickets
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.ticketConfig.qrEnabled}
                        onChange={(e) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            qrEnabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">Transfer Allowed</p>
                        <p className="text-xs text-default-500">
                          Allow ticket transfers between users
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.ticketConfig.transferAllowed}
                        onChange={(e) =>
                          updateForm("ticketConfig", {
                            ...formData.ticketConfig,
                            transferAllowed: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-bold mb-3">Workflow Config</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">Approval Required</p>
                        <p className="text-xs text-default-500">
                          Events need admin approval before publishing
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.workflowConfig.approvalRequired}
                        onChange={(e) =>
                          updateForm("workflowConfig", {
                            ...formData.workflowConfig,
                            approvalRequired: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">Auto Activate at Event Time</p>
                        <p className="text-xs text-default-500">
                          Automatically activate event when date/time arrives
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.workflowConfig.autoActivateAtEventTime}
                        onChange={(e) =>
                          updateForm("workflowConfig", {
                            ...formData.workflowConfig,
                            autoActivateAtEventTime: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-default-50 dark:bg-default-100/5 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">Publish After Approval</p>
                        <p className="text-xs text-default-500">
                          Auto-publish once approved
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.workflowConfig.publishAfterApproval}
                        onChange={(e) =>
                          updateForm("workflowConfig", {
                            ...formData.workflowConfig,
                            publishAfterApproval: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
                      />
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
                  <img
                    src={formData.image}
                    alt="Event preview"
                    className="w-full h-48 object-cover rounded-xl"
                    onError={(e: any) => {
                      e.currentTarget.src =
                        "https://via.placeholder.com/800x200?text=Image+Unavailable";
                    }}
                  />
                )}

                <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    {selectedType?.icon && <span className="text-lg">{selectedType.icon}</span>}
                    <Chip color="success" variant="primary" size="sm">
                      {selectedType?.displayName || "No Type"}
                    </Chip>
                    {formData.isFeatured && (
                      <Chip color="warning" variant="primary" size="sm">
                        <StarIcon className="w-3 h-3 mr-1" />
                        Featured
                      </Chip>
                    )}
                    {formData.isPremium && (
                      <Chip color="danger" variant="primary" size="sm">
                        <CrownIcon className="w-3 h-3 mr-1" />
                        Premium
                      </Chip>
                    )}
                  </div>

                  <h3 className="text-xl font-bold">{formData.title || "Untitled Event"}</h3>
                  {formData.description && (
                    <p className="text-sm text-default-600 line-clamp-3">{formData.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-purple-600" />
                      <span>{formData.date || "TBD"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-purple-600" />
                      <span>{formData.time || "TBD"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-purple-600" />
                      <span className="truncate">{formData.venue || "TBD"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-purple-600" />
                      <span>{formData.capacity} spots</span>
                    </div>
                  </div>

                  {formData.price > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSignIcon className="w-4 h-4 text-green-600" />
                      <span className="font-semibold">${formData.price}</span>
                      {formData.discountPrice && formData.discountPrice < formData.price && (
                        <span className="text-green-600 line-through text-xs">
                          ${formData.discountPrice}
                        </span>
                      )}
                    </div>
                  )}

                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.tags.map((tag) => (
                        <Chip key={tag} variant="primary" size="sm">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                {Object.keys(typeFieldValues).length > 0 && (
                  <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                    <h4 className="font-semibold text-sm mb-2">Type-Specific Data</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(typeFieldValues).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-default-500 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="font-medium">
                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                  <h4 className="font-semibold text-sm mb-2">Registration Settings</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-default-500">Audience</span>
                      <span>{formData.registrationConfig.defaultAudience}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Team Size</span>
                      <span>{formData.registrationConfig.maxTeamSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Guests</span>
                      <span>{formData.registrationConfig.allowGuestRegistration ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Approval</span>
                      <span>{formData.registrationConfig.requiresApproval ? "Required" : "None"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Waitlist</span>
                      <span>{formData.registrationConfig.waitlistEnabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Cancellation</span>
                      <span>{formData.registrationConfig.cancellationAllowed ? "Allowed" : "Not Allowed"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                  <h4 className="font-semibold text-sm mb-2">Ticket Settings</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-default-500">Type</span>
                      <span>{formData.ticketConfig.ticketType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Max Entries</span>
                      <span>{formData.ticketConfig.maxEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">QR Codes</span>
                      <span>{formData.ticketConfig.qrEnabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Transfer</span>
                      <span>{formData.ticketConfig.transferAllowed ? "Allowed" : "Not Allowed"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="ghost"
          onPress={prevStep}
          isDisabled={step === 1}
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Previous
        </Button>

        {step < 5 ? (
          <Button
            onPress={nextStep}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold"
          >
            Next
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onPress={handleSubmit}
            isPending={submitting}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold"
          >
            <CheckIcon className="w-4 h-4 mr-1" />
            Create Event
          </Button>
        )}
      </div>
    </div>
  );
}
