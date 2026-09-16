import 'zone.js';
// @angular/platform-browser pulls in @angular/common's Location/
// PlatformNavigation providers, which ship as Ivy partially-compiled code —
// without the JIT compiler loaded, evaluating that import throws
// synchronously (before bootstrapApplication's own .catch() below ever
// runs), which would silently take the React half of this page down with
// it since both live in the same module. Same root cause hit in the
// Angular package's own tests (see packages/angular/src/chart.component.ts)
// — there it was cheap to just inline the one function being called;
// bootstrapApplication itself isn't something to reimplement, so here the
// fix is what the error message itself suggests.
import '@angular/compiler';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapApplication } from '@angular/platform-browser';
import { DemoAngularRootComponent } from './angular-app.component';
import { ReactDemoApp } from './react-app';
import './style.css';

bootstrapApplication(DemoAngularRootComponent).catch((error: unknown) => {
  console.error('Angular demo failed to bootstrap', error);
});

const reactContainer = document.getElementById('react-root');
if (reactContainer) {
  createRoot(reactContainer).render(
    <StrictMode>
      <ReactDemoApp />
    </StrictMode>,
  );
}
