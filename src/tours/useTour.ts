import { useEffect, useRef, useCallback } from "react";
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";

export type TourRole = "candidate"| "candidate_dashboard" | "hr" | "admin";

// Use the instance type from the constructor, avoiding namespace access
type ShepherdTour = InstanceType<typeof Shepherd.Tour>;

const TOUR_SEEN_KEY = (role: TourRole) => `project_ai_tour_seen_${role}`;

interface UseTourOptions {
  role: TourRole;
  steps: any[];
  autoStart?: boolean;
}

export function useTour({ role, steps, autoStart = true }: UseTourOptions) {
  const tourRef = useRef<ShepherdTour | null>(null);

  const buildTour = useCallback((): ShepherdTour => {
    if (tourRef.current) {
      tourRef.current.complete();
      tourRef.current = null;
    }

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: "project-ai-tour-step",
        scrollTo: { behavior: "smooth", block: "center" },
        modalOverlayOpeningPadding: 8,
        modalOverlayOpeningRadius: 6,
      },
    });

    steps.forEach((stepOptions: any, index: number) => {
      const isLast = index === steps.length - 1;

      tour.addStep({
        ...stepOptions,
        buttons: isLast
          ? [
              {
                text: "Done ✓",
                classes: "shepherd-button-primary",
                action() {
                  localStorage.setItem(TOUR_SEEN_KEY(role), "true");
                  tour.complete();
                },
              },
            ]
          : [
              {
                text: "Skip Tour",
                classes: "shepherd-button-secondary",
                action() {
                  localStorage.setItem(TOUR_SEEN_KEY(role), "true");
                  tour.cancel();
                },
              },
              {
                text: "Next →",
                classes: "shepherd-button-primary",
                action() {
                  tour.next();
                },
              },
            ],
      });
    });

    tour.on("complete", () => {
      localStorage.setItem(TOUR_SEEN_KEY(role), "true");
    });
    tour.on("cancel", () => {
      localStorage.setItem(TOUR_SEEN_KEY(role), "true");
    });

    tourRef.current = tour;
    return tour;
  }, [role, steps]);

  useEffect(() => {
    if (!autoStart) return;
    const alreadySeen = localStorage.getItem(TOUR_SEEN_KEY(role)) === "true";
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      const tour = buildTour();
      tour.start();
    }, 600);

    return () => clearTimeout(timer);
  }, [autoStart, buildTour, role]);

  const startTour = useCallback(() => {
    const tour = buildTour();
    tour.start();
  }, [buildTour]);

  return { startTour };
}