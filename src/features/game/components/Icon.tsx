import type { SVGProps } from "react";

const shapes = {
  station: <><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M12 3v3m0 12v3M3 12h3m12 0h3m-11-1h4m-2-2v4" /></>,
  pause: <path d="M9 5v14m6-14v14" />,
  play: <path d="m9 5 11 7-11 7Z" />,
  exit: <path d="M13 5H5v14h8m-2-7h10m-4-4 4 4-4 4" />,
  person: <><circle cx="12" cy="8" r="3" /><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" /></>,
  pin: <><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  tasks: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 11h6m-6 5h6" /></>,
  lock: <><rect x="6" y="10" width="12" height="10" rx="2" /><path d="M9 10V7a3 3 0 0 1 6 0v3m-3 4v2" /></>,
  radar: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m12 12 7-7" /></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.1m4 0h.1m4 0h.1m4 0h.1M6 14h.1m4 0h8" /></>,
  up: <path d="m5 15 7-7 7 7" />,
  left: <path d="m15 5-7 7 7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  right: <path d="m9 5 7 7-7 7" />,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof shapes }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]}</svg>;
}
