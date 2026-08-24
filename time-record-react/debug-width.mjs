import { readFileSync, existsSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
const DIST = 'dist-test';
const html = readFileSync(`${DIST}/index.html`, 'utf8');
const jsFile = html.match(/assets\/(index-[\w-]+\.js)/)[1];
const bundle = readFileSync(`${DIST}/assets/${jsFile}`, 'utf8');
const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''),
  { url: 'https://example.test/tr/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
window.requestAnimationFrame = cb => window.setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = id => window.clearTimeout(id);
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.ResizeObserver = window.ResizeObserver || class { observe(){} unobserve(){} disconnect(){} };
window.URL.createObjectURL = () => 'blob:stub';
const s = window.document.createElement('script');
s.textContent = bundle;
window.document.body.appendChild(s);
await new Promise(r => setTimeout(r, 1200));
const doc = window.document;
const click = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

// bottom tab bar
const tabsRoot = doc.querySelector('.tabbar-tabs');
const list = doc.querySelector('.tabbar-list');
const trigger = doc.querySelector('.tabbar-trigger');
console.log('TABS ROOT class:', tabsRoot?.className);
console.log('LIST class:', list?.className);
console.log('TRIGGER class:', trigger?.className);
console.log('TRIGGER parent (z-10 flex div) class:', trigger?.parentElement?.className);
console.log('trigger count:', doc.querySelectorAll('.tabbar-trigger').length);

// insights range
click(doc.querySelector('.tabbar-trigger[data-tab="insights"]'));
await new Promise(r => setTimeout(r, 800));
const range = doc.querySelector('.insights-range');
const group = doc.querySelector('.insights-range-group');
const item = doc.querySelector('.insights-range-item');
const radiogroup = group?.querySelector('[role="radiogroup"]');
console.log('\nRANGE wrapper:', range?.className);
console.log('GROUP class:', group?.className);
console.log('RADIOGROUP class:', radiogroup?.className);
console.log('ITEM class:', item?.className);
window.close();
