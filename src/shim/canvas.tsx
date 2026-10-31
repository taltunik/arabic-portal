import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export { useEffect, useMemo, useRef, useState };
export type { ReactNode };

export type Theme = {
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
    accentDeep: string;
    success: string;
    successDeep: string;
    danger: string;
    dangerDeep: string;
    warningDeep: string;
  };
  font: {
    family: string;
    heading3: { fontSize: number };
    body1: { fontSize: number };
    body2: { fontSize: number };
    label: { fontSize: number };
    subtext: { fontSize: number };
  };
  weight: { semibold: number };
  radius: { md: number; lg: number; full: number };
  border: { default: string };
  bg: { base: string; elevated: string; subtle: string };
  fill: { accentSubtle: string; successSubtle: string; dangerSubtle: string; warningSubtle: string };
};

const FONT = '"Noto Sans Hebrew", "Noto Naskh Arabic", "Rubik", "Amiri", sans-serif';

const theme: Theme = {
  text: {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    tertiary: "var(--text-tertiary)",
    accent: "var(--text-accent)",
    accentDeep: "var(--text-accent-deep)",
    success: "var(--text-success)",
    successDeep: "var(--text-success-deep)",
    danger: "var(--text-danger)",
    dangerDeep: "var(--text-danger-deep)",
    warningDeep: "var(--text-warning-deep)",
  },
  font: {
    family: FONT,
    heading3: { fontSize: 20 },
    body1: { fontSize: 17 },
    body2: { fontSize: 15 },
    label: { fontSize: 13 },
    subtext: { fontSize: 13 },
  },
  weight: { semibold: 600 },
  radius: { md: 10, lg: 14, full: 999 },
  border: { default: "var(--border)" },
  bg: {
    base: "var(--bg-base)",
    elevated: "var(--bg-elevated)",
    subtle: "var(--bg-subtle)",
  },
  fill: {
    accentSubtle: "var(--fill-accent)",
    successSubtle: "var(--fill-success)",
    dangerSubtle: "var(--fill-danger)",
    warningSubtle: "var(--fill-warning)",
  },
};

export function useGrokTheme(): Theme {
  return theme;
}

export function Page(props: { title: string; summary?: string; width?: "column" | "full"; children?: ReactNode }) {
  return (
    <main className={props.width === "full" ? "page page-full" : "page page-column"} dir="rtl" lang="he">
      <header className="page-header">
        <h1>{props.title}</h1>
        {props.summary ? <p className="page-summary">{props.summary}</p> : null}
      </header>
      {props.children}
    </main>
  );
}

export function Section(props: { heading?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section className="section">
      {props.heading || props.actions ? (
        <div className="section-head">
          {props.heading ? <h2>{props.heading}</h2> : <span />}
          {props.actions ? <div className="section-actions">{props.actions}</div> : null}
        </div>
      ) : null}
      <div className="section-body">{props.children}</div>
    </section>
  );
}

export function Callout(props: { lead?: string; tone?: "info" | "warning" | "success" | "neutral"; children?: ReactNode }) {
  return (
    <aside className={"callout " + (props.tone ?? "neutral")}>
      {props.lead ? <div className="callout-lead">{props.lead}</div> : null}
      <div className="callout-body">{props.children}</div>
    </aside>
  );
}

export function Button(props: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "quiet" | "default";
  disabled?: boolean;
}) {
  const variant = props.variant ?? "default";
  return (
    <button type="button" className={"btn btn-" + variant} onClick={props.onClick} disabled={props.disabled}>
      {props.label}
    </button>
  );
}

type CellTone = "success" | "warning" | "danger" | "info";
type Cell = ReactNode | { text: string; tone?: CellTone };

function isToneCell(cell: Cell): cell is { text: string; tone?: CellTone } {
  return !!cell && typeof cell === "object" && !Array.isArray(cell) && "text" in cell && !("$$typeof" in (cell as object));
}

export function Table(props: {
  columns: string[];
  align?: ("start" | "center" | "end")[];
  rows: Cell[][];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {props.columns.map((col, i) => (
              <th key={i} style={{ textAlign: props.align?.[i] ?? "start" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ textAlign: props.align?.[ci] ?? "start" }}>
                  {isToneCell(cell) ? <span className={"cell-tone " + (cell.tone ?? "")}>{cell.text}</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Input(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useMemo(() => "f-" + Math.random().toString(36).slice(2, 8), []);
  return (
    <label className="field" htmlFor={id}>
      <span>{props.label}</span>
      <input id={id} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

export function Status(props: { tone?: "success" | "warning" | "danger" | "info"; children?: ReactNode }) {
  return (
    <div className={"status " + (props.tone ?? "info")} role="status">
      {props.children}
    </div>
  );
}

export function Divider() {
  return <hr className="divider" />;
}
