export interface FeeEstimateOptions {
  onError?: (error: Error) => void;
}

export class FeeEstimator {
  private baseFee: number;
  private isEstimating: boolean = false;
  private currentPromise: Promise<number> | null = null;
  private lastSuccessfulFetchAtValue: number | null = null;
  private lastErrorValue: Error | null = null;
  
  constructor(initialFee: number = 100) {
    this.baseFee = initialFee;
  }

  /**
   * Safely estimates the fee by fetching it asynchronously.
   * Utilizes an atomic state transition / locking mechanism to prevent race conditions 
   * when multiple async hooks fire simultaneously.
   */
  async estimateFee(
    networkFetcher: () => Promise<number>,
    options: FeeEstimateOptions = {}
  ): Promise<number> {
    if (this.currentPromise) {
      return this.currentPromise;
    }

    this.currentPromise = (async () => {
      try {
        this.isEstimating = true;
        const rawFee = await networkFetcher();
        
        // Ensure floating point math precision and error-boundary handler
        if (typeof rawFee !== 'number' || !Number.isFinite(rawFee) || rawFee < 0) {
            throw new Error("Invalid network fee response");
        }
        
        // Round to 7 decimal places for precision handling
        this.baseFee = Math.round(rawFee * 10000000) / 10000000;
        this.lastSuccessfulFetchAtValue = Date.now();
        this.lastErrorValue = null;
        return this.baseFee;
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.lastErrorValue = normalizedError;
        options.onError?.(normalizedError);

        // Fallback sequence: return the last known base fee
        return this.baseFee;
      } finally {
        this.isEstimating = false;
        this.currentPromise = null;
      }
    })();

    return this.currentPromise;
  }

  // Exposed for testing internal state
  get _isEstimating(): boolean {
    return this.isEstimating;
  }

  getBaseFee(): number {
    return this.baseFee;
  }

  get lastSuccessfulFetchAt(): number | null {
    return this.lastSuccessfulFetchAtValue;
  }

  get lastError(): Error | null {
    return this.lastErrorValue;
  }

  get isStale(): boolean {
    return this.lastErrorValue !== null;
  }
}
