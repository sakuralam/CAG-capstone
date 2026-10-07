// Data hooks for scenarios and runs. Pages use these instead of calling api.js directly.
import { useApi } from "./useApi";
import {
  getScenarios, getScenario, getRuns, getRun, getRunResults, getLimits, getSummary,
} from "../api/api";

// List of scenarios, optional filters e.g. { component: "LPBD" }
export function useScenarios(filters) {
  return useApi(getScenarios, [filters]);
}

export function useScenario(scenarioId) {
  return useApi(getScenario, [scenarioId], { enabled: scenarioId != null });
}

// List of runs, optional filters e.g. { scenarioId: 3 }
export function useRuns(filters) {
  return useApi(getRuns, [filters]);
}

// One run's full detail (metadata + checks)
export function useRun(runId) {
  return useApi(getRun, [runId], { enabled: runId != null });
}

// Time-series data for one run's charts
export function useRunResults(runId, options) {
  return useApi(getRunResults, [runId, options], { enabled: runId != null });
}

export function useLimits() {
  return useApi(getLimits, []);
}

// Counts for the Overview header: total / passed / failed / waiting
export function useSummary() {
  return useApi(getSummary, []);
}