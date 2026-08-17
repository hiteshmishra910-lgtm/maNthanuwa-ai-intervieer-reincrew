import React from 'react';
import { Outlet } from 'react-router-dom';
import { TourButton } from "../tours/TourButton";

export const AdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-500/10 transition-colors duration-500">
      {/* Admin specific layout elements (sidebar, nav) can go here */}
      <Outlet />
      <TourButton role="admin" />
    </div>
  );
};
