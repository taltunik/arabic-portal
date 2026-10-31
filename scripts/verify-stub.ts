export const Page = () => null;
export const Section = () => null;
export const Callout = () => null;
export const Button = () => null;
export const Table = () => null;
export const Input = () => null;
export const Status = () => null;
export const Divider = () => null;
export function useState<T>(v: T): [T, (n: T) => void] {
  return [v, () => {}];
}
export function useMemo<T>(fn: () => T): T {
  return fn();
}
export function useEffect(): void {}
export function useRef<T>(v: T): { current: T } {
  return { current: v };
}
export function useGrokTheme(): Record<string, never> {
  return {};
}
export type ReactNode = unknown;
