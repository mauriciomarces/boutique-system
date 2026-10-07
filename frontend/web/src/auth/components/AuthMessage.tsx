import type { ReactNode } from "react";

interface AuthMessageProps {
  type: "error" | "success" | "info";
  children: ReactNode;
}

function AuthMessage({
  type,
  children,
}: AuthMessageProps) {
  const styles = {
    error:
      "border-red-400/20 bg-red-400/10 text-red-600 dark:text-red-300",
    success:
      "border-[#6CAD91]/30 bg-[#6CAD91]/10 text-[#47745f] dark:text-[#9ed1b7]",
    info:
      "border-[#B9DFE8]/40 bg-[#B9DFE8]/10 text-[#456b73] dark:text-[#a9d5dc]",
  };

  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm leading-5 ${styles[type]}`}
    >
      {children}
    </div>
  );
}

export default AuthMessage;
