"use client";
import type { EventField } from "@/lib/types/index";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Input,
  Button,
  Checkbox,
  Label,
  ListBox,
  Select,
  TextArea,
} from "@heroui/react";
import { PlusIcon, XIcon } from "lucide-react";

interface DynamicEventFieldsProps {
  fields: EventField[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}

export default function DynamicEventFields({
  fields,
  values,
  onChange,
  errors,
}: DynamicEventFieldsProps) {
  if (!fields || fields.length === 0) {
    return (
      <div className="text-center py-8 text-default-400">
        <p className="text-sm">No additional fields for this event type.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <FieldRenderer
          key={field.name}
          error={errors?.[field.name]}
          field={field}
          value={values[field.name]}
          onChange={(val: any) => onChange(field.name, val)}
        />
      ))}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: EventField;
  value: any;
  onChange: (val: any) => void;
  error?: string;
}) {
  const currentValue = value ?? field.defaultValue ?? "";

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            placeholder={
              field.placeholder || `Enter ${field.label.toLowerCase()}`
            }
            value={currentValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={`dynamic-field-${field.name}`}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <TextArea
            fullWidth
            id={`dynamic-field-${field.name}`}
            placeholder={
              field.placeholder || `Enter ${field.label.toLowerCase()}`
            }
            rows={4}
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            placeholder={field.placeholder || "0"}
            type="number"
            value={currentValue?.toString() || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // Blank stays blank (undefined) so required-checks still fire;
              // the old `|| 0` wrote a false zero into required fields.
              const raw = e.target.value;

              onChange(raw === "" ? undefined : Number(raw));
            }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <Select
            fullWidth
            placeholder={
              field.placeholder || `Select ${field.label.toLowerCase()}`
            }
            value={
              typeof currentValue === "string" && currentValue !== ""
                ? currentValue
                : null
            }
            onChange={(value) => onChange(String(value ?? ""))}
          >
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {field.options?.map((opt: string) => (
                  <ListBox.Item key={opt} id={opt} textValue={opt}>
                    {opt}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "multi-select":
      return (
        <MultiSelectField
          error={error}
          field={field}
          value={currentValue}
          onChange={onChange}
        />
      );

    case "boolean":
      return (
        <div className="space-y-1.5">
          <Checkbox
            isSelected={!!currentValue}
            onChange={(selected: boolean) => onChange(selected)}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-sm font-semibold">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </Checkbox.Content>
          </Checkbox>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            type="date"
            value={currentValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "url":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            placeholder={field.placeholder || "https://"}
            value={currentValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "json":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={`dynamic-field-${field.name}`}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <TextArea
            fullWidth
            className="font-mono"
            id={`dynamic-field-${field.name}`}
            placeholder={field.placeholder || '{ "key": "value" }'}
            rows={6}
            value={
              typeof currentValue === "string"
                ? currentValue
                : JSON.stringify(currentValue, null, 2) || ""
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);

                onChange(parsed);
              } catch {
                onChange(e.target.value);
              }
            }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "array":
      return (
        <ArrayField
          error={error}
          field={field}
          value={currentValue}
          onChange={onChange}
        />
      );

    default:
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            placeholder={
              field.placeholder || `Enter ${field.label.toLowerCase()}`
            }
            value={currentValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );
  }
}

function MultiSelectField({
  field,
  value,
  onChange,
  error,
}: {
  field: EventField;
  value: any;
  onChange: (val: any) => void;
  error?: string;
}) {
  const selected: string[] = Array.isArray(value) ? value : [];

  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-default-300 min-h-[42px]">
        {field.options?.map((opt: string) => {
          const isSelected = selected.includes(opt);

          return (
            <button
              key={opt}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? "bg-primary text-white border-primary"
                  : "bg-default-100 text-default-700 border-default-300 hover:bg-default-200"
              }`}
              type="button"
              onClick={() => toggle(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((s) => (
            <button
              key={s}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              type="button"
              onClick={() => toggle(s)}
            >
              {s}
              <XIcon className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ArrayField({
  field,
  value,
  onChange,
  error,
}: {
  field: EventField;
  value: any;
  onChange: (val: any) => void;
  error?: string;
}) {
  const items: string[] = Array.isArray(value) ? value : [];
  const [input, setInput] = useState("");

  const addItem = () => {
    const trimmed = input.trim();

    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setInput("");
    }
  };

  const removeItem = (item: string) => {
    onChange(items.filter((i) => i !== item));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex gap-2">
        <Input
          placeholder={field.placeholder || "Add item"}
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setInput(e.target.value)
          }
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button
          isIconOnly
          aria-label="Add item"
          type="button"
          variant="primary"
          onPress={addItem}
        >
          <PlusIcon className="w-4 h-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((item, idx) => (
            <button
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              type="button"
              onClick={() => removeItem(item)}
            >
              {item}
              <XIcon className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
