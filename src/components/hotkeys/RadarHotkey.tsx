import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  const editable = (target as HTMLElement).isContentEditable;
  return editable || tag === "input" || tag === "textarea" || tag === "select";
}

export default function RadarHotkey() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditable(e.target)) return;

      const key = e.key.toLowerCase();

      if (key === "r") {
        e.preventDefault();
        if (pathname !== "/radar") navigate("/radar");
        else if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
        else navigate("/");
      } else if (key === "escape") {
        if (pathname === "/radar") {
          e.preventDefault();
          if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
          else navigate("/");
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, navigate]);

  return null;
}
