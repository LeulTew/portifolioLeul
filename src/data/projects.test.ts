import { describe, it, expect } from "vitest";
import { projectsData } from "./projects";
import { PROJECT_CATEGORIES } from "@/components/sections/Projects/projectCategories";

describe("projectsData", () => {
  it("contains list of valid projects", () => {
    expect(projectsData).toHaveLength(36);
    expect(projectsData.map(project => project.id).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 36 }, (_, index) => index + 1));
  });

  it("each project has id, title, image, and categories", () => {
    projectsData.forEach((project) => {
      expect(project.id).toBeDefined();
      expect(project.title).toBeDefined();
      expect(project.image).toBeDefined();
      expect(project.categories.length).toBeGreaterThan(0);
      project.categories.forEach(category => {
        expect(PROJECT_CATEGORIES).toContain(category);
        expect(category).not.toBe("All");
      });
      const links = [project.githubUrl, project.demoUrl].filter(Boolean);
      expect(links.length).toBeGreaterThan(0);
      links.forEach(link => expect(new URL(link!).protocol).toBe("https:"));
    });
  });

  it("adds inspection notes only to the three researched projects", () => {
    expect(projectsData.filter(project => project.evidence).map(project => project.title))
      .toEqual(["Mizan", "Ignition", "ProtoChem 3D"]);
    for (const project of projectsData.filter(project => project.evidence)) {
      expect(project.evidence!.inspect.length).toBeGreaterThan(0);
      expect(project.evidence!.access?.length).toBeGreaterThan(0);
      expect(project.longDescription).toBeTruthy();
    }
  });

  it("pins each implementation claim to inspectable source, not a moving branch", () => {
    const decisions = projectsData.flatMap(project => project.evidence?.decision
      ? [project.evidence.decision] : []);
    expect(decisions).toHaveLength(2);
    for (const decision of decisions) {
      expect(decision.summary).toBeTruthy();
      expect(decision.sourceLabel).toBeTruthy();
      const url = new URL(decision.sourceUrl);
      expect(url.origin).toBe("https://github.com");
      expect(url.pathname).toMatch(/^\/LeulTew\/[^/]+\/blob\/[a-f0-9]{40}\//);
      expect(url.hash).toMatch(/^#L\d+-L\d+$/);
    }
  });

  it("does not invent public source evidence for the sign-in-only ledger", () => {
    const mizan = projectsData.find(project => project.title === "Mizan")!;
    expect(mizan.githubUrl).toBe("");
    expect(mizan.evidence?.decision).toBeUndefined();
    expect(mizan.evidence?.access).toMatch(/sign-in required/i);
    expect(mizan.evidence?.sourceNote).toMatch(/no implementation source is linked/i);
  });
});
