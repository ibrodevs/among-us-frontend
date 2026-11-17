import { palette } from "../engine/asterion-renderer";
export function PlayerBadge({
  color = 0,
  size = 48,
}: {
  color?: number;
  size?: number;
}) {
  const index = ((color % 20) + 20) % 20,
    fill = palette[index];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Оформление ${index + 1}`}
    >
      <rect
        x="13"
        y="16"
        width="38"
        height="38"
        rx="13"
        fill={fill}
        stroke="#10273d"
        strokeWidth="3"
      />
      <rect
        x="25"
        y="22"
        width="29"
        height="15"
        rx="6"
        fill="#17364c"
        stroke="#10273d"
        strokeWidth="3"
      />
      <path
        d="M30 26h11"
        stroke="#cbf6ed"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {index % 4 === 0 ? (
        <circle cx="24" cy="45" r="4" fill="#fff" />
      ) : index % 4 === 1 ? (
        <path d="M20 43h12" stroke="#fff" strokeWidth="4" />
      ) : index % 4 === 2 ? (
        <path d="M24 39l5 9H19z" fill="#fff" />
      ) : (
        <path d="M24 39l6 6-6 6-6-6z" fill="#fff" />
      )}
      <path
        d={index < 10 ? "M22 15V7" : "M17 13h29"}
        stroke="#10273d"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
