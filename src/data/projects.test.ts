import { describe, it, expect } from "vitest";
import { projectsData } from "./projects";

describe("projectsData", () => {
  it("contains list of valid projects", () => {
    expect(projectsData.length).toBeGreaterThan(0);
  });

  it("each project has id, title, image, and categories", () => {
    projectsData.forEach((project) => {
      expect(project.id).toBeDefined();
      expect(project.title).toBeDefined();
      expect(project.image).toBeDefined();
      expect(project.categories.length).toBeGreaterThan(0);
    });
  });
});
