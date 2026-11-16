import { palette } from "../engine/asterion-renderer";
import css from "./asterion.module.css";
export function Ejection({
  nickname,
  color,
  role,
}: {
  nickname: string;
  color: number;
  role?: string;
}) {
  return (
    <div>
      <div
        className={css.ejection}
        role="img"
        aria-label={`${nickname} покидает станцию через шлюз`}
      >
        <div className={css.ejected}>
          <svg viewBox="0 0 80 90" aria-hidden="true">
            <path
              d="M20 28h40v43H20z"
              fill={palette[color % 10]}
              stroke="#081a34"
              strokeWidth="5"
            />
            <rect
              x="14"
              y="12"
              width="52"
              height="35"
              rx="12"
              fill={palette[color % 10]}
              stroke="#081a34"
              strokeWidth="5"
            />
            <rect x="23" y="23" width="34" height="12" rx="4" fill="#123550" />
            <circle cx="32" cy="29" r="3" fill="#d9fff7" />
            <circle cx="49" cy="29" r="3" fill="#d9fff7" />
            <path
              d="M28 72v12m24-12v12M40 12V4"
              stroke="#081a34"
              strokeWidth="8"
            />
            <circle cx="40" cy="5" r="4" fill="#58cc02" />
          </svg>
        </div>
      </div>
      <p>
        {nickname} покидает станцию.
        {role && ` Роль: ${role === "crew" ? "Экипаж" : "Предатель"}.`}
      </p>
    </div>
  );
}
