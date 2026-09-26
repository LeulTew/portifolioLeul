import { describe, it, expect } from "vitest";
import { FEATURED_PROJECT_IDS, IMAGE_KIND_LABEL, projectTier, projectsData } from "./projects";
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

  it("says what every preview image is, and tells artwork from a genuine interface capture", () => {
    // Round 8 (D-BRAND-002): captures, mockups and artwork sat in one hierarchy, unlabelled.
    for (const project of projectsData) {
      expect(Object.keys(IMAGE_KIND_LABEL), project.title).toContain(project.imageKind);
    }
    const luna = projectsData.find(project => project.title === "Luna")!;
    const portfolio = projectsData.find(project => project.id === 4)!;
    expect(luna.imageAlt).toMatch(/artwork, not an interface screenshot/i);
    expect(luna.imageKind).toBe("artwork");
    expect(portfolio.imageKind).toBe("interface");
    for (const project of [luna, portfolio]) {
      expect(statSync(resolve("public", ...project.image.split("/").filter(Boolean))).size)
        .toBeLessThanOrEqual(220_000);
    }
  });

  it("shows each live demo it could capture as its own desktop interface, not a mockup or phone crop", () => {
    // Round 9 (D-BRAND-002): Kitefew and AgendaFlow showed staged mockups; five others were
    // phone-width or tiny crops. Each is now a 16:10 desktop capture of its own live demo.
    const recaptured = ["Kitefew", "AgendaFlow AI", "Elona Practice", "EthioDriveMaster",
      "System Design Guide", "CS Exit Practice", "Dream Weaver"];
    for (const title of recaptured) {
      const project = projectsData.find(item => item.title === title)!;
      expect(project.imageKind, title).toBe("interface");
      expect(project.demoUrl, title).toBeTruthy();
      const bytes = readFileSync(resolve("public", ...project.image.split("/").filter(Boolean)));
      expect(bytes.length, title).toBeLessThanOrEqual(80_000);
      // A lossy VP8 frame stores its size at bytes 26-29: 14 bits of width, then of height.
      expect(bytes.subarray(12, 16).toString(), title).toBe("VP8 ");
      const width = bytes.readUInt16LE(26) & 0x3fff;
      const height = bytes.readUInt16LE(28) & 0x3fff;
      expect(width / height, title).toBeCloseTo(1.6, 2);
      expect(width, title).toBeGreaterThanOrEqual(1280);
    }
  });

  it("leads with a small set of genuine, inspectable work and keeps the rest as a labelled archive", () => {
    // Round 10 (D-BRAND-002): 36 records of uneven evidence shared one primary role, led by an empty ledger.
    expect(FEATURED_PROJECT_IDS.length).toBeGreaterThanOrEqual(4);
    expect(FEATURED_PROJECT_IDS.length).toBeLessThanOrEqual(8);
    expect(projectsData.slice(0, FEATURED_PROJECT_IDS.length).map(project => project.id)).toEqual([...FEATURED_PROJECT_IDS]);
    for (const project of projectsData.slice(0, FEATURED_PROJECT_IDS.length)) {
      expect(project.imageKind, project.title).toBe("interface");
      expect(Boolean(project.demoUrl || project.githubUrl), project.title).toBe(true);
      expect(projectTier(project)).toBe("Selected work");
    }
    expect(projectsData.slice(FEATURED_PROJECT_IDS.length).every(project => projectTier(project) === "Archive")).toBe(true);
  });

  it("describes what each project's own source shows, without borrowed features or superlatives", () => {
    // Round 10 audit: seven descriptions claimed features their repositories and demos do not have.
    const byTitle = (title: string) => projectsData.find(project => project.title === title)!;
    const copy = (title: string) => {
      const project = byTitle(title);
      return `${project.description} ${project.longDescription ?? ""} ${project.tech}`;
    };
    expect(copy("Dream Weaver")).not.toMatch(/gemini|interpret|psycholog/i);
    expect(byTitle("Dream Weaver").categories).not.toContain("AI/DataScience");
    expect(copy("Ethio Trading")).not.toMatch(/real-time|secure messaging|backend integration/i);
    expect(copy("Elona Practice")).toMatch(/Chemistry of Natural Products/);
    expect(copy("Bookbot")).toMatch(/word/i);
    expect(copy("Bookbot")).not.toMatch(/book lists|reading workflows/i);
    expect(copy("Amet AI")).not.toMatch(/semantic|any verse/i);
    expect(copy("Spider Solitaire C#")).not.toMatch(/save\/load|scoring|modular/i);
    expect(copy("Samadhi")).not.toMatch(/static-site|NEXT\.JS|MDX/i);
    expect(copy("Car Rental Platform")).not.toMatch(/JWT/);
    expect(copy("CS Exit Practice")).not.toMatch(/WebAssembly/);
    for (const project of projectsData) {
      expect(`${project.description} ${project.longDescription ?? ""}`, project.title)
        .not.toMatch(/\b(definitive|next-gen|hyper-modern|mastering|world-class|cutting-edge)\b/i);
    }
  });

  it("adds inspection notes only to the researched projects", () => {
    expect(projectsData.filter(project => project.evidence).map(project => project.title))
      .toEqual(["Portfolio Leul", "Ignition", "Car Rental Platform", "Kitefew", "AgendaFlow AI", "CS Exit Practice", "Mizan", "ProtoChem 3D", "Amharic IR Improved"]);
    for (const project of projectsData.filter(project => project.evidence)) {
      expect(project.evidence!.inspect.length).toBeGreaterThan(0);
      expect(project.evidence!.access?.length).toBeGreaterThan(0);
      expect(project.longDescription).toBeTruthy();
    }
  });

  it("pins each implementation claim to inspectable source, not a moving branch", () => {
    const decisions = projectsData.flatMap(project => project.evidence?.decision
      ? [project.evidence.decision] : []);
    expect(decisions).toHaveLength(5);
    for (const decision of decisions) {
      expect(decision.summary).toBeTruthy();
      expect(decision.sourceLabel).toBeTruthy();
      const url = new URL(decision.sourceUrl);
      expect(url.origin).toBe("https://github.com");
      expect(url.pathname).toMatch(/^\/LeulTew\/[^/]+\/blob\/[a-f0-9]{40}\//);
      expect(url.hash).toMatch(/^#L\d+-L\d+$/);
    }
  });

  it("links only source a visitor can open", () => {
    // Round 11: six repositories are private, so their Source links and ProtoChem's source pin were 404s.
    const privateRepositories = ["chem-hands-3d", "AgendaFlow-AI", "Samadhi", "bible-learn-webapp", "system-design-guide-blog", "ArchGuide"];
    for (const project of projectsData) {
      const links = [project.githubUrl, project.evidence?.decision?.sourceUrl].filter(Boolean).join(" ");
      for (const repository of privateRepositories) expect(links, project.title).not.toContain(`/LeulTew/${repository}`);
    }
    expect(projectsData.find(project => project.title === "ProtoChem 3D")!.evidence?.sourceNote).toMatch(/private/);
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
