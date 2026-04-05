/**
 * Este archivo prueba el adapter `LocalStorageCaseRepository`.
 * Su objetivo es demostrar que la web puede persistir y rehidratar un aggregate
 * usando el mismo serializer del caso, pero sobre un storage clave-valor simple.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { LocalStorageCaseRepository } from "@cipher/infra";
import { createBriefingCaseFixture } from "../helpers/create-briefing-case.js";
import { FakeBrowserStorage } from "../helpers/fake-browser-storage.js";

test("LocalStorageCaseRepository round-trips a case through browser storage", async () => {
  const fakeBrowserStorage = new FakeBrowserStorage();
  const localStorageCaseRepository = new LocalStorageCaseRepository({
    browserStorage: fakeBrowserStorage
  });
  const originalCaseRecord = createBriefingCaseFixture();
  originalCaseRecord.start();
  originalCaseRecord.visitLocation("harbor-warehouse");
  originalCaseRecord.travelToCity("santiago");

  const expectedCaseStatusSnapshot = originalCaseRecord.toStatusSnapshot();

  await localStorageCaseRepository.save(originalCaseRecord);

  const rehydratedCaseRecord = await localStorageCaseRepository.getById(
    originalCaseRecord.id.value
  );

  assert.ok(rehydratedCaseRecord);
  assert.deepEqual(rehydratedCaseRecord.toStatusSnapshot(), expectedCaseStatusSnapshot);
  assert.deepEqual(rehydratedCaseRecord.pullDomainEvents(), []);
});

test("LocalStorageCaseRepository deleteById removes the persisted browser snapshot", async () => {
  const fakeBrowserStorage = new FakeBrowserStorage();
  const localStorageCaseRepository = new LocalStorageCaseRepository({
    browserStorage: fakeBrowserStorage
  });
  const caseRecord = createBriefingCaseFixture();

  await localStorageCaseRepository.save(caseRecord);
  await localStorageCaseRepository.deleteById(caseRecord.id.value);

  const missingCaseRecord = await localStorageCaseRepository.getById(caseRecord.id.value);

  assert.equal(missingCaseRecord, null);
});
