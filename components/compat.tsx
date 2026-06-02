"use client";

import React, { useState, useCallback, forwardRef } from "react";

// ============================================================
// HOOKS
// ============================================================

export function useDisclosure(defaultIsOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultIsOpen);
  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);
  const onOpenChange = useCallback((open: boolean) => setIsOpen(open), []);
  const onToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  return { isOpen, onOpen, onClose, onOpenChange, onToggle };
}

// ============================================================
// TYPES
// ============================================================

type ColorVariant = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
type ButtonVariant = "solid" | "bordered" | "light" | "flat" | "faded" | "shadow" | "ghost" | "primary" | "outline" | "dot";
type ComponentSize = "sm" | "md" | "lg";

// ============================================================
// BUTTON
// ============================================================

export const Button = forwardRef<HTMLButtonElement, any>(
  ({ className = "", children, color = "default", variant = "solid", size = "md", isLoading, isIconOnly, isDisabled, onPress, onClick, startContent, endContent, type = "button", onMouseEnter, onMouseLeave, ...props }: any, ref) => {
    const colorClass = variant === "solid" || variant === "primary" || variant === "dot" ? (colorMap[color] || colorMap.default) : "";
    const variantClass = variant !== "solid" && variant !== "primary" && variant !== "dot" ? (variantMap[variant] || "") : "";
    const sizeClass = isIconOnly ? "p-2" : (sizeMap[size] || sizeMap.md);

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled || isLoading}
        className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${colorClass} ${variantClass} ${sizeClass} ${className}`}
        onClick={onPress || onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...props}
      >
        {isLoading ? (
          <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
        ) : startContent}
        {children}
        {endContent}
      </button>
    );
  }
);
Button.displayName = "Button";

const colorMap: Record<string, string> = {
  default: "bg-default-100 text-default-700 hover:bg-default-200",
  primary: "bg-primary text-white hover:bg-primary-600",
  secondary: "bg-secondary text-white hover:bg-secondary-600",
  success: "bg-success text-white hover:bg-success-600",
  warning: "bg-warning text-white hover:bg-warning-600",
  danger: "bg-danger text-white hover:bg-danger-600",
};

const variantMap: Record<string, string> = {
  solid: "",
  bordered: "border border-current bg-transparent",
  light: "bg-transparent hover:bg-default-100",
  flat: "bg-default-100 hover:bg-default-200",
  faded: "bg-default-50 hover:bg-default-100",
  shadow: "shadow-md",
  ghost: "bg-transparent hover:bg-default-100",
  primary: "",
  outline: "border border-current bg-transparent",
  dot: "",
};

const sizeMap: Record<string, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

// ============================================================
// CARD
// ============================================================

export const Card = forwardRef<HTMLDivElement, any>(
  ({ className = "", children, isPressable, onPress, ...props }: any, ref) => (
    <div
      ref={ref}
      className={`rounded-xl border border-default-200 bg-white dark:bg-default-50 shadow-sm ${isPressable ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${className}`}
      onClick={isPressable ? onPress : undefined}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";

export const CardContent = forwardRef<HTMLDivElement, any>(
  ({ className = "", children, ...props }: any, ref) => (
    <div ref={ref} className={`p-4 ${className}`} {...props}>{children}</div>
  )
);
CardContent.displayName = "CardContent";

export const CardHeader = forwardRef<HTMLDivElement, any>(
  ({ className = "", children, ...props }: any, ref) => (
    <div ref={ref} className={`px-4 pt-4 pb-2 ${className}`} {...props}>{children}</div>
  )
);
CardHeader.displayName = "CardHeader";

export const CardFooter = forwardRef<HTMLDivElement, any>(
  ({ className = "", children, ...props }: any, ref) => (
    <div ref={ref} className={`px-4 pt-2 pb-4 ${className}`} {...props}>{children}</div>
  )
);
CardFooter.displayName = "CardFooter";

// ============================================================
// INPUT
// ============================================================

export const Input = forwardRef<HTMLInputElement, any>(
  ({ className = "", label, placeholder, value, onChange, type = "text", startContent, endContent, description, isDisabled, isRequired, required, classNames, onKeyPress, maxLength, name, ...props }: any, ref) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className={`text-sm font-medium text-default-700 ${classNames?.label || ""}`}>
          {label}{(isRequired || required) && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-default-300 bg-transparent px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
        {startContent && <span className="text-default-400 flex-shrink-0">{startContent}</span>}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={isDisabled}
          required={isRequired || required}
          onKeyPress={onKeyPress}
          maxLength={maxLength}
          name={name}
          className={`flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-default-400 ${classNames?.input || ""}`}
          {...props}
        />
        {endContent && <span className="text-default-400 flex-shrink-0">{endContent}</span>}
      </div>
      {description && <p className="text-xs text-default-500">{description}</p>}
    </div>
  )
);
Input.displayName = "Input";

// ============================================================
// TEXTAREA
// ============================================================

export const TextArea = forwardRef<HTMLTextAreaElement, any>(
  ({ className = "", label, placeholder, value, onChange, minRows = 3, rows, isDisabled, isRequired, required, classNames, ...props }: any, ref) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className={`text-sm font-medium text-default-700 ${classNames?.label || ""}`}>
          {label}{(isRequired || required) && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows || minRows}
        disabled={isDisabled}
        required={isRequired || required}
        className={`rounded-lg border border-default-300 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-y ${classNames?.input || ""}`}
        {...props}
      />
    </div>
  )
);
TextArea.displayName = "TextArea";

// ============================================================
// SELECT (uses native <select>)
// ============================================================

export const Select = forwardRef<HTMLSelectElement, any>(
  ({ className = "", label, placeholder, selectedKeys, onChange, isRequired, required, classNames, children, ...props }: any, ref) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className={`text-sm font-medium text-default-700 ${classNames?.label || ""}`}>
          {label}{(isRequired || required) && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        value={selectedKeys?.[0] || ""}
        onChange={onChange}
        required={isRequired || required}
        className={`rounded-lg border border-default-300 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer ${classNames?.trigger || ""}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </div>
  )
);
Select.displayName = "Select";

