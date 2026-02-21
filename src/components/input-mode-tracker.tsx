"use client";

import { useEffect } from "react";

export function InputModeTracker() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.input = "mouse";

    const setMouse = () => {
      html.dataset.input = "mouse";
    };
    const NAV_KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "]);
    const setKeyboard = (e: KeyboardEvent) => {
      if (NAV_KEYS.has(e.key)) html.dataset.input = "keyboard";
    };

    window.addEventListener("mousedown", setMouse);
    window.addEventListener("keydown", setKeyboard);
    return () => {
      window.removeEventListener("mousedown", setMouse);
      window.removeEventListener("keydown", setKeyboard);
    };
  }, []);

  return null;
}
