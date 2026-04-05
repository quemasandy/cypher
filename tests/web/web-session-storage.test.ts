/**
 * Este archivo prueba el snapshot de sesion del adapter web.
 * Su responsabilidad es cubrir la persistencia del estado propio de la UI
 * para que una recarga del navegador no pierda el hilo visible de la investigacion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPersistedWebSessionSnapshot,
  loadPersistedWebSessionSnapshot,
  savePersistedWebSessionSnapshot
} from "../../apps/web/src/web-session-storage.js";
import { FakeBrowserStorage } from "../helpers/fake-browser-storage.js";

test("web session storage saves and reloads the active browser session snapshot", () => {
  const fakeBrowserStorage = new FakeBrowserStorage();

  savePersistedWebSessionSnapshot({
    browserStorage: fakeBrowserStorage,
    sessionSnapshot: {
      version: 1,
      seed: "tutorial-case-v1",
      activeCaseId: "case-123",
      selectedTraitCodes: ["travels-light", "prefers-night-trains"],
      publishedEvents: [
        {
          type: "CaseOpened",
          caseId: "case-123",
          currentCityId: "bogota",
          remainingTimeHours: 48
        }
      ],
      recordedTelemetryEntries: [
        {
          eventName: "case.started",
          payload: {
            caseId: "case-123"
          }
        }
      ]
    }
  });

  const restoredSessionSnapshot = loadPersistedWebSessionSnapshot({
    browserStorage: fakeBrowserStorage
  });

  assert.deepEqual(restoredSessionSnapshot, {
    version: 1,
    seed: "tutorial-case-v1",
    activeCaseId: "case-123",
    selectedTraitCodes: ["travels-light", "prefers-night-trains"],
    publishedEvents: [
      {
        type: "CaseOpened",
        caseId: "case-123",
        currentCityId: "bogota",
        remainingTimeHours: 48
      }
    ],
    recordedTelemetryEntries: [
      {
        eventName: "case.started",
        payload: {
          caseId: "case-123"
        }
      }
    ]
  });
});

test("web session storage clears the saved snapshot and tolerates invalid JSON", () => {
  const fakeBrowserStorage = new FakeBrowserStorage();

  savePersistedWebSessionSnapshot({
    browserStorage: fakeBrowserStorage,
    sessionSnapshot: {
      version: 1,
      seed: "tutorial-case-v1",
      activeCaseId: null,
      selectedTraitCodes: [],
      publishedEvents: [],
      recordedTelemetryEntries: []
    }
  });

  clearPersistedWebSessionSnapshot({
    browserStorage: fakeBrowserStorage
  });

  assert.equal(
    loadPersistedWebSessionSnapshot({
      browserStorage: fakeBrowserStorage
    }),
    null
  );

  fakeBrowserStorage.setItem("cipher:web:session", "{ definitely-not-valid-json");

  assert.equal(
    loadPersistedWebSessionSnapshot({
      browserStorage: fakeBrowserStorage
    }),
    null
  );
});
