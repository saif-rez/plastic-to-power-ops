const KEY = "polycable-theme";

export function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(KEY);
  document.documentElement.classList.toggle("dark", stored === "dark");
}

export function toggleTheme(): "dark" | "light" {
  const isDark = document.documentElement.classList.toggle("dark");
  window.localStorage.setItem(KEY, isDark ? "dark" : "light");
  return isDark ? "dark" : "light";
}

export function isDarkTheme() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}
