const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v9h12v-9" />
  </svg>
);
export const PriceIcon = () => (
  <svg {...base}>
    <path d="M4 18 9 12l4 3 7-9" />
    <path d="M15 6h5v5" />
  </svg>
);
export const HealthIcon = () => (
  <svg {...base}>
    <path d="M10 4a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z" />
    <path d="M12 9v6" />
  </svg>
);
export const ChatIcon = () => (
  <svg {...base}>
    <path d="M5 5h14v10H10l-5 4z" />
  </svg>
);
