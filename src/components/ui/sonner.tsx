"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--surface-2)",
          border: "1px solid var(--brand-primary)",
          color: "var(--text-high)",
          fontSize: "14px",
          padding: "12px 16px",
          borderRadius: "var(--radius)",
          backdropFilter: "blur(8px)", // Add blur for glass effect
        },
        className: "toast",
        // Custom styles for success toasts
        unstyled: false,
      }}
      {...props}
    />
  );
};

export { Toaster };
