"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function VlkThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="vlk-theme" disableTransitionOnChange>{children}</ThemeProvider>;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="min-h-11 gap-2 text-white hover:bg-white/10 hover:text-white" aria-label="Тема оформлення">
        <Sun className="dark:hidden" /><Moon className="hidden dark:block" /><span className="hidden sm:inline">Тема</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
        <DropdownMenuRadioItem value="light" className="min-h-11"><Sun />Світла</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" className="min-h-11"><Moon />Темна</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system" className="min-h-11"><Monitor />Як у системі</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
