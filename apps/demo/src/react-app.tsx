import { useEffect, useRef, useState } from 'react';
import { Chart } from '@sulacharts/react';
import { createBarConfig, createLineConfig, createPieConfig, randomizeLineConfig } from './sample-data';

export function ReactDemoApp() {
  const [lineConfig, setLineConfig] = useState(createLineConfig);
  const [barConfig] = useState(createBarConfig);
  const [pieConfig] = useState(createPieConfig);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [proof, setProof] = useState('Click "Randomize now" or wait for the next auto-update…');

  const lineContainerRef = useRef<HTMLDivElement>(null);
  // Captured explicitly at the moment a randomize is triggered (not
  // passively on every render/mount) — React 18 StrictMode's dev-only
  // double-invoke recreates the chart instance once during the initial
  // mount, so seeding this from a mount-time effect would occasionally
  // compare against that since-replaced instance and report a false
  // "changed" on the very first check. Capturing it inside randomize()
  // instead means it's always read well after that mount-time churn has
  // settled, same as the actual production behavior (StrictMode's
  // double-invoke doesn't happen outside dev mode).
  const beforeUpdateSvgRef = useRef<Element | null>(null);

  const randomize = () => {
    beforeUpdateSvgRef.current = lineContainerRef.current?.querySelector('svg') ?? null;
    setLineConfig((prev) => randomizeLineConfig(prev));
  };

  useEffect(() => {
    if (!autoUpdate) return;
    const id = setInterval(randomize, 2000);
    return () => clearInterval(id);
  }, [autoUpdate]);

  useEffect(() => {
    const svg = lineContainerRef.current?.querySelector('svg') ?? null;
    if (beforeUpdateSvgRef.current && svg) {
      setProof(
        beforeUpdateSvgRef.current === svg
          ? '✅ same <svg> node across updates — patched in place, not rebuilt'
          : '⚠️ svg node changed — this would be a bug',
      );
    }
  }, [lineConfig]);

  return (
    <div className="framework-demo">
      <div className="chart-card">
        <h3>Line — live-updating</h3>
        <div ref={lineContainerRef}>
          <Chart config={lineConfig} />
        </div>
        <div className="controls">
          <button type="button" onClick={randomize}>
            Randomize now
          </button>
          <label>
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={(event) => setAutoUpdate(event.target.checked)}
            />
            Auto-update every 2s
          </label>
        </div>
        <p className="proof">{proof}</p>
      </div>
      <div className="chart-card">
        <h3>Bar — stacked</h3>
        <Chart config={barConfig} />
      </div>
      <div className="chart-card">
        <h3>Pie — donut</h3>
        <Chart config={pieConfig} />
      </div>
    </div>
  );
}