export const SelectItem = ({ children, value, key: k, ...props }: any) => (
  <option key={k} value={value || k || ""} {...props}>{children}</option>
);

// ============================================================
// MODAL (overlay pattern)
// ============================================================

export const Modal = ({ isOpen, onClose, children, classNames, ...props }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-10 ${classNames?.base || ""}`}>
        {children}
      </div>
    </div>
  );
};

export const ModalDialog = ({ children, className = "", ...props }: any) => (
  <div className={`bg-white dark:bg-default-50 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto ${className}`} {...props}>{children}</div>
);

export const ModalHeader = ({ children, className = "", ...props }: any) => (
  <div className={`px-6 pt-6 pb-2 ${className}`} {...props}>{children}</div>
);

export const ModalBody = ({ children, className = "", ...props }: any) => (
  <div className={`px-6 py-4 ${className}`} {...props}>{children}</div>
);

export const ModalFooter = ({ children, className = "", ...props }: any) => (
  <div className={`px-6 pb-6 pt-2 flex justify-end gap-2 ${className}`} {...props}>{children}</div>
);

// ============================================================
// SWITCH
// ============================================================

export const Switch = ({ checked, onChange, onValueChange, children, className = "", isDisabled, size = "md", isSelected, ...props }: any) => {
  const isChecked = checked ?? isSelected ?? false;
  const handler = onChange || onValueChange;
  const sizeClasses = size === "sm" ? "w-8 h-4" : size === "lg" ? "w-14 h-7" : "w-11 h-6";
  const dotClasses = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  const translateClasses = size === "sm" ? "translate-x-4" : size === "lg" ? "translate-x-7" : "translate-x-5";

  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${isDisabled ? "opacity-50 pointer-events-none" : ""} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={() => handler?.(!isChecked)}
        className={`relative rounded-full transition-colors ${sizeClasses} ${isChecked ? "bg-primary" : "bg-default-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform ${dotClasses} ${isChecked ? translateClasses : ""}`} />
      </button>
      {children}
    </label>
  );
};

// ============================================================
// TABS / TAB
// ============================================================

