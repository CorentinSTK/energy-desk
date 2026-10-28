"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Dark by default (trading-desk convention); the user's choice is remembered by next-themes.
 * Light mode puts `theme-light` (not `light`) on <html>: light tokens are the `:root` default, and the
 * `.light` class is reserved for subtrees forced to light inside a dark page (style guide).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      themes={["dark", "light"]}
      value={{ dark: "dark", light: "theme-light" }}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
