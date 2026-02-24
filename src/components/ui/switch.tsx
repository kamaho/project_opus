"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  required?: boolean;
}

const Switch = React.forwardRef<HTMLDivElement, SwitchProps>(
  ({ checked, defaultChecked, onCheckedChange, id, className, disabled, name, value = "on", required }, ref) => {
    const filterId = React.useId().replace(/:/g, "");

    return (
      <div ref={ref} className={cn("tgl", disabled && "tgl--disabled", className)}>
        <input
          type="checkbox"
          role="switch"
          id={id}
          name={name}
          value={value}
          required={required}
          className="tgl__input"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <svg viewBox="0 0 292 142" className="tgl__svg" aria-hidden="true">
          <defs>
            <filter id={`goo-${filterId}`}>
              <feGaussianBlur stdDeviation={10} result="blur" in="SourceGraphic" />
              <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" mode="matrix" in="blur" />
            </filter>
          </defs>
          <path
            d="M71 142C31.7878 142 0 110.212 0 71C0 31.7878 31.7878 0 71 0C110.212 0 119 30 146 30C173 30 182 0 221 0C260 0 292 31.7878 292 71C292 110.212 260.212 142 221 142C181.788 142 173 112 146 112C119 112 110.212 142 71 142Z"
            className="tgl__bg"
          />
          <rect rx={6} height={64} width={12} y={39} x={64} className="tgl__icon-on" />
          <path
            d="M221 91C232.046 91 241 82.0457 241 71C241 59.9543 232.046 51 221 51C209.954 51 201 59.9543 201 71C201 82.0457 209.954 91 221 91ZM221 103C238.673 103 253 88.6731 253 71C253 53.3269 238.673 39 221 39C203.327 39 189 53.3269 189 71C189 88.6731 203.327 103 221 103Z"
            fillRule="evenodd"
            className="tgl__icon-off"
          />
          <g filter={`url(#goo-${filterId})`}>
            <rect fill="#fff" rx={29} height={58} width={116} y={42} x={13} className="tgl__center" />
            <rect fill="#fff" rx={58} height={114} width={114} y={14} x={14} className="tgl__circle tgl__circle--left" />
            <rect fill="#fff" rx={58} height={114} width={114} y={14} x={164} className="tgl__circle tgl__circle--right" />
          </g>
        </svg>
      </div>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
