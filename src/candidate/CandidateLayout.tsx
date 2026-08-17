import React from 'react';
import { Outlet } from 'react-router-dom';;

export const CandidateLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-500/10 transition-colors duration-500">
      <Outlet />
    </div>
  );
};
