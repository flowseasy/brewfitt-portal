"use client";

import type { ComponentProps, ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type BaseProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  className?: string;
};

/** Text, email, tel, number or date input bound to React Hook Form, with label and error. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  nullable,
  ...input
}: BaseProps<T> & Omit<ComponentProps<typeof Input>, "name" | "defaultValue"> & { nullable?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            {...input}
            id={name}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value ?? ""}
            aria-invalid={fieldState.invalid || undefined}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(input.type === "number" ? (v === "" ? undefined : Number(v)) : nullable && v === "" ? null : v);
            }}
          />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  nullable,
  ...input
}: BaseProps<T> & Omit<ComponentProps<typeof Textarea>, "name" | "defaultValue"> & { nullable?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea
            {...input}
            id={name}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value ?? ""}
            aria-invalid={fieldState.invalid || undefined}
            onChange={(e) => field.onChange(nullable && e.target.value === "" ? null : e.target.value)}
          />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
}: BaseProps<T> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select value={field.value ?? ""} onValueChange={field.onChange} name={field.name}>
            <SelectTrigger id={name} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.invalid || undefined} className="w-full">
              <SelectValue placeholder={placeholder ?? "Choose"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
