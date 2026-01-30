declare module 'potrace' {
  export interface PotraceOptions {
    turdSize?: number;
    turnPolicy?: string;
    alphaMax?: number;
    optCurve?: boolean;
    optTolerance?: number;
    threshold?: number;
    blackOnWhite?: boolean;
    color?: string;
    background?: string;
  }

  export interface PosterizeOptions extends PotraceOptions {
    steps?: number | number[];
    fillStrategy?: string;
    rangeDistribution?: string;
  }

  export type TraceCallback = (err: Error | null, svg: string) => void;

  export function trace(
    file: string | Buffer,
    options: PotraceOptions,
    callback: TraceCallback
  ): void;

  export function trace(
    file: string | Buffer,
    callback: TraceCallback
  ): void;

  export function posterize(
    file: string | Buffer,
    options: PosterizeOptions,
    callback: TraceCallback
  ): void;

  export function posterize(
    file: string | Buffer,
    callback: TraceCallback
  ): void;
}
