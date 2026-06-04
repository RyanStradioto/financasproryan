import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, ...props }, ref) => {
    // Auto-pick a mobile keyboard for numeric inputs so users get the numpad
    // without every call site needing to remember inputMode.
    const resolvedInputMode =
      inputMode ?? (type === "number" ? "decimal" : type === "tel" ? "tel" : undefined);

    return (
      <input
        type={type}
        inputMode={resolvedInputMode}
        className={cn(
          // h-11 on mobile = 44px touch target (Apple HIG); h-10 on desktop
          "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
