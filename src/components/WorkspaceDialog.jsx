import React, { useEffect, useRef } from "react";
// Shared keyboard behavior for local workspace confirmations.
export default function WorkspaceDialog({ children, onClose, ...props }) {
  const element = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      dialog = element.current;
    const controls = () =>
      [...dialog.querySelectorAll("button,input,select,a[href]")].filter(
        (el) => !el.disabled && !el.hidden,
      );
    controls()[0]?.focus();
    function key(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current?.();
      }
      if (event.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (!items.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <section ref={element} tabIndex={-1} {...props}>
      {children}
    </section>
  );
}
