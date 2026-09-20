import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ElementType, ComponentPropsWithoutRef } from "react";
import { Slot } from "@radix-ui/react-slot";

type Variant = "primary" | "secondary" | "subtle";
type Size = "md" | "sm";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white border-transparent hover:bg-brand-hover active:bg-brand-pressed",
  secondary:
    "bg-surface text-fg border-stroke-strong hover:bg-surface-subtle active:bg-stroke",
  subtle:
    "bg-transparent text-fg-2 border-transparent hover:bg-surface-subtle active:bg-stroke",
};

const sizes: Record<Size, string> = {
  md: "h-8 px-3 text-caption",
  sm: "h-6 px-2 text-caption",
};

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  
  return (
    <Comp
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold",
        "transition-colors duration-100 ease-fluent",
        "disabled:pointer-events-none disabled:border-stroke disabled:bg-surface-subtle disabled:text-fg-disabled",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
