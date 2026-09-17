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
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium theme-text"
      >
        {label}
      </label>

      <input
        id={id}
        {...props}
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
        `}
      />

      {error && (
        <p className="mt-2 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthInput;
