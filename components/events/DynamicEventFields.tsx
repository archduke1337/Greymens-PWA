"use client";
import { useState } from "react";
import type { EventField } from "@/lib/types/index";
import { Input, Chip, Button } from "@heroui/react";
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
          field={field}
          value={values[field.name]}
          onChange={(val: any) => onChange(field.name, val)}
          error={errors?.[field.name]}
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
  const inputClasses = `w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-900 ${
    error ? "border-red-500" : "border-default-300"
  }`;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={currentValue}
            onChange={(e: any) => onChange(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`${inputClasses} resize-y`}
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
            value={currentValue?.toString() || ""}
            onChange={(e: any) => onChange(parseFloat(e.target.value) || 0)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClasses}`}
          >
            <option value="">
              {field.placeholder || `Select ${field.label.toLowerCase()}`}
            </option>
            {field.options?.map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "multi-select":
      return (
        <MultiSelectField field={field} value={currentValue} onChange={onChange} error={error} />
      );

    case "boolean":
      return (
        <div className="space-y-1.5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!currentValue}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-semibold">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
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
            placeholder="YYYY-MM-DD"
            value={currentValue}
            onChange={(e: any) => onChange(e.target.value)}
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
            onChange={(e: any) => onChange(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "json":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            placeholder={field.placeholder || '{ "key": "value" }'}
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
            rows={6}
            className={`${inputClasses} font-mono resize-y`}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case "array":
      return (
        <ArrayField field={field} value={currentValue} onChange={onChange} error={error} />
      );

    default:
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Input
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={currentValue}
            onChange={(e: any) => onChange(e.target.value)}
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
              type="button"
              onClick={() => toggle(opt)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? "bg-primary text-white border-primary"
                  : "bg-default-100 text-default-700 border-default-300 hover:bg-default-200"
              }`}
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
              type="button"
              onClick={() => toggle(s)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
          onChange={(e: any) => setInput(e.target.value)}
          onKeyPress={(e: any) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button type="button" variant="primary" onPress={addItem} isIconOnly>
          <PlusIcon className="w-4 h-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((item, idx) => (
            <button
              key={`${item}-${idx}`}
              type="button"
              onClick={() => removeItem(item)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
