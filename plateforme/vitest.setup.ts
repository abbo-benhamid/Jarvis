import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `server-only` lève une erreur hors de Next.js : on le neutralise en test.
vi.mock("server-only", () => ({}));
