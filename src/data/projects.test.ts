import { describe, it, expect } from "vitest";
import { projectsData } from "./projects";
import { PROJECT_CATEGORIES } from "@/components/sections/Projects/projectCategories";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

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

  it("ships a real WebP at every project preview URL instead of a missing SPA fallback", () => {
    for (const project of projectsData) {
      expect(project.image).toMatch(/^\/(?:images\/projects|projects)\/[\w-]+\.webp$/);
      const file = resolve("public", ...project.image.split("/").filter(Boolean));
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 4).toString(), project.title).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString(), project.title).toBe("WEBP");
    }
  });

  it("distinguishes original artwork from a genuine local interface capture", () => {
    const luna = projectsData.find(project => project.title === "Luna")!;
    const portfolio = projectsData.find(project => project.id === 4)!;
    expect(luna.imageAlt).toMatch(/artwork, not an interface screenshot/i);
    expect(luna.imageNote).toMatch(/not an interface screenshot/i);
    expect(portfolio.imageNote).toBe("Local desktop interface capture.");
    for (const project of [luna, portfolio]) {
      expect(statSync(resolve("public", ...project.image.split("/").filter(Boolean))).size)
        .toBeLessThanOrEqual(220_000);
    }
  });

  it("adds inspection notes only to the researched projects", () => {
    expect(projectsData.filter(project => project.evidence).map(project => project.title))
      .toEqual(["Mizan", "Ignition", "ProtoChem 3D", "Amharic IR Improved", "Portfolio Leul"]);
    for (const project of projectsData.filter(project => project.evidence)) {
      expect(project.evidence!.inspect.length).toBeGreaterThan(0);
      expect(project.evidence!.access?.length).toBeGreaterThan(0);
      expect(project.longDescription).toBeTruthy();
    }
  });

  it("pins each implementation claim to inspectable source, not a moving branch", () => {
    const decisions = projectsData.flatMap(project => project.evidence?.decision
      ? [project.evidence.decision] : []);
    expect(decisions).toHaveLength(4);
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

  it("credits Amharic IR as collaborative work and distinguishes local setup from a live demo", () => {
    const amharic = projectsData.find(project => project.id === 3)!;
    expect(amharic.description).toMatch(/collaborative/i);
    expect(amharic.evidence?.sourceNote).toContain("Leul Tewodros Agonafer and five co-authors");
    expect(amharic.evidence?.sourceNote).toContain("does not specify individual implementation roles");
    expect(amharic.evidence?.inspect).toMatch(/local setup/i);
    expect(amharic.evidence?.access).toContain("Gemini API key");
    expect(amharic.demoUrl).toBeUndefined();
    expect(amharic.tech).toBe("Python, Flask, Google Gemini");
    expect(amharic.evidence?.decision?.sourceUrl).toBe(
      "https://github.com/LeulTew/amharic-ir-improved/blob/4096030543826b66370f9cc9ff35b6762b8e832c/core/ranker.py#L133-L150",
    );
  });

  it("ties Portfolio Leul's frame decision to published code without implying deployment benchmarks", () => {
    const portfolio = projectsData.find(project => project.id === 4)!;
    expect(portfolio.longDescription).toContain("Project descriptions and links remain HTML");
    expect(portfolio.evidence?.inspect).toContain("reduced-motion");
    expect(portfolio.evidence?.access).toContain("3D screen is ready");
    expect(portfolio.evidence?.sourceNote).toContain("published source revision");
    expect(portfolio.evidence?.sourceNote).toContain("not unpublished optimizations");
    expect(portfolio.evidence?.decision?.summary).toContain("elapsed time between draws");
    expect(portfolio.evidence?.decision?.sourceUrl).toBe(
      "https://github.com/LeulTew/portifolioLeul/blob/8c921db0f9c946e8aace8b209f4216d8c509841b/src/lib/render/frameGate.ts#L63-L108",
    );
    expect(portfolio.demoUrl).toBeUndefined();
  });

  it.each([3, 4])("keeps project %s's evidence short enough for the TV reader", id => {
    const project = projectsData.find(item => item.id === id)!;
    const evidence = project.evidence!;
    expect(project.description.split(/\s+/).length).toBeLessThanOrEqual(15);
    expect(project.longDescription!.split(/\s+/).length).toBeLessThanOrEqual(40);
    for (const copy of [evidence.inspect, evidence.access!, evidence.sourceNote!, evidence.decision!.summary]) {
      expect(copy.split(/\s+/).length).toBeLessThanOrEqual(32);
    }
  });
});
