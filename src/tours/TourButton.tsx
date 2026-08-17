import React from "react";
import { useTour, TourRole } from "./useTour";
import { candidateTourSteps } from "./candidateTour";
import { hrTourSteps } from "./hrTour";
import { adminTourSteps } from "./adminTour";

const stepsMap: Record<string, any[]> = {
  candidate: candidateTourSteps,
  candidate_dashboard: candidateTourSteps,
  hr: hrTourSteps,
  admin: adminTourSteps,
};

interface TourButtonProps {
  role: TourRole;
  steps?: any[];
}

export function TourButton({ role, steps }: TourButtonProps) {
  const { startTour } = useTour({
    role,
    steps: steps ?? stepsMap[role] ?? [],
    autoStart: true,
  });

  return (
    <button
      onClick={startTour}
      title="Take a tour"
      aria-label="Start guided tour"
      className="fixed bottom-22 right-4 sm:bottom-6 sm:right-6 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-base sm:text-lg shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-all duration-200"
    >
      ?
    </button>
  );
}