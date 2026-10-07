// Listens for "new result arrived" events and calls onEvent when one comes in.
//
// Mock mode: listens for a browser event you can trigger yourself (see triggerMockEvent),
//            and optionally fires fake events on a timer.
// Real mode: connects to the FastAPI WebSocket and reconnects if it drops.
import { useEffect, useRef, useState } from "react";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
const WS_URL = import.meta.env.VITE_WS_URL; // e.g. ws://localhost:8000/ws/updates
const MOCK_INTERVAL_MS = Number(import.meta.env.VITE_MOCK_LIVE_INTERVAL_MS) || 0; // 0 = off
const MOCK_EVENT_NAME = "mock-live-event";

// Call this from the browser console or a dev button to simulate a new result:
//   triggerMockEvent({ type: "run_ingested", runId: 102, scenarioId: 2 })
export function triggerMockEvent(event) {
  window.dispatchEvent(new CustomEvent(MOCK_EVENT_NAME, { detail: event }));
}

// Only accept events in the shape we expect. Never trust incoming messages blindly.
function isValidEvent(event) {
  return (
    event &&
    typeof event === "object" &&
    typeof event.type === "string" &&
    (event.runId === undefined || Number.isInteger(event.runId)) &&
    (event.scenarioId === undefined || Number.isInteger(event.scenarioId))
  );
}

export function useLiveUpdates(onEvent) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);

  // Keep the latest callback without reconnecting every render
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    const handle = (event) => {
      if (!isValidEvent(event)) return;
      setLastEvent(event);
      onEventRef.current?.(event);
    };

    // ---------- Mock mode ----------
    if (USE_MOCKS) {
      setConnected(true);
      const listener = (e) => handle(e.detail);
      window.addEventListener(MOCK_EVENT_NAME, listener);

      let timer;
      if (MOCK_INTERVAL_MS > 0) {
        timer = setInterval(() => {
          handle({ type: "run_ingested", runId: 100 + Math.floor(Math.random() * 10) });
        }, MOCK_INTERVAL_MS);
      }

      // Expose for quick testing in the browser console (dev only)
      window.triggerMockEvent = triggerMockEvent;

      return () => {
        window.removeEventListener(MOCK_EVENT_NAME, listener);
        clearInterval(timer);
        setConnected(false);
      };
    }

    // ---------- Real WebSocket mode ----------
    if (!WS_URL) {
      console.warn("useLiveUpdates: VITE_WS_URL not set, live updates disabled");
      return;
    }

    let socket;
    let retryTimer;
    let retryDelay = 1000;      // start at 1s
    const MAX_DELAY = 30000;    // cap at 30s
    let closedByUs = false;

    const connect = () => {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        setConnected(true);
        retryDelay = 1000; // reset backoff after a good connection
      };

      socket.onmessage = (msg) => {
        try {
          handle(JSON.parse(msg.data));
        } catch {
          // Ignore anything that isn't valid JSON
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (closedByUs) return;
        // Reconnect with exponential backoff so we don't hammer the server
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return { connected, lastEvent };
}