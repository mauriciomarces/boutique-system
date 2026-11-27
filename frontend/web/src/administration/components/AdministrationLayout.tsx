import type { ReactNode } from "react";

import AdministrationSidebar from "./AdministrationSidebar";

type AdministrationLayoutProps = {
  sidebarOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

function AdministrationLayout({
  sidebarOpen,
  onClose,
  children,
}: AdministrationLayoutProps) {
  return (
    <div className="theme-bg min-h-screen lg:flex">
      <AdministrationSidebar sidebarOpen={sidebarOpen} onClose={onClose} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default AdministrationLayout;
