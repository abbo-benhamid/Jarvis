import { describe, expect, it } from "vitest";
import { addMonths, parseTestEndDate, testDataDeadline } from "./purge";

describe("durées de conservation : dates (M6, B2)", () => {
  it("lit TEST_END_DATE au format AAAA-MM-JJ (fin de journée UTC)", () => {
    expect(parseTestEndDate("2026-12-31")?.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    expect(parseTestEndDate("")).toBeNull();
    expect(parseTestEndDate(undefined)).toBeNull();
    expect(parseTestEndDate("31/12/2026")).toBeNull();
    expect(parseTestEndDate("2026-13-45")).toBeNull();
  });

  it("garde avis et mesures jusqu'à fin du test + 6 mois", () => {
    expect(testDataDeadline(parseTestEndDate("2026-12-31"))?.toISOString().slice(0, 10)).toBe("2027-07-01");
    expect(testDataDeadline(null)).toBeNull();
    expect(addMonths(new Date("2026-10-05T00:00:00Z"), -6).toISOString().slice(0, 10)).toBe("2026-04-05");
  });
});
