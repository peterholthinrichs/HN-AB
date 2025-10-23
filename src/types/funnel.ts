export interface FunnelQuestion {
  id: string;
  question: string;
  placeholder?: string;
}

export interface FunnelState {
  isActive: boolean;
  currentStep: number;
  collectedData: Record<string, string>;
  questions: FunnelQuestion[];
}

export const DEFAULT_FUNNEL: FunnelQuestion[] = [
  {
    id: "component_type",
    question: "Heb je een vraag voor componenten, verdampers, compressoren, gaskoelers of condensors?",
    placeholder: "Bijv. verdampers"
  },
  {
    id: "type_number",
    question: "Welk typenummer heb je en zoek je een bepaalde versie?",
    placeholder: "Bijv. RTK-1234"
  },
  {
    id: "details",
    question: "Bedankt, vertel me wat je wilt weten dan ga ik voor je zoeken!",
    placeholder: "Beschrijf je vraag..."
  }
];
