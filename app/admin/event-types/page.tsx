"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorHandler";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Switch,
  TextArea,
  useOverlayState,
} from "@heroui/react";
import { PlusIcon, EditIcon, TrashIcon } from "lucide-react";

interface EventTypeDoc {
  $id?: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  fields?: string;
  registrationConfig?: string;
  ticketConfig?: string;
  workflowConfig?: string;
  isActive: boolean;
  displayOrder?: number;
}

const EMPTY_FORM = {
  name: "",
  displayName: "",
  description: "",
  icon: "",
  displayOrder: "0",
  isActive: true,
  fields: "[]",
  registrationConfig: "{}",
  ticketConfig: "{}",
  workflowConfig: "{}",
};

const JSON_FIELDS = ["fields", "registrationConfig", "ticketConfig", "workflowConfig"] as const;

export default function AdminEventTypesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isOpen, open, close } = useOverlayState();

  const [eventTypes, setEventTypes] = useState<EventTypeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventTypeDoc | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/event-types", { credentials: "include" });
      const payload = (await response.json()) as { eventTypes?: EventTypeDoc[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load event types");
      setEventTypes(payload.eventTypes ?? []);
    } catch (error) {
      console.error("Error loading event types:", error);
      toast.error(getErrorMessage(error) || "Failed to load event types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowAdvanced(false);
    open();
  };

  const openEdit = (type: EventTypeDoc) => {
    setEditing(type);
    setForm({
      name: type.name,
      displayName: type.displayName,
      description: type.description || "",
      icon: type.icon || "",
      displayOrder: String(type.displayOrder ?? 0),
      isActive: type.isActive,
      fields: type.fields || "[]",
      registrationConfig: type.registrationConfig || "{}",
      ticketConfig: type.ticketConfig || "{}",
      workflowConfig: type.workflowConfig || "{}",
    });
    setShowAdvanced(false);
    open();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.displayName.trim()) {
      toast.error("Name and display name are required");
      return;
    }
    // Config columns are JSON strings server-side: reject malformed JSON here
    // so the failure message points at the offending field, not a 400.
    for (const key of JSON_FIELDS) {
      const raw = form[key].trim();
      if (raw) {
        try {
          JSON.parse(raw);
        } catch {
          toast.error(`Invalid JSON in ${key}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const body = {
        ...(editing?.$id ? { eventTypeId: editing.$id } : {}),
        name: form.name.trim(),
        displayName: form.displayName.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon.trim() || undefined,
        displayOrder: Number.parseInt(form.displayOrder, 10) || 0,
        isActive: form.isActive,
        fields: form.fields.trim() || "[]",
        registrationConfig: form.registrationConfig.trim() || "{}",
        ticketConfig: form.ticketConfig.trim() || "{}",
        workflowConfig: form.workflowConfig.trim() || "{}",
      };
      const response = await fetch("/api/admin/event-types", {
        method: editing?.$id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to save event type");
      toast.success(editing ? "Event type updated" : "Event type created");
      close();
      setEditing(null);
      await loadData();
    } catch (error) {
      console.error("Error saving event type:", error);
      toast.error(getErrorMessage(error) || "Failed to save event type");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (type: EventTypeDoc) => {
    if (!type.$id) return;
    setTogglingId(type.$id);
    try {
      const response = await fetch("/api/admin/event-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventTypeId: type.$id, isActive: !type.isActive }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to update event type");
      toast.success(type.isActive ? "Event type deactivated" : "Event type activated");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to update event type");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (type: EventTypeDoc) => {
    if (!type.$id) return;
    if (!window.confirm(`Delete "${type.displayName}"? Types in use by events cannot be deleted — deactivate them instead.`)) return;
    setDeletingId(type.$id);
    try {
      const response = await fetch(`/api/admin/event-types?eventTypeId=${encodeURIComponent(type.$id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      // 409 carries the blocking event count — surface it so the admin knows
      // to deactivate instead of retrying delete.
      if (!response.ok) throw new Error(payload?.error || "Unable to delete event type");
      toast.success("Event type deleted");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to delete event type");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Event Type Management
          </h1>
          <p className="text-default-500 mt-1 text-sm md:text-base">
            Templates that define registration, ticketing, and approval workflows for events
          </p>
        </div>
        <Button onPress={openCreate} className="bg-primary" size="lg">
          <PlusIcon className="w-5 h-5" />
          <span className="ml-2">Add Event Type</span>
        </Button>
      </div>

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-lg text-default-600 mb-4">No event types yet</p>
            <Button onPress={openCreate}>Create First Event Type</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {eventTypes.map((type) => (
            <Card key={type.$id} className="border-none shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-default-100 flex items-center justify-center text-xl flex-shrink-0">
                    {type.icon || type.displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">{type.displayName}</h3>
                      <Chip size="sm" variant="soft">{type.name}</Chip>
                      {!type.isActive && (
                        <Chip size="sm" color="default">Inactive</Chip>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-sm text-default-500 mt-1 line-clamp-1">{type.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => handleToggleActive(type)}
                      isPending={togglingId === type.$id}
                    >
                      {type.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="primary" isIconOnly onPress={() => openEdit(type)}>
                      <EditIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      isIconOnly
                      isPending={deletingId === type.$id}
                      onPress={() => handleDelete(type)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal>
        <ModalBackdrop isOpen={isOpen} onOpenChange={(openState: boolean) => { if (!openState) close(); }}>
          <ModalContainer>
            <ModalDialog>
              {() => (
                <form onSubmit={handleSave}>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      {editing ? "Edit Event Type" : "Create Event Type"}
                    </h2>
                  </ModalHeader>
                  <ModalBody className="py-6 space-y-5">
                    <div>
                      <Label>Name (unique key)</Label>
                      <Input
                        placeholder="e.g., workshop"
                        value={form.name}
                        onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                        disabled={Boolean(editing)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Display Name</Label>
                      <Input
                        placeholder="e.g., Workshop"
                        value={form.displayName}
                        onChange={(e: any) => setForm({ ...form, displayName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <TextArea
                        placeholder="What kinds of events use this template?"
                        value={form.description}
                        onChange={(e: any) => setForm({ ...form, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Icon</Label>
                        <Input
                          placeholder="Emoji or text"
                          value={form.icon}
                          onChange={(e: any) => setForm({ ...form, icon: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Display Order</Label>
                        <Input
                          type="number"
                          value={form.displayOrder}
                          onChange={(e: any) => setForm({ ...form, displayOrder: e.target.value })}
                        />
                      </div>
                    </div>
                    <Switch isSelected={form.isActive} onChange={(checked: any) => setForm({ ...form, isActive: checked })}>
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        Active
                      </Switch.Content>
                    </Switch>
                    <div>
                      <Button size="sm" variant="ghost" onPress={() => setShowAdvanced((v) => !v)}>
                        {showAdvanced ? "Hide advanced JSON configs" : "Show advanced JSON configs"}
                      </Button>
                      {showAdvanced && (
                        <div className="space-y-4 mt-3">
                          {JSON_FIELDS.map((key) => (
                            <div key={key}>
                              <Label>{key}</Label>
                              <TextArea
                                value={form[key]}
                                onChange={(e: any) => setForm({ ...form, [key]: e.target.value })}
                                rows={4}
                                className="font-mono text-xs"
                              />
                            </div>
                          ))}
                          <p className="text-xs text-default-400">
                            Must stay valid JSON — the save is rejected otherwise. Copy an
                            existing type&apos;s configs as a starting point.
                          </p>
                        </div>
                      )}
                    </div>
                  </ModalBody>
                  <ModalFooter className="border-t pt-4">
                    <Button variant="primary" onPress={close}>
                      Cancel
                    </Button>
                    <Button type="submit" isPending={saving}>
                      {editing ? "Update Event Type" : "Create Event Type"}
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
