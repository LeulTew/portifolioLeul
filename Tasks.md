# Portfolio Project Tasks

*   [ ] **Phase 0: Project Setup & Guidelines**
    *   [ ] **0.1. Define Project Goals:** Clearly articulate the primary objectives of the portfolio website in `DOCUMENT.md`.
    *   [ ] **0.2. Establish Coding Standards:** Ensure linters (ESLint) and formatters (Prettier) are configured and enforced. Document any specific conventions.
    *   [ ] **0.3. TDD/Testing Approach:** Define the testing strategy (Unit, Integration, E2E). While TDD might be overkill for some portfolio parts, ensure critical components (e.g., contact form logic) have tests. Add testing tasks where relevant (`#TEST`).
    *   [ ] **0.4. Version Control:** Maintain clean Git history with meaningful commit messages. Use branches for features/fixes.

---

*   [x] **Phase 1: Documentation (`DOCUMENT.md`) Creation** ✅
    *   [x] **1.1. Plan `DOCUMENT.md` Structure:** Define sections relevant to the portfolio project. ✅
    *   [x] **1.2. Write Section 1: Introduction:** Briefly introduce the project and the purpose of the document. ✅
    *   [x] **1.3. Write Section 2: Project Goal & Vision:** Elaborate on the portfolio's objectives. ✅
    *   [x] **1.4. Write Section 3: Features:** List core user-facing and technical features based on current codebase analysis. ✅
        *   [x] **1.4.1.** Analyze `src/App.tsx` and `src/components/sections/*` for main features. ✅
    *   [x] **1.5. Write Section 4: Tech Stack:** List all technologies, libraries, and frameworks used. Analyze `package.json`. ✅
    *   [x] **1.6. Write Section 5: Project Structure:** Explain the layout of directories and key files. ✅
    *   [x] **1.7. Write Section 6: Setup & Running Locally:** Provide clear instructions based on `package.json` scripts and Vite config. ✅
    *   [x] **1.8. Write Section 7: Architecture & Design Decisions:** Document key choices made during development. ✅
        *   [x] **1.8.1.** Explain choice of React/Vite. ✅
        *   [x] **1.8.2.** Explain choice of Tailwind CSS / CSS Modules. ✅
        *   [x] **1.8.3.** Detail the approach for 3D elements (React Three Fiber). Analyze `src/components/3d/Experience.tsx`, `src/components/BackgroundScene.tsx`. ✅
        *   [x] **1.8.4.** Describe state management approach (likely component state, context, or Zustand if used). ✅
        *   [x] **1.8.5.** Explain the section-based component structure. ✅
    *   [x] **1.9. Write Section 8: Key Components Overview:** Describe important components. ✅
        *   [x] **1.9.1.** Analyze and document `src/components/Navigation.tsx`. ✅
        *   [x] **1.9.2.** Analyze and document `src/components/BackgroundScene.tsx`. ✅
        *   [x] **1.9.3.** Analyze and document `src/components/3d/Experience.tsx`. ✅
        *   [x] **1.9.4.** Analyze and document `src/components/sections/*` (Hero, About, Skills, Projects, Contact). ✅
        *   [x] **1.9.5.** Analyze and document `src/components/ui/*` (Card, CursorGlow). ✅
        *   [x] **1.9.6.** Analyze and document `src/components/sections/Contact/ContactForm.tsx` and related hooks/types. ✅
    *   [x] **1.10. Write Section 9: Content Management & Updates:** Provide instructions for updating portfolio content. ✅
        *   [x] **1.10.1.** Identify files/components needing edits for About, Skills. ✅
        *   [x] **1.10.2.** Identify files/components needing edits for Projects. ✅
        *   [x] **1.10.3.** Identify files/components needing edits for Contact Info. ✅
        *   [x] **1.10.4.** Explain how to update images/3D models in `public/`. ✅
    *   [x] **1.11. Write Section 10: Literature Review / Research Integration:** ✅
        *   [x] **1.11.1.** Define relevant research topics based on tech stack and project type. (See task 2.1) ✅
        *   [x] **1.11.2.** Integrate user-provided research findings into this section. ✅
    *   [x] **1.12. Write Section 11: Future Enhancements & Roadmap:** Brainstorm and list potential future features or improvements. ✅
    *   [x] **1.13. Write Section 12: Testing Strategy:** Detail the testing approach decided in 0.3. ✅
    *   [x] **1.14. Write Section 13: Deployment:** Document the current deployment process or planned approach. ✅
    *   [x] **1.15. Write Section 14: Contribution Guidelines (Optional):** Add if relevant. ✅
    *   [x] **1.16. Write Section 15: License:** Specify the project license. ✅
    *   [ ] **1.17. Review and Refine:** Read through the entire `DOCUMENT.md` for clarity, consistency, and accuracy.
    *   [x] **1.18. Add Citation List:** Add a consolidated list of citations at the end of the document. ✅

