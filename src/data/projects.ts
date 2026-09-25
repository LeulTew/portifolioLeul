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

export const projectsData: Project[] = [
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
    longDescription: "**Kitefew** is an experimental spatial computing game that brings the 'Fruit Ninja' experience to your browser using **MediaPipe** finger tracking.\n\n• **Computer Vision**: Real-time tracking of the index finger via camera—no touch or mouse required.\n• **Spatial Interaction**: Slicing physics and interaction layers mapped to physical hand movements.\n• **Performance**: Optimized for web execution with low-latency gesture recognition.\n• **Modern Aesthetics**: Neon-accented dark UI with fluid animations and responsive gameplay.\n\nA showcase of interactive computer vision and web-based gaming technology.",
    tech: "JAVASCRIPT, MEDIAPIPE, VITE, VANILLA CSS",
    image: "/projects/kitefew.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Kitefew",
    demoUrl: "https://kitefew.vercel.app/",
    categories: ["AI/DataScience", "Desktop & Games", "Web Development"]
  },
  {
    id: 28,
    title: "Samadhi",
    description: "Immersive Film Analysis & Philosophy Blog",
    longDescription: "**Samadhi** is a refined digital publication exploring the intersections of cinema, philosophy, and visual culture.\n\n• **Content Series**: Structured 4-part deep dives (Maya, Mind, Path, Sadhana) into cinematic masterpieces.\n• **Aesthetics**: High-contrast, minimalist dark theme designed for long-form reading.\n• **Interactive Layout**: Tailored grid systems and immersive imagery that mirror the complexity of the subjects.\n• **Performance**: Fast-loading, static-site generated content for a seamless reading experience.",
    tech: "NEXT.JS, TYPESCRIPT, TAILWIND CSS, MDX",
    image: "/projects/samadhi.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/Samadhi",
    demoUrl: "https://samadhi-one.vercel.app",
    categories: ["Web Development"]
  },
  {
    id: 30,
    title: "Amet AI",
    description: "AI-Powered Bible Discovery Platform",
    longDescription: "**Amet AI** (Bible Learn) leverages generative AI to provide interactive, contextual insights into biblical texts.\n\n• **Intelligent Search**: Semantically aware search queries and contextual cross-referencing.\n• **Contextual Analysis**: Real-time generation of summaries and theological context for any verse.\n• **Modern Interface**: Clean, technical aesthetic designed for deep study and accessible learning.\n• **Ethical AI**: Focused on providing reliable, textual-based references and insights.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, GOOGLE GEMINI",
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
    description: "Technical Practice & Analytics Dashboard",
    longDescription: "A specialized dashboard for tracking technical skills and practice routines.\n\n• **Metrics Tracking**: Real-time visualization of practice hours and milestone completion.\n• **Adaptive Learning**: Content paths that adapt based on user performance and goals.\n• **Modern Hub**: Centralized command center for technical growth and professional development.\n• **Data Driven**: Built-in analytics for identifying strengths and areas for improvement.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, SHADCN UI",
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
    longDescription: "**Lalu Graphics** (Graphic Design Mastery) is the definitive handbook for mastering visual communication in 2026.\n\n• **Modern Workflows**: Covers AI-integrated design processes and Ethiopian cultural context.\n• **Strategic Branding**: Focuses on international branding standards and global career strategy.\n• **Interactive Guides**: Detailed walkthroughs for logo creation, typography, and print design.\n• **Pro Visuals**: High-resolution showcases of design principles and production-ready assets.",
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
    longDescription: "**AgendaFlow AI** is a high-performance meeting management engine that leverages **Google Gemini** to transform raw inputs into structured agendas.\n\n• **Intelligent Scanner**: Camera-based extraction of handwritten or printed agendas with real-time AI processing.\n• **Document Intelligence**: Upload documents or provide descriptions to generate comprehensive meeting structures.\n• **Excel Integration**: Full-featured Excel-like management for topics, stakeholders, and timing.\n• **Multi-Modal AI**: Supports camera uploads, document parsing, and natural language descriptions.\n\nDesigned for maximum productivity with a sleek, glassmorphic technical interface.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, GOOGLE GEMINI, LUCIDE REACT",
    image: "/projects/agenda-flow.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/AgendaFlow-AI",
    demoUrl: "https://agenda-flow-ai.vercel.app",
    categories: ["AI/DataScience", "Web Development"]
  },
  {
    id: 27,
    title: "EthioDriveMaster",
    description: "Next-Gen Driving License Practice Platform",
    longDescription: "**EthioDriveMaster** is the definitive digital guide for acing the Ethiopian driving license practical exam.\n\n• **Step-by-Step Guides**: Comprehensive practical guides created from real driving experience.\n• **Visual Learning**: Interactive walkthroughs of the Kaliti practical exam tracks and tips.\n• **Bilingual Support**: Targeted at providing local-specific knowledge in a modern web interface.\n• **Premium UI**: Sleek, high-contrast dark theme with smooth navigation and 'Kaliti Approved' resources.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, FRAMER MOTION",
    image: "/projects/ethiodrive.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/EthioDriveMaster",
    demoUrl: "https://ethio-drive-master.vercel.app",
    categories: ["Web Development", "Mobile Apps"]
  },
  {
    id: 26,
    title: "System Design Guide",
    description: "Comprehensive Architectural Learning Platform",
    longDescription: "A specialized platform dedicated to mastering **System Design** and high-scale engineering principles.\n\n• **Deep Dives**: Detailed guides on network topolgy, cascading failures, and distributed systems.\n• **Engineering First**: Focuses on professional engineering over simple prototyping ('Engineering is for production').\n• **Interactive content**: Structured learning paths for mastering technical constraints and system reliability.\n• **Dark Mode UI**: Minimalist, technical aesthetic designed for focused technical reading and study.",
    tech: "NEXT.JS, TYPESCRIPT, TAILWIND CSS, MDX",
    image: "/projects/system-design.webp",
    imageKind: "interface",
    githubUrl: "https://github.com/LeulTew/system-design-guide-blog",
    demoUrl: "https://system-design-guide-blog.vercel.app/",
    categories: ["Web Development", "AI/DataScience"]
  },
  {
    id: 21,
    title: "CS Exit Practice",
    description: "Hyper-Modern Exit Exam Interface",
    longDescription: "A modern web application providing an interactive interface for practicing Computer Science exit exams, targeted at students preparing for university or professional assessments. Hosted on Wasmer Edge for efficient, serverless deployment.",
    tech: "WebAssembly",
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
    longDescription: "Advanced car rental system featuring **interactive 3D vehicle models** and a robust feature set:\n\n• **Secure Authentication**: Google OAuth & JWT implementation\n• **Payments**: Integrated PayPal for secure transactions\n• **Search & Booking**: Multi-criteria filtering, availability checks, and email notifications\n• **User System**: Reviews, ratings, and profile management\n\nDemonstrates full-stack proficiency with **ASP.NET Core** and **Three.js** integration.",
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
    longDescription: "Comprehensive full-stack platform featuring a **Hybrid Architecture** that blends monolithic and microservices. Manages multiple organizations, drivers, vehicles, and routes in a **multi-tenant setup**.\n\n• **Core Features**: **FastAPI** microservice solving **VRP** (Vehicle Routing Problem) and a custom service for **TSP** routing with **Mapbox API fallback**.\n• **Optimization**: Real-time tracking and route optimization using clustering algorithms and **Google OR-Tools**.\n• **Operations**: Automated payroll, KPI dashboards, notifications, bulk imports, and PDF reports.\n• **Architecture**: Scalable design with **data isolation**, job queues (Redis), and robust integrations.",
    tech: "REACT, TYPESCRIPT, EXPRESS.JS, PRISMA, POSTGRESQL, REDIS, FASTAPI, OR-TOOLS, BETTER AUTH",
    image: "/images/projects/routegna.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/kidusm001/multi-fleet-managment/",
    categories: ["Mobile Apps", "AI/DataScience", "Web Development"]
  },
  {
    id: 2,
    title: "Ethio Trading",
    description: "Mobile marketplace for Ethiopian trade",
    longDescription: "Cross-platform mobile marketplace designed to facilitate local commerce:\n\n• **Real-time Data**: Instant updates for product listings and prices\n• **User Experience**: Responsive UI with intuitive search and filtering\n• **Features**: User profiles, secure messaging, and product management\n\nHighlights expertise in **Flutter** mobile development and **Firebase** backend integration.",
    tech: "Flutter, Dart, Firebase",
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
    longDescription: "Tool converting Markdown to secure, fast websites for blogs/portfolios, with templating, CLI tooling, and API integrations for easy deployability.",
    tech: "Python",
    image: "/images/projects/tera-site.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/TeraSite",
    categories: ["Web Development", "Desktop & Games"]
  },
  {
    id: 29,
    title: "Arch Guide",
    description: "Definitive Arch Linux Installation Guide",
    longDescription: "A comprehensive, step-by-step guide for mastering **Arch Linux** installation and advanced configuration.\n\n• **Technical Precision**: Covers kernel selection, bootloader setup, and desktop environment customization.\n• **Simplified Workflow**: Optimized command sequences for repeatable, stable system builds.\n• **Engineering Focus**: Emphasizes system reliability and deep-level hardware integration.\n• **Clean UI**: Technical documentation styled for clarity and focus.",
    tech: "NEXT.JS, TYPESCRIPT, TAILWIND CSS, MDX",
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
    longDescription: "Site with backend for trailers, reviews, and responsive design to engage users in movie discovery.",
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
    longDescription: "Mature app with database integration, transactional workflows for inventory, prescriptions, sales, user-friendly UI, and role-based access for real-world operations.",
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
    longDescription: "Polished Spider Solitaire with event-driven UI, save/load, scoring, and modular logic/UI separation.",
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
    longDescription: "Python game demonstrating event loops, basic physics, and rapid prototyping in a space theme.",
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
    longDescription: "Next-gen tool with modular CLI, configurable weights, and cross-platform support for accurate deepfake analysis in research/production.",
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
    longDescription: "Command-line tool for task automation, file editing, Amharic support, and developer productivity boosts via intelligent workflows.",
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
    description: "Automation script for books",
    longDescription: "Tool managing book lists and reading workflows through scripted automation.",
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
    longDescription: "Model with hierarchical transforms, rotations, lighting, and animations for immersive visualization.",
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
    description: "AI-Powered Dream Analytics Dashboard",
    longDescription: "**Dream Weaver** is a sophisticated digital sanctuary for recording and analyzing the subconscious mind using **Google Gemini**.\n\n• **Dream Intelligence**: Automated interpretation and mood tagging using large language models to identify recurring motifs.\n• **Visual Insights**: Data visualization of dream patterns, emotional arcs, and longitudinal shifts in subconscious themes.\n• **Mystical UI**: Immersive, star-field background with a minimalist glassmorphic dashboard for aesthetic focus.\n• **Personalized Sanctuary**: Private, secure entry management designed for long-term psychological tracking.",
    tech: "NEXT.JS, TYPESCRIPT, TAILWIND CSS, GOOGLE GEMINI",
    image: "/projects/dream-journal.webp",
    imageKind: "interface",
    githubUrl: "",
    demoUrl: "https://v0-dream-journal-dashboard.vercel.app",
    categories: ["Web Development", "AI/DataScience"]
  },
  {
    id: 20,
    title: "Celestial Bodies Database",
    description: "Relational database design",
    longDescription: "Schema for celestial bodies with queries, normalization, and exercises from FreeCodeCamp.",
    tech: "SQL",
    image: "/images/projects/CelestialDB.webp",
    imageKind: "mockup",
    githubUrl: "https://github.com/LeulTew/Celestial-Bodies-Database",
    categories: ["AI/DataScience"]
  },
];
