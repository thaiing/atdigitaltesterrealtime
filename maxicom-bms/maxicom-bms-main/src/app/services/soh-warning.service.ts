import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SohWarningService {
  private totalLowSohCellsSubject = new BehaviorSubject<number>(0);
  public totalLowSohCells$: Observable<number> = this.totalLowSohCellsSubject.asObservable();

  private stringWarningsMap = new Map<string, number>(); // stringId -> count

  /**
   * Update the count of cells with SoH < 80% for a string
   */
  updateStringWarningCount(stringId: string, count: number): void {
    this.stringWarningsMap.set(stringId, count);
    this.updateTotalCount();
  }

  /**
   * Remove warning for a string (when string is deleted)
   */
  removeStringWarning(stringId: string): void {
    this.stringWarningsMap.delete(stringId);
    this.updateTotalCount();
  }

  /**
   * Calculate total number of cells with SoH < 80% from all strings
   */
  private updateTotalCount(): void {
    let total = 0;
    this.stringWarningsMap.forEach(count => {
      total += count;
    });
    this.totalLowSohCellsSubject.next(total);
  }

  /**
   * Get current total number of cells with SoH < 80%
   */
  getTotalLowSohCells(): number {
    return this.totalLowSohCellsSubject.value;
  }
}