---

*   [ ] **Phase 2: Content & Feature Updates**
    *   [x] **2.1. Define Research Topics:** Propose topics for the Literature Review section (e.g., R3F performance, portfolio UX, SPA accessibility). (`#AI_TASK`) -> Present to user. ✅
    *   [ ] **2.2. Update Personal Information:**
        *   [ ] **2.2.1.** Identify specific text elements in `src/components/sections/About/About.tsx` to update. Get new text from user. Implement changes. (`#CONTENT`, `#USER_INPUT_NEEDED`)
        *   [ ] **2.2.2.** Identify skills data structure in `src/components/sections/Skills/Skills.tsx`. Get updated skills list/details from user. Implement changes. (`#CONTENT`, `#USER_INPUT_NEEDED`)
        *   [ ] **2.2.3.** Get new profile image file from user. Replace `public/images/leul-profile.jpg`. Update any import paths if necessary. (`#ASSET`, `#USER_INPUT_NEEDED`)
    *   [ ] **2.3. Update Project Details:**
        *   [ ] **2.3.1.** Define data structure for projects in `src/components/sections/Projects/Projects.tsx`. Get details for 2-3 real projects (title, description, tech stack, image/video link, repo link, live link) from user. Implement changes. (`#CONTENT`, `#USER_INPUT_NEEDED`)
    *   [ ] **2.4. Update Contact Information:**
        *   [ ] **2.4.1.** Identify contact detail elements in `src/components/sections/Contact/ContactInfo.tsx`. Get updated details (email, LinkedIn, GitHub, etc.) from user. Implement changes. (`#CONTENT`, `#USER_INPUT_NEEDED`)
        *   [ ] **2.4.2.** Research and select a submission method (e.g., EmailJS, Formspree, Netlify Forms, custom backend). Configure chosen service. Update `src/components/sections/Contact/useContactForm.ts` and `ContactForm.tsx` to handle submission, validation, loading states, and success/error feedback according to the chosen method. (`#FUNCTIONALITY`, `#CONFIG`, `#TEST`)
    *   [ ] **2.5. Refine 3D Assets:**
        *   [ ] **2.5.1.** Analyze `public/models/terrain-1k.glb` and `public/models/2terrain-1k.glb`. Apply Draco compression using `gltf-pipeline` or similar tool. Test compressed models in the application. (`#ASSET`, `#PERFORMANCE`, `#TOOLING`)
        *   [ ] **2.5.2.** Review lighting (`ambientLight`, `directionalLight`, etc.) and materials in `src/components/3d/Experience.tsx` and `src/components/BackgroundScene.tsx`. Adjust intensity, color, position, and material properties (e.g., roughness, metalness) for improved visual appeal and coherence with the overall design. (`#DESIGN`, `#3D`)
    *   [ ] **2.6. Implement Advanced 3D Interactions:**
        *   [ ] **2.6.1. Projects Section Interaction:** Brainstorm interaction (e.g., clicking a 3D representation opens project details). Design 3D representations for projects. Implement click handlers in R3F (`onClick`). Connect handlers to UI state to display project details. (`#DESIGN`, `#3D`, `#FUNCTIONALITY`)
        *   [ ] **2.6.2. Skills Section Interaction:** Brainstorm interaction (e.g., hovering over a skill icon triggers a 3D effect). Design 3D effects. Implement hover handlers (`onPointerOver`, `onPointerOut`). (`#DESIGN`, `#3D`, `#FUNCTIONALITY`)
        *   [ ] **2.6.3. Scroll-Linked Camera Controls:** Research libraries like `drei`'s `<ScrollControls>` or GSAP's ScrollTrigger. Design scroll-linked camera movements (e.g., moving through the scene as user scrolls down the page). Implement chosen technique, ensuring smooth performance. (`#DESIGN`, `#3D`, `#PERFORMANCE`)
    *   [ ] **2.7. Enhance Visual Polish & Effects:**
        *   [ ] **2.7.1. Loading Animation:** Design a concept (e.g., simple fade, 3D model animation). Implement using React state and potentially R3F for 3D elements. Ensure it covers initial asset loading. (`#DESIGN`, `#3D`, `#FUNCTIONALITY`)
        *   [ ] **2.7.2. Cursor Effect:** Evaluate current `CursorGlow`. Research alternative effects (e.g., shader-based trail, interactive distortion). Implement the chosen effect, ensuring it's not distracting and performs well. (`#DESIGN`, `#PERFORMANCE`)
        *   [ ] **2.7.3. Page/Section Transitions:** Choose a library (Framer Motion recommended for React). Implement animated transitions between sections/views triggered by navigation clicks or scrolling. Ensure transitions are smooth and complement the site's feel. (`#DESIGN`, `#FUNCTIONALITY`, `#PERFORMANCE`)
        *   [ ] **2.7.4. Post-processing Effects:** Research `drei` or `postprocessing` library effects (e.g., Bloom, Depth of Field, subtle noise). Select 1-2 effects that enhance the aesthetic without significantly impacting performance. Implement using `<EffectComposer>`. (`#DESIGN`, `#3D`, `#PERFORMANCE`)

