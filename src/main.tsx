import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Globally prevent browser Pointer Lock so hosting on Netlify or any top-level domain
// never locks the aiming cursor or displays "Press Esc to see cursor"
if (typeof window !== 'undefined' && typeof Element !== 'undefined') {
  try {
    Element.prototype.requestPointerLock = function () {
      return Promise.resolve();
    };
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    });
  } catch {
    // Ignore if environment restricts prototype assignment
  }
}

createRoot(document.getElementById('root')!).render(<App />);

