// components/auth/PasswordField.tsx
// Password field with a show/hide toggle, composed from canonical HeroUI v3
// TextField anatomy (Label + Input + Description + FieldError). The toggle
// is a plain button with an accessible name — never a second submit path.
"use client";

import { useState } from "react";
import {
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
  description?: string;
  validate?: (value: string) => string | null;
}

export default function PasswordField({
  name,
  label,
  value,
  onChange,
  disabled = false,
  autoComplete = "current-password",
  placeholder = "Your password",
  description,
  validate,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      isRequired
      isDisabled={disabled}
      name={name}
      type={visible ? "text" : "password"}
      validate={validate}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <div className="relative">
        <Input
          autoComplete={autoComplete}
          className="pr-10"
          placeholder={placeholder}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-default-400 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          disabled={disabled}
          type="button"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      {description && <Description>{description}</Description>}
      <FieldError />
    </TextField>
  );
}