---

*   [ ] **Phase 3: Polish & QA**
    *   [ ] **3.1. Performance Optimization:**
        *   [ ] **3.1.1.** Audit image sizes and formats. Ensure appropriate optimization is used (e.g., `<img loading='lazy'>`, modern formats like WebP). (`#PERFORMANCE`)
        *   [ ] **3.1.2.** Analyze component rendering performance (React DevTools Profiler). Identify and optimize costly re-renders (useMemo, useCallback, React.memo). (`#PERFORMANCE`)
        *   [ ] **3.1.3.** Run Lighthouse audits (Performance, Accessibility, Best Practices, SEO) and address actionable recommendations. (`#TEST`, `#PERFORMANCE`, `#ACCESSIBILITY`)
        *   [ ] **3.1.4.** Analyze final bundle size using `vite-plugin-inspect` or `rollup-plugin-visualizer`. Identify large dependencies or chunks. Consider code splitting where appropriate. (`#PERFORMANCE`, `#TOOLING`)
    *   [ ] **3.2. Cross-Browser & Device Testing:**
        *   [ ] **3.2.1.** Test core functionality and layout on latest versions of Chrome, Firefox, Safari, Edge. (`#TEST`)
        *   [ ] **3.2.2.** Test on representative mobile devices (iOS Safari, Android Chrome) using browser dev tools and/or real devices. Check touch interactions. (`#TEST`, `#MOBILE`)
        *   [ ] **3.2.3.** Document and fix any layout, styling, or functionality bugs identified during testing. (`#FIXME`)
    *   [ ] **3.3. Accessibility (A11y) Audit:**
        *   [ ] **3.3.1.** Run automated scans using Axe DevTools browser extension. Address violations. (`#ACCESSIBILITY`, `#TEST`)
        *   [ ] **3.3.2.** Perform thorough keyboard-only navigation testing. Ensure all interactive elements are focusable and usable in a logical order. Check visible focus indicators. (`#ACCESSIBILITY`, `#TEST`)
        *   [ ] **3.3.3.** Perform basic screen reader testing (e.g., NVDA on Windows, VoiceOver on macOS/iOS). Check if content is announced logically and interactive elements are understandable. (`#ACCESSIBILITY`, `#TEST`)
        *   [ ] **3.3.4.** Remediate issues found in 3.3.1-3.3.3, paying attention to focus management, text alternatives (`@react-three/a11y` for 3D), and color contrast, especially between UI and 3D scene. (`#FIXME`, `#ACCESSIBILITY`, `#3D`)
    *   [ ] **3.4. Final Code Review:**
        *   [ ] **3.4.1.** Run `pnpm lint` and `pnpm format` (or equivalent) and fix any reported issues. (`#TOOLING`)
        *   [ ] **3.4.2.** Manually review code for clarity, consistency, comments where necessary, and removal of console logs or unused code/imports.
    *   [ ] **3.5. Fix Navigation Issues:**
        *   [ ] **3.5.1. Scroll Linking:** Investigate libraries like `react-scroll` or implement custom logic using element IDs and `element.scrollIntoView({ behavior: 'smooth' })` to ensure clicking nav links smoothly scrolls to the correct section. (`#FIXME`, `#FUNCTIONALITY`)
        *   [ ] **3.5.2. Active State Highlighting:** Implement logic (e.g., using Intersection Observer API or scroll position tracking) to correctly add/remove an 'active' class to the corresponding navigation link based on the section currently in the viewport. (`#FIXME`, `#FUNCTIONALITY`)
        *   [ ] **3.5.3. Mobile Navigation Functionality:** Test the mobile menu toggle (hamburger icon) and links thoroughly on various device sizes. Fix any layout overlaps, non-functional links, or usability issues. Ensure it's accessible (keyboard operable, screen reader friendly). (`#FIXME`, `#MOBILE`, `#ACCESSIBILITY`, `#TEST`)
    *   [ ] **3.6. Overall Design & UX Refinement:**
        *   [ ] **3.6.1. Cohesive Aesthetic Review:** Review UI elements (buttons, cards, forms) and 3D scene elements together. Ensure consistent styling (border-radius, shadows, colors), spacing, and visual language. Aim for a unique, polished, "award-winning" feel. (`#DESIGN`, `#3D`)
        *   [ ] **3.6.2. Typographic & Color Review:** Check typography hierarchy, readability, line spacing, and font pairings across all sections. Verify color palette usage is consistent and meets WCAG contrast requirements. Adjust Tailwind config or CSS modules as needed. (`#DESIGN`, `#ACCESSIBILITY`)
        *   [ ] **3.6.3. Interaction & Responsiveness Polish:** Test interactions (hovers, clicks, transitions, 3D controls) on various screen sizes, especially touch devices. Refine 3D interactions to be intuitive on mobile (e.g., tap vs hover). Adjust layouts for optimal viewing and usability on smaller screens. (`#MOBILE`, `#DESIGN`, `#3D`, `#TEST`)
    *   [ ] **3.7. Advanced Performance Tuning for 3D:**
        *   [ ] **3.7.1. Profiling & Optimization:** Use `r3f-perf` and browser profiling tools (Performance tab) during complex animations/interactions. Identify specific bottlenecks (CPU, GPU). Consider advanced techniques like geometry baking, shader optimization, or further LOD adjustments if standard methods (instancing, merging) are insufficient. (`#PERFORMANCE`, `#3D`, `#TEST`)

