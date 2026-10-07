import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function AuthInput({
  label,
  error,
  id,
  ...props
}: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = props.type === "password";

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium theme-text"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          {...props}
          type={isPassword && visible ? "text" : props.type}
          className={`
          w-full rounded-xl border
          bg-[var(--bg-secondary)]
          px-4 py-3
          text-sm theme-text
          outline-none
          transition-all duration-200
          placeholder:text-[var(--text-muted)]
          focus:border-[#6CAD91]
          focus:ring-4 focus:ring-[#6CAD91]/10
          ${
            error
              ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
              : "theme-border"
          }
          ${props.className || ""}
          ${isPassword ? "pr-16" : ""}
          `}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold theme-text-muted hover:bg-[var(--bg-tertiary)]"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {visible ? "Ocultar" : "Ver"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthInput;