export const Tabs = ({ children, selectedKey, onSelectionChange, className = "", ...props }: any) => {
  const tabs = React.Children.toArray(children) as React.ReactElement[];
  const activeKey = selectedKey || tabs[0]?.key || "";

  return (
    <div className={className}>
      {/* Tab headers */}
      <div className="flex gap-1 border-b border-default-200 mb-4" role="tablist">
        {tabs.map((tab) => {
          const key = String(tab.key || "");
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectionChange?.(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-default-500 hover:text-default-700"
              }`}
            >
              {tab.props?.title || key}
            </button>
          );
        })}
      </div>
      {/* Active tab content */}
      {tabs.map((tab) => {
        const key = String(tab.key || "");
        if (key !== activeKey) return null;
        return (
          <div key={key} role="tabpanel">
            {tab.props?.children}
          </div>
        );
      })}
    </div>
  );
};

export const Tab = ({ title, children, className = "", ...props }: any) => (
  <div className={className} {...props}>{children}</div>
);

// ============================================================
// CHIP
// ============================================================

const chipColorMap: Record<string, string> = {
  default: "bg-default-100 text-default-700",
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
};

const chipSolidColorMap: Record<string, string> = {
  default: "bg-default-100 text-default-700",
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
};

const chipOutlineColorMap: Record<string, string> = {
  default: "bg-transparent border border-default-300 text-default-700",
  primary: "bg-transparent border border-primary text-primary",
  secondary: "bg-transparent border border-secondary text-secondary",
  success: "bg-transparent border border-success text-success",
  warning: "bg-transparent border border-warning text-warning",
  danger: "bg-transparent border border-danger text-danger",
};

const chipLightColorMap: Record<string, string> = {
  default: "bg-transparent text-default-700",
  primary: "bg-transparent text-primary",
  secondary: "bg-transparent text-secondary",
  success: "bg-transparent text-success",
  warning: "bg-transparent text-warning",
  danger: "bg-transparent text-danger",
};

export const Chip = ({ children, size = "md", color = "default", variant = "solid", onClose, className = "", ...props }: any) => {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-4 py-1.5 text-base" : "px-3 py-1 text-sm";
  let colorStyle = chipSolidColorMap[color] || chipSolidColorMap.default;
  if (variant === "outline" || variant === "bordered") {
    colorStyle = chipOutlineColorMap[color] || chipOutlineColorMap.default;
  } else if (variant === "light" || variant === "ghost") {
    colorStyle = chipLightColorMap[color] || chipLightColorMap.default;
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${colorStyle} ${sizeClass} ${className}`} {...props}>
      {children}
      {onClose && (
        <button onClick={onClose} className="ml-0.5 hover:opacity-70 cursor-pointer" type="button">×</button>
      )}
    </span>
  );
};

// ============================================================
// BADGE
// ============================================================

export const Badge = ({ children, color = "default", variant = "solid", size = "md", className = "", ...props }: any) => {
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-xs" : size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  const colorClass = variant === "solid" ? (chipColorMap[color] || chipColorMap.default) : `${chipColorMap[color] || chipColorMap.default} border border-current`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${colorClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </span>
  );
};

// ============================================================
// AVATAR
// ============================================================

export const Avatar = ({ src, name, size = "md", className = "", isBordered, ...props }: any) => {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-16 h-16 text-lg" : "w-10 h-10 text-sm";
  const borderClass = isBordered ? "ring-2 ring-primary" : "";
  const initials = name ? name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?";

  if (src) {
    return (
      <div className={`relative inline-flex ${sizeClass}`} {...props}>
        <img
          src={src}
          alt={name || "Avatar"}
          className={`absolute inset-0 rounded-full object-cover ${borderClass} ${className}`}
          onError={(e: any) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
        />
        <div className={`hidden absolute inset-0 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold ${borderClass} ${className}`}>
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold ${sizeClass} ${borderClass} ${className}`} {...props}>
      {initials}
    </div>
  );
};

// ============================================================
// TABLE
// ============================================================

export const Table = ({ children, className = "", ...props }: any) => (
  <div className="overflow-x-auto">
    <table className={`w-full ${className}`} {...props}>{children}</table>
  </div>
);

export const TableHeader = ({ children, className = "", ...props }: any) => (
  <thead className={`bg-default-50 ${className}`} {...props}>{children}</thead>
);

export const TableColumn = ({ children, className = "", ...props }: any) => (
  <th className={`px-4 py-3 text-left text-xs font-semibold text-default-500 uppercase tracking-wider ${className}`} {...props}>{children}</th>
);

export const TableBody = ({ children, className = "", ...props }: any) => (
  <tbody className={`divide-y divide-default-100 ${className}`} {...props}>{children}</tbody>
);

export const TableRow = ({ children, className = "", ...props }: any) => (
  <tr className={`hover:bg-default-50 transition-colors ${className}`} {...props}>{children}</tr>
);

export const TableCell = ({ children, className = "", ...props }: any) => (
  <td className={`px-4 py-3 text-sm ${className}`} {...props}>{children}</td>
);

// ============================================================
// PROGRESS BAR
// ============================================================

const progressColorMap: Record<string, string> = {
  default: "bg-default-300",
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export const ProgressBar = ({ value = 0, color = "primary", size = "md", className = "", ...props }: any) => {
  const heightClass = size === "sm" ? "h-1.5" : size === "lg" ? "h-4" : "h-2.5";
  return (
    <div className={`w-full rounded-full bg-default-200 ${heightClass} ${className}`} {...props}>
      <div
        className={`rounded-full ${progressColorMap[color] || progressColorMap.primary} ${heightClass} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

// ============================================================
// SEPARATOR
// ============================================================

export const Separator = ({ className = "", ...props }: any) => (
  <hr className={`border-default-200 my-4 ${className}`} {...props} />
);

// ============================================================
// SPINNER
// ============================================================

export const Spinner = ({ size = "md", label, ...props }: any) => {
  const sizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-6 w-6";
  return (
    <div className="flex flex-col items-center gap-2" {...props}>
      <span className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizeClass}`} />
      {label && <span className="text-sm text-default-500">{label}</span>}
    </div>
  );
};

// ============================================================
// ACCORDION
// ============================================================

export const Accordion = ({ children, className = "", ...props }: any) => (
  <div className={`divide-y divide-default-200 ${className}`} {...props}>{children}</div>
);

export const AccordionItem = ({ title, children, className = "", ...props }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={className} {...props}>
      <button
        type="button"
        className="flex items-center justify-between w-full py-4 text-left font-medium"
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
        <span className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </div>
  );
};

// ============================================================
// LINK
// ============================================================

export const Link = ({ href, children, className = "", ...props }: any) => (
  <a href={href} className={`text-primary hover:underline ${className}`} {...props}>{children}</a>
);

// ============================================================
// DROPDOWN (simplified)
// ============================================================

export const Dropdown = ({ isOpen, onOpenChange, children, ...props }: any) => {
  const [open, setOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const show = isControlled ? isOpen : open;

  return (
    <div className="relative inline-block">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type === DropdownTrigger) {
          return React.cloneElement(child as React.ReactElement<any>, {
            onClick: () => {
              const newOpen = !show;
              if (isControlled) onOpenChange?.(newOpen);
              else setOpen(newOpen);
            }
          });
        }
        if (child.type === DropdownMenu) {
          if (!show) return null;
          return (
            <div className="absolute right-0 mt-2 z-50 min-w-[200px] bg-white dark:bg-default-50 rounded-xl shadow-lg border border-default-200 py-1">
              {child}
            </div>
          );
        }
        return child;
      })}
    </div>
  );
};

export const DropdownTrigger = ({ children, onClick, ...props }: any) => (
  <div onClick={onClick} {...props} className="inline-flex">{children}</div>
);

export const DropdownMenu = ({ children, className = "", ...props }: any) => (
  <div className={className} {...props}>{children}</div>
);

export const DropdownItem = ({ children, href, className = "", ...props }: any) => (
  <a
    href={href}
    className={`block px-4 py-2 text-sm hover:bg-default-100 transition-colors ${className}`}
    {...props}
  >
    {children}
  </a>
);

// ============================================================
// AVATAR GROUP (compat)
// ============================================================

export function AvatarGroup({ children, max, className = "", ...props }: any) {
  return <div className={`flex -space-x-2 ${className}`} {...props}>{children}</div>;
}