---

*   [ ] **Phase 4: Deployment**
    *   [ ] **4.1. Choose Hosting Provider:** Decide on hosting (e.g., Vercel, Netlify, GitHub Pages).
    *   [ ] **4.2. Configure Build Process:** Ensure `pnpm build` works correctly for production.
    *   [ ] **4.3. Set Up Deployment Pipeline:** Configure CI/CD for automatic deployments.
    *   [ ] **4.4. Domain Configuration:** Point custom domain if applicable.
    *   [ ] **4.5. Post-Deployment Testing:** Verify the live site works as expected. (`#TEST`)

---
**Legend:**
*   `#TEST`: Task related to testing.
*   `#FIXME`: Task to fix a known bug or issue.
*   `#DESIGN`: Task related to UI/UX design or aesthetics.
*   `#CONTENT`: Task related to updating website text or data.
*   `#ASSET`: Task related to managing images, models, or other static files.
*   `#PERFORMANCE`: Task focused on optimizing speed or resource usage.
*   `#ACCESSIBILITY`: Task related to improving accessibility.
*   `#MOBILE`: Task specifically for mobile responsiveness/testing.
*   `#3D`: Task related to Three.js / React Three Fiber integration.
*   `#FUNCTIONALITY`: Task related to core logic or features.
*   `#CONFIG`: Task related to configuration files or environment variables.
*   `#USER_INPUT_NEEDED`: Task requires input or data from the user.
*   `#AI_TASK`: Task primarily performed by the AI assistant.
