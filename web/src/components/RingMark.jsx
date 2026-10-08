// Onion cross-section: concentric rings, slightly off-centre like a real bulb,
// with a sprout line. This is the project's one signature shape.
const RINGS = [
  { rx: 40, ry: 36, cy: 62, color: "#b5651d" },
  { rx: 31, ry: 28, cy: 63, color: "#c97a1a" },
  { rx: 22, ry: 20, cy: 64, color: "#b5651d" },
  { rx: 13, ry: 12, cy: 65, color: "#c97a1a" },
  { rx: 5, ry: 5, cy: 66, color: "#b5651d" },
];

export default function RingMark({ size = 40, animate = false, strokeWidth = 3, className = "" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {RINGS.map((r, i) => (
        <ellipse
          key={i}
          cx="50"
          cy={r.cy}
          rx={r.rx}
          ry={r.ry}
          stroke={r.color}
          strokeWidth={strokeWidth}
          className={animate ? "ring" : undefined}
          style={animate ? { "--i": RINGS.length - 1 - i } : undefined}
        />
      ))}
      <path d="M50 26 C50 18 48 12 44 7" stroke="#4a7c59" strokeWidth={strokeWidth} />
    </svg>
  );
}
