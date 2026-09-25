export interface ProjectEvidence {
  inspect: string;
  access?: string;
  sourceNote?: string;
  decision?: {
    summary: string;
    sourceLabel: string;
    sourceUrl: string;
  };
}

/**
 * What a project's preview image is, stated for every project so a capture,
 * a staged mockup and artwork are never read as the same evidence (round 8,
 * D-BRAND-002).
 */
export type ProjectImageKind = 'interface' | 'mockup' | 'artwork';

export const IMAGE_KIND_LABEL: Record<ProjectImageKind, string> = {
  interface: 'Interface capture',
  mockup: 'Presentation mockup',
  artwork: 'Project artwork',
};

export interface Project {
  id: number;
  title: string;
  description: string;
  longDescription?: string;
  tech: string;
  image: string;
  imageKind: ProjectImageKind;
  imageAlt?: string;
  /** Anything more the image needs said, after its kind. */
  imageNote?: string;
  githubUrl: string;
  demoUrl?: string;
  categories: string[];
  evidence?: ProjectEvidence;
}

const projectRecords: Project[] = [
  {
    id: 36,
    title: "Mizan",
    description: "A personal ledger for everyday spending and lending",
    longDescription: "Mizan brings spending and lending into one personal ledger, with a mobile-first layout for checking everyday money activity.",
    tech: "Next.js, React, TypeScript, Supabase, Tailwind CSS",
    image: "/images/projects/my-money.webp",
    imageKind: "interface",
    githubUrl: "",
    demoUrl: "https://my-money-lac.vercel.app",
    categories: ["Web Development", "Mobile Apps"],
    evidence: {
      inspect: "After signing in, inspect how spending and lending are separated, and how repayment status is presented.",
      access: "Sign-in required to explore the ledger.",
      sourceNote: "No implementation source is linked here. This overview describes the intended interface, not verified production results.",
    }
  },

  {
    id: 23,
    title: "Ignition",
    description: "Turn a goal into a five-step plan, then break down each step",
    longDescription: "An English–Amharic planning interface that pairs a Next.js frontend with a FastAPI service and Gemini-generated steps.",
    tech: "Next.js, React, FastAPI, Google Gemini, PostgreSQL",
    image: "/images/projects/ignition.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/Ignition",
    demoUrl: "https://ignition-ivory.vercel.app",
    categories: ["AI/DataScience", "Web Development"],
    evidence: {
      inspect: "Enter a goal, inspect the five-step result, then open a step for sub-actions. Switch between English and Amharic.",
      access: "Plan generation depends on the live AI service.",
      decision: {
        summary: "Model output is not assumed to be valid: the service checks for exactly five non-empty steps and a complexity score from 1 to 10 before accepting a response.",
        sourceLabel: "Response validation source",
        sourceUrl: "https://github.com/LeulTew/Ignition/blob/dc5c5380ef1225ef11703da2858c03fbad269305/backend/app/services.py#L154-L171",
      },
    }
  },
  {
    id: 25,
    title: "Kitefew",
    description: "Camera-Tracked Hand Gesture Game",
    longDescription: "**Kitefew** brings the fruit-slicing game to the browser, played with a finger in front of the camera.\n\n• **Computer vision**: MediaPipe tracks the index finger from the webcam; no touch or mouse needed.\n• **Spatial interaction**: Slices, bombs and hearts respond to the tracked fingertip.\n• **Light tracking**: MediaPipe's lite hand model keeps recognition in the browser.\n• **Arcade UI**: A neon-on-black interface with streak multipliers and blade styles.",
    tech: "React, TypeScript, MediaPipe, Vite",
    image: "/projects/kitefew.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/Kitefew",
    demoUrl: "https://kitefew.vercel.app/",
    categories: ["AI/DataScience", "Desktop & Games", "Web Development"]
  },
  {
    id: 28,
    title: "Samadhi",
    description: "Four essays on the Samadhi films and the philosophy behind them",
    longDescription: "**Samadhi** is a reading-first publication on cinema and philosophy.\n\n• **Four-part series**: Essays on Maya, Mind, Path and Sadhana, each tied to its film.\n• **Long-form layout**: A high-contrast dark theme with chapter navigation and film links.\n• **Imagery**: Stills and grids placed beside the passages they discuss.",
    tech: "React, Vite, TypeScript, Tailwind CSS",
    image: "/projects/samadhi.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/Samadhi",
    demoUrl: "https://samadhi-one.vercel.app",
    categories: ["Web Development"]
  },
  {
    id: 30,
    title: "Amet AI",
    description: "Daily English and Amharic Bible-study cards, curated with Gemini",
    longDescription: "**Amet AI** (Bible Learn) turns a 365-day Ethiopian Orthodox reading plan into daily study cards.\n\n• **Daily lessons**: English and Amharic flashcards for each day's reading.\n• **Archive**: Every past lesson stays browsable.\n• **Gemini curation**: Lessons are prepared with Google Gemini, as the site states.\n• **Calm interface**: A clean, focused layout for daily study.",
    tech: "Next.js, React, TypeScript, Tailwind CSS, Google Gemini",
    image: "/projects/bible-learn.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/bible-learn-webapp",
    demoUrl: "https://bible-learn-webapp.vercel.app",
    categories: ["Web Development", "AI/DataScience"]
  },
  {
    id: 31,
    title: "ProtoChem 3D",
    description: "Explore molecules in 3D using camera-tracked hand gestures",
    longDescription: "A browser-based experiment connecting MediaPipe hand tracking to molecular models rendered with React Three Fiber.",
    tech: "React, TypeScript, Three.js, React Three Fiber, MediaPipe",
    image: "/projects/chem-hands.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/chem-hands-3d",
    demoUrl: "https://chem-hands-3d.vercel.app",
    categories: ["Web Development", "Graphics & Algorithms"],
    evidence: {
      inspect: "Choose a molecule and open its element legend. With camera access, move both hands apart or together to change the view.",
      access: "Camera access is needed for hand tracking.",
      decision: {
        summary: "Two-hand distance controls zoom. Small changes are ignored and zoom is clamped between 0.5× and 5×, keeping the camera within a defined range.",
        sourceLabel: "Gesture handling source",
        sourceUrl: "https://github.com/LeulTew/chem-hands-3d/blob/447802a3a0a976e9541c93a4a7b2e216b1fb6edb/src/App.tsx#L22-L35",
      },
    }
  },
  {
    id: 32,
    title: "Elona Practice",
    description: "Timed exam practice with grading and attempt analytics",
    longDescription: "An exam-preparation app, currently set up for Chemistry of Natural Products.\n\n• **Practice and exam modes**: Untimed practice or timed exams across several question types.\n• **Grading**: Every attempt is marked and kept.\n• **Analytics**: Average score, questions answered and time spent, from recorded attempts.\n• **Dashboard**: One place to resume practice and review recent activity.",
    tech: "Next.js, React, TypeScript, Supabase, Tailwind CSS, shadcn/ui",
    image: "/projects/elona-practice.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/ElonaPractice",
    demoUrl: "https://elona-practice.vercel.app",
    categories: ["Web Development"]
  },
  {
    id: 34,
    title: "Lalu Graphics",
    description: "Graphic Design Mastery Handbook",
    longDescription: "**Lalu Graphics** (Graphic Design Mastery) is an interactive handbook for visual communication.\n\n• **Modern workflows**: AI-assisted design processes, set in an Ethiopian cultural context.\n• **Branding and career**: International branding standards and career strategy.\n• **Interactive guides**: Walkthroughs for logos, typography, colour and print.\n• **Live examples**: Design visualizers and Framer Motion demonstrations to try in place.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, FRAMER MOTION",
    image: "/projects/graphic-design.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/graphic-design-mastery",
    demoUrl: "https://graphic-design-mastery.vercel.app",
    categories: ["Web Development", "Graphics & Algorithms"]
  },
  {
    id: 24,
    title: "AgendaFlow AI",
    description: "AI-Powered Meeting & Agenda Management",
    longDescription: "**AgendaFlow AI** uses **Google Gemini** to turn raw material into structured meeting agendas.\n\n• **Scanner**: Photograph a handwritten or printed agenda and let Gemini structure it.\n• **Documents**: Upload a PDF, or describe the meeting, to generate its outline.\n• **Spreadsheet views**: Manage topics, owners and durations, with Excel import and export.\n• **Multi-modal input**: Text, documents and camera images in one flow.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, GOOGLE GEMINI, LUCIDE REACT",
    image: "/projects/agenda-flow.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/AgendaFlow-AI",
    demoUrl: "https://agenda-flow-ai.vercel.app",
    categories: ["AI/DataScience", "Web Development"]
  },
  {
    id: 27,
    title: "EthioDriveMaster",
    description: "English and Amharic guides to the Ethiopian driving practical exam",
    longDescription: "**EthioDriveMaster** walks learners through the Ethiopian driving-license practical exam.\n\n• **Step-by-step guides**: Practical instructions written from real driving experience.\n• **Kaliti course**: Illustrated walkthroughs of the Kaliti test tracks and their tips.\n• **Bilingual**: English and Amharic throughout.\n• **Focused UI**: A high-contrast dark theme with smooth navigation.",
    tech: "Next.js, React, TypeScript, Tailwind CSS, Framer Motion",
    image: "/projects/ethiodrive.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/EthioDriveMaster",
    demoUrl: "https://ethio-drive-master.vercel.app",
    categories: ["Web Development"]
  },
  {
    id: 26,
    title: "System Design Guide",
    description: "An interactive guide to system-design trade-offs",
    longDescription: "A reading-first guide to **system design**.\n\n• **Core topics**: Networking, load balancing, cascading failures and distributed-system trade-offs.\n• **Engineering first**: Built on the idea that prototypes are vibe-coded, production is engineered.\n• **Diagrams**: Topic navigation with diagrams beside the explanations.\n• **Focused UI**: A minimal dark theme for long technical reading.",
    tech: "React, TypeScript, Tailwind CSS",
    image: "/projects/system-design.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/system-design-guide-blog",
    demoUrl: "https://system-design-guide-blog.vercel.app/",
    categories: ["Web Development"]
  },
  {
    id: 21,
    title: "CS Exit Practice",
    description: "Computer Science exit-exam practice with bookmarks, a timer and checking",
    longDescription: "A practice room for the Computer Science exit exam.\n\n• **Exam sets**: Pick a past exam and move freely through its questions.\n• **Study tools**: Bookmarks, a quick-jump grid, answer checking and a countdown timer.\n• **Progress**: Counts of bookmarked and unanswered questions, with quick stats.\n• **Hosting**: Served from Wasmer Edge.",
    tech: "HTML, CSS, JavaScript, Wasmer Edge",
    image: "/images/projects/exit.webp",
    imageKind: "interface",
    githubUrl: "",
    demoUrl: "https://exitpractice.wasmer.app/",
    categories: ["Web Development"]
  },
  {
    id: 1,
    title: "Car Rental Platform",
    description: "Full-stack app with 3D vehicle visualization",
    longDescription: "A car rental system with **interactive 3D vehicle models**:\n\n• **Authentication**: ASP.NET Core Identity with Google sign-in\n• **Payments**: PayPal checkout, configured for the sandbox\n• **Search & booking**: Multi-criteria filtering, availability checks and email notifications\n• **User system**: Reviews, ratings and profile management\n\nBuilt with **ASP.NET Core MVC**, **Entity Framework Core** and **Three.js**.",
    tech: "ASP.NET Core MVC, Three.js, Entity Framework Core",
    image: "/images/projects/car-rental.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/CarRental-ThreeJS-MVC",
    categories: ["Web Development", "Graphics & Algorithms"]
  },
  {
    id: 22,
    title: "ROUTEGNA",
    description: "Multi-Fleet Management System",
    longDescription: "A full-stack platform for managing several organizations' fleets: their drivers, vehicles and routes.\n\n• **Routing**: A **FastAPI** service solving the vehicle routing problem with **Google OR-Tools**, and Mapbox-based route calculations.\n• **Operations**: Payroll, KPI dashboards, notifications, bulk imports and PDF reports.\n• **Architecture**: React and Express over Prisma and PostgreSQL, with Redis-backed payroll jobs and Better Auth.",
    tech: "REACT, TYPESCRIPT, EXPRESS.JS, PRISMA, POSTGRESQL, REDIS, FASTAPI, OR-TOOLS, BETTER AUTH",
    image: "/images/projects/routegna.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/kidusm001/multi-fleet-managment/",
    categories: ["AI/DataScience", "Web Development"]
  },
  {
    id: 2,
    title: "Ethio Trading",
    description: "Flutter trading-app prototype for the Ethiopian market",
    longDescription: "A Flutter and Dart prototype of an Ethiopian trading app.\n\n• **Four screens**: Home, market, portfolio and profile, with bottom navigation.\n• **Market view**: Asset prices and daily changes, from locally generated sample data.\n• **Prototype scope**: The screens run on sample data; no backend is connected yet.",
    tech: "Flutter, Dart, Firebase Hosting",
    image: "/images/projects/ethio-trading.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/EthioTrading",
    categories: ["Mobile Apps"]
  },
  {
    id: 3,
    title: "Amharic IR Improved",
    description: "Collaborative Amharic search with ranked results and article snippets",
    longDescription: "An Amharic information-retrieval project combining text preprocessing, a document index, and a Flask search interface, with Gemini-assisted summaries.",
    tech: "Python, Flask, Google Gemini",
    image: "/images/projects/amharic-ir.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Amharic-IR-Improved",
    categories: ["AI/DataScience", "Web Development"],
    evidence: {
      inspect: "In a local setup, try an Amharic query, compare result snippets, and open an article. Review the ranking formula alongside the results.",
      access: "Source and local setup are linked; summarization requires a Gemini API key.",
      sourceNote: "The README credits Leul Tewodros Agonafer and five co-authors; it does not specify individual implementation roles.",
      decision: {
        summary: "The ranker returns separate TF-IDF, position and proximity component scores alongside its combined score, keeping the scoring formula inspectable rather than returning only a total.",
        sourceLabel: "Ranking formula source",
        sourceUrl: "https://github.com/LeulTew/amharic-ir-improved/blob/4096030543826b66370f9cc9ff35b6762b8e832c/core/ranker.py#L133-L150",
      },
    }
  },
  {
    id: 4,
    title: "Portfolio Leul",
    description: "A 3D island portfolio with an HTML project reader",
    longDescription: "React and TypeScript connect a Three.js island, camera transitions, and a TV-style project reader. Project descriptions and links remain HTML rather than being painted into the scene.",
    tech: "React, TypeScript, React-Three-Fiber",
    image: "/images/projects/portfolio.webp",
    imageKind: "interface",
    imageAlt: "Leul portfolio desktop interface with its interactive island",
    githubUrl: "https://github.com/LeulTew/PortifolioLeul",
    categories: ["Web Development", "Graphics & Algorithms"],
    evidence: {
      inspect: "Move from Skills to Projects, open Details, and compare reading with browsing. Use reduced-motion mode to inspect the alternate camera behavior.",
      access: "The TV view appears only when the 3D screen is ready and the viewport is large enough.",
      sourceNote: "This describes the published source revision, not unpublished optimizations or measured performance of the live deployment.",
      decision: {
        summary: "One shared gate decides whether a frame is drawn. The renderer and camera skip the same hidden frames, and camera damping uses elapsed time between draws.",
        sourceLabel: "Shared frame-gate source",
        sourceUrl: "https://github.com/LeulTew/portifolioLeul/blob/8c921db0f9c946e8aace8b209f4216d8c509841b/src/lib/render/frameGate.ts#L63-L108",
      },
    }
  },
  {
    id: 5,
    title: "Uni College Choice",
    description: "Web decision tool for students",
    longDescription: "App aiding Ethiopian students in selecting universities and fields based on rankings and user inputs for informed choices.",
    tech: "HTML, CSS, JavaScript",
    image: "/images/projects/uni-college-choice.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Uni-College-Choice",
    categories: ["Web Development"]
  },
  {
    id: 6,
    title: "Tera Site",
    description: "Python static site generator",
    longDescription: "A Python command-line static-site generator: it converts Markdown through an HTML template, copies static assets and writes every page to an output folder.",
    tech: "Python",
    image: "/images/projects/tera-site.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/TeraSite",
    categories: ["Web Development", "Desktop & Games"]
  },
  {
    id: 29,
    title: "Arch Guide",
    description: "A step-by-step Arch Linux installation guide",
    longDescription: "A browser guide through a working **Arch Linux** install.\n\n• **Install path**: Partitioning, base packages, system configuration and GRUB, in order.\n• **Copyable commands**: Each step's commands in blocks, with notes on what they do.\n• **Clean UI**: Technical documentation styled for clarity and focus.",
    tech: "React, TypeScript, Tailwind CSS",
    image: "/projects/arch-guide.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/ArchGuide",
    demoUrl: "https://arch-guide-one.vercel.app",
    categories: ["Web Development", "Desktop & Games"]
  },
  {
    id: 33,
    title: "Lead Blog",
    description: "A data story on lead in Ethiopian vegetables versus protein powder",
    longDescription: "**Lead Blog** is a data-driven investigation: it compares lead contamination in Ethiopian vegetables with the levels found in protein powders, drawing on independent lab reports from 2020 to 2025.\n\n• **Interactive Data**: Searchable, filterable tables with colour-coded risk levels and comparison bars.\n• **Sources**: The lab reports and papers behind the figures are linked directly.\n• **Tested**: Components, interactions and data filtering are covered with Vitest and React Testing Library.",
    tech: "NEXT.JS, REACT, TYPESCRIPT, TAILWIND CSS, VITEST",
    image: "/projects/lead-blog.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/LeadBlog",
    demoUrl: "https://lead-blog.vercel.app",
    categories: ["Web Development"]
  },
  {
    id: 7,
    title: "Luna",
    description: "Web movie application",
    longDescription: "A PHP movie site with a database behind it: movie details, ratings, recommendations, trailers and profile pages.",
    tech: "HTML, CSS, JS, PHP",
    image: "/images/projects/luna.webp",
    imageKind: "artwork",
    imageAlt: "Original Luna project artwork, not an interface screenshot",
    githubUrl: "https://github.com/LeulTew/Luna",
    categories: ["Web Development"]
  },
  {
    id: 8,
    title: "Pharmacy THE HIVE",
    description: "Desktop pharmacy management system",
    longDescription: "A C# Windows Forms pharmacy system on SQL Server: items, suppliers, customer orders and accounts, with separate customer and administrator screens.",
    tech: "C#, T-SQL",
    image: "/images/projects/pharmacy.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Pharmacy-THE-HIVE-",
    categories: ["Desktop & Games"]
  },
  {
    id: 9,
    title: "Spider Solitaire C#",
    description: "Desktop card game implementation",
    longDescription: "A C# Windows Forms Spider Solitaire with card images, stacked tableaux and event-driven moves.",
    tech: "C#",
    image: "/images/projects/spider-solitaire-csharp.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Spider-Solitaire-CSharp",
    categories: ["Desktop & Games"]
  },
  {
    id: 10,
    title: "Solitaire CPP",
    description: "Algorithms-focused card game",
    longDescription: "Classic Solitaire emphasizing data structures, algorithms, and documented logic for educational purposes.",
    tech: "C++",
    image: "/images/projects/solitaire-cpp.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Solitaire-CPP",
    categories: ["Desktop & Games", "Graphics & Algorithms"]
  },
  {
    id: 11,
    title: "Asteroidz",
    description: "Space game prototype",
    longDescription: "A Python and Pygame space shooter: an event loop, moving asteroids, shooting, collisions, lives and power-ups.",
    tech: "Python, Pygame",
    image: "/images/projects/asteroidz.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Asteroidz",
    categories: ["Desktop & Games"]
  },
  {
    id: 12,
    title: "Deep Fake Alew",
    description: "AI deepfake video detection",
    longDescription: "A PyTorch inference pipeline that classifies videos as real or fake with an EfficientNet model, split into configuration, model, preprocessing and a prediction CLI. Trained weights are supplied through configuration.",
    tech: "PyTorch, EfficientNet",
    image: "/images/projects/deepFakeAlew.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/DeepFakeAlew",
    categories: ["AI/DataScience"]
  },
  {
    id: 13,
    title: "Fikir Fix",
    description: "AI CLI assistant",
    longDescription: "A Python command-line coding assistant built on Gemini: it lists directories, reads and edits files and runs Python scripts, with a dry-run mode and explicit permission before writing.",
    tech: "Python, Gemini API",
    image: "/images/projects/fikirFix.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/FikirFix",
    categories: ["AI/DataScience"]
  },
  {
    id: 14,
    title: "Iris Dataset Machine Learning",
    description: "ML experiments on Iris dataset",
    longDescription: "Applied models like KNN, Decision Trees, Perceptron, Clustering with visualizations and analysis in Jupyter.",
    tech: "Python, Scikit-Learn",
    image: "/images/projects/IrisDatasetML.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Iris-Dataset-Machine-Learning",
    categories: ["AI/DataScience"]
  },
  {
    id: 15,
    title: "Shuttle Route Optimizer",
    description: "Groups employees into capacity-aware shuttle pickup routes",
    longDescription: "A route-planning system that assigns employees to shuttle pickups from a headquarters, within each vehicle's capacity and on real-world geography.\n\n• **Optimization**: Google OR-Tools solves the routes over haversine distances, with bearings used to penalise sharp turns.\n• **Verification**: Every employee is checked to be assigned exactly once.\n• **Interface**: A FastAPI service and a Flask web app whose Leaflet map draws road-following routes through OSRM.",
    tech: "Python, FastAPI, Google OR-Tools, Flask, Leaflet",
    image: "/images/projects/Clustering.webp",
    imageKind: "artwork",
    githubUrl: "https://github.com/LeulTew/clustering-demo",
    categories: ["AI/DataScience"]
  },
  {
    id: 16,
    title: "Bookbot",
    description: "Word and character statistics for any plain-text book",
    longDescription: "A Python command-line tool that reads a book file, counts its words and prints each character's frequency, most common first. It takes a file path and reports a missing file clearly.",
    tech: "Python",
    image: "/images/projects/Bookbot.webp",
    imageKind: "artwork",
    githubUrl: "https://github.com/LeulTew/Bookbot",
    categories: ["Desktop & Games"]
  },
  {
    id: 17,
    title: "3D 8 Queens OpenGL",
    description: "Graphics visualization of puzzle",
    longDescription: "3D rendering of 8-Queens puzzle with textures, mouse interactions, and algorithmic highlights.",
    tech: "C++, OpenGL",
    image: "/images/projects/3D8Queen.webp",
    imageKind: "artwork",
    githubUrl: "https://github.com/LeulTew/3D-8-Queens-OpenGL",
    categories: ["Graphics & Algorithms"]
  },
  {
    id: 18,
    title: "Solar System OpenGL",
    description: "Interactive solar system simulation",
    longDescription: "A C++ and OpenGL solar system with textured planets, lighting, animated orbits and rotations, camera controls and a hierarchical Earth-Moon transform.",
    tech: "C++, OpenGL",
    image: "/images/projects/SolarSystem.webp",
    imageKind: "artwork",
    githubUrl: "https://github.com/LeulTew/Solar-System-OpenGL-c-",
    categories: ["Graphics & Algorithms"]
  },
  {
    id: 19,
    title: "Maze",
    description: "Algorithm visualization tool",
    longDescription: "Maze generator/solver using recursive backtracking and GUI for real-time display.",
    tech: "Python, Tkinter",
    image: "/images/projects/Maze.webp",
    imageKind: "artwork",
    githubUrl: "https://github.com/LeulTew/Maze",
    categories: ["Graphics & Algorithms", "Desktop & Games"]
  },
  {
    id: 35,
    title: "Dream Weaver",
    description: "A dream journal with mood labels, search and filters",
    longDescription: "**Dream Weaver** is a calm, star-field journal for recording dreams.\n\n• **Entries**: A title, date, description and mood for each dream.\n• **Find again**: Search by title and filter by mood.\n• **Private by default**: Entries stay in the browser's own storage.",
    tech: "Next.js, React, TypeScript, Tailwind CSS",
    image: "/projects/dream-journal.webp",
    imageKind: "interface",
    githubUrl: "",
    demoUrl: "https://v0-dream-journal-dashboard.vercel.app",
    categories: ["Web Development"]
  },
  {
    id: 20,
    title: "Celestial Bodies Database",
    description: "Relational database design",
    longDescription: "A PostgreSQL database of galaxies, stars, planets and moons, with sample data and relational constraints, built for freeCodeCamp's relational database course.",
    tech: "SQL",
    image: "/images/projects/CelestialDB.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Celestial-Bodies-Database",
    categories: ["AI/DataScience"]
  },
];

/**
 * The lead set: the strongest inspectable work, shown first and named as
 * such, with everything else an archive after it (round 10, D-BRAND-002).
 * Each is a genuine interface capture of a project with its own live demo or
 * source, most with a real task on screen; staged mockups and artwork stay in
 * the archive, labelled.
 */
export const FEATURED_PROJECT_IDS: readonly number[] = [23, 4, 31, 25, 21, 24];

export function isFeaturedProject(project: Pick<Project, 'id'>): boolean {
  return FEATURED_PROJECT_IDS.includes(project.id);
}

/** The tier a project is presented in. */
export const projectTier = (project: Pick<Project, 'id'>) => (isFeaturedProject(project) ? 'Selected work' : 'Archive');

export const projectsData: Project[] = [
  ...FEATURED_PROJECT_IDS.map(id => projectRecords.find(project => project.id === id)!),
  ...projectRecords.filter(project => !isFeaturedProject(project)),
];