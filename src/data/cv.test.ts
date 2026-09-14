import { describe, it, expect } from "vitest";
import { cvData } from "./cv";

describe("cvData", () => {
  it("contains valid title and subtitle", () => {
    expect(cvData.about.title).toBe("Software Engineer & Creative Developer");
    expect(cvData.about.subtitle).toBeDefined();
    expect(cvData.about.description).toBeDefined();
  });

  it("contains skills with non-empty categories", () => {
    expect(cvData.skills.length).toBeGreaterThan(0);
    cvData.skills.forEach((cat) => {
      expect(cat.title).toBeDefined();
      expect(cat.items.length).toBeGreaterThan(0);
    });
  });

  it("contains education and certifications", () => {
    expect(cvData.education.length).toBeGreaterThan(0);
    expect(cvData.certifications.length).toBeGreaterThan(0);
  });

  it("keeps completion totals separate from the featured credential selection", () => {
    for (const entry of cvData.certifications) {
      expect(Number.isSafeInteger(entry.completedAtLeast)).toBe(true);
      expect(entry.completedAtLeast).toBeGreaterThanOrEqual(entry.items.length);
      expect(["courses & projects", "certifications"]).toContain(entry.completionUnit);
    }
  });

  it("contains contact info and social links", () => {
    expect(cvData.contact.email).toBe("leulman2@gmail.com");
    expect(cvData.contact.social.github).toBeDefined();
    expect(cvData.contact.social.linkedin).toBeDefined();
  });
});
