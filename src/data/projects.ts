export interface Project {
  id: number;
  title: string;
  description: string;
  longDescription?: string;
  tech: string;
  image: string;
  githubUrl: string;
  demoUrl?: string;
  categories: string[];
}

export const projectsData: Project[] = [
  {
    id: 25,
    title: "My Money",
    description: "Smart personal finance & expense tracking application",
    longDescription: "Intuitive financial management platform enabling users to take full control of personal finances:\n\n• **Budget & Expense Tracking**: Real-time category tracking, recurring expenses, and budget limits\n• **Analytics & Insights**: Interactive visual dashboards and monthly spending trends\n• **Cloud Sync & Security**: Multi-device synchronization powered by Firebase\n• **Responsive UI/UX**: Clean, accessible mobile-first interface designed in Figma",
    tech: "Flutter, Dart, Firebase, Responsive UI",
    image: "/images/projects/my-money.webp",
    githubUrl: "https://github.com/LeulTew/financial_tracker",
    categories: ["Mobile Apps", "Web Development"]
  },

  {
    id: 23,
    title: "Ignition",
    description: "Mission-control platform for tactical goal breakdown",
    longDescription: "**IGNITION** (aka GOAL_BREAKER.EXE) is a mission-control platform that transforms vague objectives into precise, executable tactical plans. It takes a signal like 'Launch a startup' and returns a **5-step tactical breakdown** with complexity scores, filtering out the noise.\n\n• **Precision Breakdown**: Generates 5 chronological, high-impact steps. No fluff.\n• **Deep Dive Subroutines**: Recursively breaks down any step into 3 specific tactical sub-actions.\n• **Active Guardrails**: Dedicated AI model classifies input as OK, GIBBERISH, or ABUSE, handling errors in-character.\n• **Bilingual Ops**: Native support for **English** and **Amharic**, adapting the 'Dark Technical' tone to both.\n• **Haptic Audio Layer**: Immersive feedback with mechanical key clicks, processing hums, and success chimes.\n\nBuilt with a **Dark Technical** UI for focused execution.",
    tech: "NEXT.JS, REACT, FASTAPI, GOOGLE GEMINI, POSTGRESQL",
    image: "/images/projects/ignition.webp",
    githubUrl: "https://github.com/LeulTew/Ignition",
    demoUrl: "https://ignition-ivory.vercel.app",
    categories: ["AI/DataScience", "Web Development"]
  },
  {
    id: 25,
    title: "Kitefew",
    description: "Camera-Tracked Hand Gesture Game",
    longDescription: "**Kitefew** is an experimental spatial computing game that brings the 'Fruit Ninja' experience to your browser using **MediaPipe** finger tracking.\n\n• **Computer Vision**: Real-time tracking of the index finger via camera—no touch or mouse required.\n• **Spatial Interaction**: Slicing physics and interaction layers mapped to physical hand movements.\n• **Performance**: Optimized for web execution with low-latency gesture recognition.\n• **Modern Aesthetics**: Neon-accented dark UI with fluid animations and responsive gameplay.\n\nA showcase of interactive computer vision and web-based gaming technology.",
    tech: "JAVASCRIPT, MEDIAPIPE, VITE, VANILLA CSS",
    image: "/projects/kitefew.webp",
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
    githubUrl: "https://github.com/LeulTew/bible-learn-webapp",
    demoUrl: "https://bible-learn-webapp.vercel.app",
    categories: ["Web Development", "AI/DataScience"]
  },
  {
    id: 31,
    title: "ProtoChem 3D",
    description: "Interactive 3D Molecular Visualization",
    longDescription: "**ProtoChem 3D** (Chem Hands) is a high-fidelity 3D structural viewer for chemistry students and researchers.\n\n• **3D Mechanics**: Real-time rendering of complex molecular structures with interactive manipulation.\n• **Educational Focus**: Hierarchical visualization of atoms, bonds, and molecular geometry.\n• **Gesture Support**: Designed for spatial computing and advanced touch interactions.\n• **Performance**: WebGL-powered engine for low-latency 3D rendering in the browser.",
    tech: "JAVASCRIPT, THREE.JS, WEBGL, VANILLA CSS",
    image: "/projects/chem-hands.webp",
    githubUrl: "https://github.com/LeulTew/chem-hands-3d",
    demoUrl: "https://chem-hands-3d.vercel.app",
    categories: ["Web Development", "Graphics & Algorithms"]
  },
  {
    id: 32,
    title: "Elona Practice",
    description: "Technical Practice & Analytics Dashboard",
    longDescription: "A specialized dashboard for tracking technical skills and practice routines.\n\n• **Metrics Tracking**: Real-time visualization of practice hours and milestone completion.\n• **Adaptive Learning**: Content paths that adapt based on user performance and goals.\n• **Modern Hub**: Centralized command center for technical growth and professional development.\n• **Data Driven**: Built-in analytics for identifying strengths and areas for improvement.",
    tech: "REACT, TYPESCRIPT, TAILWIND CSS, SHADCN UI",
    image: "/projects/elona-practice.webp",
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
    githubUrl: "https://github.com/LeulTew/EthioTrading",
    categories: ["Mobile Apps"]
  },
  {
    id: 3,
    title: "Amharic IR Improved",
    description: "NLP/IR system for Amharic language",
    longDescription: "Enhanced Information Retrieval pipeline specifically for the Amharic language:\n\n• **NLP Optimization**: Hybrid stemming, optimized indexing, and TF-IDF ranking\n• **AI Integration**: AI-powered summarization and query expansion\n• **Architecture**: Web scrapers for corpus generation and a bilingual UI\n\nShowcases advanced **NLP** techniques and **AI** application for low-resource languages.",
    tech: "Flask, PyTorch, Google Gemini",
    image: "/images/projects/amharic-ir.webp",
    githubUrl: "https://github.com/LeulTew/Amharic-IR-Improved",
    categories: ["AI/DataScience", "Web Development"]
  },
  {
    id: 4,
    title: "Portfolio Leul",
    description: "Frontend personal portfolio site",
    longDescription: "Modern personal portfolio featuring immersive **3D elements** and interactive design:\n\n• **Tech Stack**: Built with **React**, **TypeScript**, and **React-Three-Fiber**\n• **Design**: Glassmorphism aesthetics with smooth Framer Motion animations\n• **Performance**: Optimized for all devices with responsive layouts\n\nA showcase of frontend engineering and creative design skills.",
    tech: "React, TypeScript, React-Three-Fiber",
    image: "/images/projects/portfolio.webp",
    githubUrl: "https://github.com/LeulTew/PortifolioLeul",
    categories: ["Web Development", "Graphics & Algorithms"]
  },
  {
    id: 5,
    title: "Uni College Choice",
    description: "Web decision tool for students",
    longDescription: "App aiding Ethiopian students in selecting universities and fields based on rankings and user inputs for informed choices.",
    tech: "HTML, CSS, JavaScript",
    image: "/images/projects/uni-college-choice.webp",
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
    githubUrl: "https://github.com/LeulTew/ArchGuide",
    demoUrl: "https://arch-guide-one.vercel.app",
    categories: ["Web Development", "Desktop & Games"]
  },
  {
    id: 33,
    title: "Lead Blog",
    description: "High-Imapct Engineering & Leadership Blog",
    longDescription: "A professional platform focusing on the intersection of **Software Engineering** and **Project Leadership**.\n\n• **Strategic Insights**: Articles on architectural trade-offs, team scaling, and production reliability.\n• **Technical Depth**: Deep dives into backend systems, AI orchestration, and cloud infrastructure.\n• **Minimalist Design**: Typography-first aesthetic for distraction-free technical reading.\n• **Global Reach**: Built for engineers targeting international roles and complex project environments.",
    tech: "NEXT.JS, TYPESCRIPT, TAILWIND CSS, MDX",
    image: "/projects/lead-blog.webp",
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
    githubUrl: "https://github.com/LeulTew/Iris-Dataset-Machine-Learning",
    categories: ["AI/DataScience"]
  },
  {
    id: 15,
    title: "Clustering Demo",
    description: "Data analysis clustering demo",
    longDescription: "Demo of clustering algorithms with visualizations for exploratory data insights.",
    tech: "Python",
    image: "/images/projects/Clustering.webp",
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
    githubUrl: "https://github.com/LeulTew/Celestial-Bodies-Database",
    categories: ["AI/DataScience"]
  },
];
