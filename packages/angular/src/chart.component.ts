import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { Chart as CoreChart } from '@chart-lib/core';
import type { ChartConfig, ChartEventMap } from '@chart-lib/core';

/**
 * Thin Angular binding over the framework-agnostic core engine — mirrors
 * the React wrapper's responsibilities (mount, patch on input change,
 * destroy), but Angular's zone.js means there's a second concern React
 * doesn't have: zone.js globally patches addEventListener and
 * requestAnimationFrame, so without care, every chart hover/click and every
 * mount-animation frame the core engine triggers would also trigger a full
 * Angular change-detection pass — the exact "render loop vs. change
 * detection" conflict this project exists to solve for Angular. All core
 * instantiation/update/destroy work below runs inside
 * ngZone.runOutsideAngular() so those internal DOM operations don't
 * re-enter Angular's zone; the only things Angular is told about are the
 * @Output emissions, explicitly re-entered via ngZone.run().
 *
 * Selector is a placeholder pending the library name decision (see
 * "Open Decisions" in the project brief).
 */
@Component({
  selector: 'chart-lib',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { style: 'display: block;' },
})
export class ChartComponent<T = unknown> implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) config!: ChartConfig<T>;
  @Output() readonly dataPointClick = new EventEmitter<ChartEventMap<T>['click']>();
  @Output() readonly dataPointHover = new EventEmitter<ChartEventMap<T>['hover']>();

  private chart: CoreChart<T> | undefined;
  private readonly isBrowser: boolean;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly ngZone: NgZone,
    // Not using @angular/common's isPlatformBrowser() here — that pulls in
    // Ivy partially-compiled code (PlatformNavigation) which needs the
    // Angular Linker or the JIT compiler to load outside a full Angular
    // CLI build pipeline. isPlatformBrowser is a one-line check internally
    // (platformId === 'browser'), so inlining it avoids the dependency and
    // the loading gotcha entirely.
    @Inject(PLATFORM_ID) platformId: unknown,
  ) {
    this.isBrowser = platformId === 'browser';
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.ngZone.runOutsideAngular(() => {
      const chart = new CoreChart<T>(this.elementRef.nativeElement, this.config);
      chart.on('click', (payload) => this.ngZone.run(() => this.dataPointClick.emit(payload)));
      chart.on('hover', (payload) => this.ngZone.run(() => this.dataPointHover.emit(payload)));
      this.chart = chart;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // No chart yet means this is the initial binding, handled by the
    // constructor call above once ngAfterViewInit runs — nothing to patch.
    if (!this.chart || !changes['config']) return;
    this.ngZone.runOutsideAngular(() => {
      this.chart!.update(this.config);
    });
  }

  ngOnDestroy(): void {
    this.ngZone.runOutsideAngular(() => {
      this.chart?.destroy();
    });
    this.chart = undefined;
  }
}
