import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { ChartComponent } from '@chart-lib/angular';
import type { ChartConfig } from '@chart-lib/core';
import { createBarConfig, createLineConfig, createPieConfig, randomizeLineConfig } from './sample-data';

@Component({
  selector: 'chart-demo-root',
  standalone: true,
  imports: [ChartComponent],
  template: `
    <div class="framework-demo">
      <div class="chart-card">
        <h3>Line — live-updating</h3>
        <div #lineContainer>
          <chart-lib [config]="lineConfig"></chart-lib>
        </div>
        <div class="controls">
          <button type="button" (click)="randomizeNow()">Randomize now</button>
          <label>
            <input type="checkbox" [checked]="autoUpdate" (change)="toggleAutoUpdate($event)" />
            Auto-update every 2s
          </label>
        </div>
        <p class="proof">{{ proof }}</p>
      </div>
      <div class="chart-card">
        <h3>Bar — stacked</h3>
        <chart-lib [config]="barConfig"></chart-lib>
      </div>
      <div class="chart-card">
        <h3>Pie — donut</h3>
        <chart-lib [config]="pieConfig"></chart-lib>
      </div>
    </div>
  `,
})
export class DemoAngularRootComponent implements AfterViewInit, OnDestroy {
  @ViewChild('lineContainer') lineContainerRef!: ElementRef<HTMLElement>;

  lineConfig: ChartConfig = createLineConfig();
  readonly barConfig: ChartConfig = createBarConfig();
  readonly pieConfig: ChartConfig = createPieConfig();
  autoUpdate = true;
  proof = 'Click "Randomize now" or wait for the next auto-update…';

  private intervalId: ReturnType<typeof setInterval> | undefined;
  private lastSvg: Element | null = null;

  ngAfterViewInit(): void {
    // Seeds lastSvg with the chart's initial node so the *first* randomize
    // actually proves something — without this, the first call would just
    // capture a reference with nothing yet to compare it against (child
    // ngAfterViewInit hooks run before the parent's, so ChartComponent's
    // <svg> already exists here).
    this.checkSvgStability();
    this.startAutoUpdate();
  }

  randomizeNow(): void {
    this.lineConfig = randomizeLineConfig(this.lineConfig);
    // Deferred rather than checked synchronously in the same tick: reading
    // the DOM immediately after reassigning the input would race Angular's
    // own change-detection pass applying it to the child component.
    setTimeout(() => this.checkSvgStability(), 0);
  }

  toggleAutoUpdate(event: Event): void {
    this.autoUpdate = (event.target as HTMLInputElement).checked;
    if (this.autoUpdate) {
      this.startAutoUpdate();
    } else {
      this.stopAutoUpdate();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoUpdate();
  }

  private startAutoUpdate(): void {
    this.stopAutoUpdate();
    if (!this.autoUpdate) return;
    this.intervalId = setInterval(() => this.randomizeNow(), 2000);
  }

  private stopAutoUpdate(): void {
    if (this.intervalId !== undefined) clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  private checkSvgStability(): void {
    const svg = this.lineContainerRef?.nativeElement.querySelector('svg') ?? null;
    if (this.lastSvg && svg) {
      this.proof =
        this.lastSvg === svg
          ? '✅ same <svg> node across updates — patched in place, not rebuilt'
          : '⚠️ svg node changed — this would be a bug';
    }
    this.lastSvg = svg;
  }
}
