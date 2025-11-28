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
    id: 1,
    title: "Car Rental Platform",
    description: "Full-stack app with 3D vehicle visualization",
    longDescription: "Advanced car rental system featuring **interactive 3D vehicle models** and a robust feature set:\n\n• **Secure Authentication**: Google OAuth & JWT implementation\n• **Payments**: Integrated PayPal for secure transactions\n• **Search & Booking**: Multi-criteria filtering, availability checks, and email notifications\n• **User System**: Reviews, ratings, and profile management\n\nDemonstrates full-stack proficiency with **ASP.NET Core** and **Three.js** integration.",
    tech: "ASP.NET Core MVC, Three.js, Entity Framework Core",
    image: "/images/projects/car-rental.jpg",
    githubUrl: "https://github.com/LeulTew/CarRental-ThreeJS-MVC",
    categories: ["Web Development", "Graphics & Algorithms"]
  },
  {
    id: 22,
    title: "ROUTEGNA",
    description: "Microhybrid Shuttle Management System",
    longDescription: "Innovative transportation platform with a **microhybrid architecture** blending monolithic and microservices:\n\n• **AI Chat Helper**: User support powered by **BetterAuth MCP** authorization\n• **Core Microservice**: FastAPI service solving **VRP** (Vehicle Routing Problem) for employee grouping and **TSP** for optimized routing\n• **Mapping**: Mapbox API fallback for reliable visualization\n• **Features**: Scheduling, real-time tracking, bookings, and cross-platform efficiency\n\nBuilt for streamlined logistics and operational efficiency.",
    tech: "FLUTTER, DART, FASTAPI, BETTERAUTH, MAPBOX API",
    image: "/images/projects/routegna.png",
    githubUrl: "https://github.com/kidusm001/shuttle-management",
    categories: ["Mobile Apps", "AI/ML & Data Science", "Web Development"]
  },
  {
    id: 2,
    title: "Ethio Trading",
    description: "Mobile marketplace for Ethiopian trade",
    longDescription: "Cross-platform mobile marketplace designed to facilitate local commerce:\n\n• **Real-time Data**: Instant updates for product listings and prices\n• **User Experience**: Responsive UI with intuitive search and filtering\n• **Features**: User profiles, secure messaging, and product management\n\nHighlights expertise in **Flutter** mobile development and **Firebase** backend integration.",
    tech: "Flutter, Dart, Firebase",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/EthioTrading",
    categories: ["Mobile Apps"]
  },
  {
    id: 3,
    title: "Amharic IR Improved",
    description: "NLP/IR system for Amharic language",
    longDescription: "Enhanced Information Retrieval pipeline specifically for the Amharic language:\n\n• **NLP Optimization**: Hybrid stemming, optimized indexing, and TF-IDF ranking\n• **AI Integration**: AI-powered summarization and query expansion\n• **Architecture**: Web scrapers for corpus generation and a bilingual UI\n\nShowcases advanced **NLP** techniques and **AI** application for low-resource languages.",
    tech: "Flask, PyTorch, Google Gemini",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Amharic-IR-Improved",
    categories: ["AI/ML & Data Science", "Web Development"]
  },
  {
    id: 4,
    title: "Portfolio Leul",
    description: "Frontend personal portfolio site",
    longDescription: "Modern personal portfolio featuring immersive **3D elements** and interactive design:\n\n• **Tech Stack**: Built with **React**, **TypeScript**, and **React-Three-Fiber**\n• **Design**: Glassmorphism aesthetics with smooth Framer Motion animations\n• **Performance**: Optimized for all devices with responsive layouts\n\nA showcase of frontend engineering and creative design skills.",
    tech: "React, TypeScript, React-Three-Fiber",
    image: "/images/projects/portfolio.jpg",
    githubUrl: "https://github.com/LeulTew/PortifolioLeul",
    categories: ["Web Development", "Graphics & Algorithms"]
  },
  {
    id: 5,
    title: "Uni College Choice",
    description: "Web decision tool for students",
    longDescription: "App aiding Ethiopian students in selecting universities and fields based on rankings and user inputs for informed choices.",
    tech: "HTML, CSS, JavaScript",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Uni-College-Choice",
    categories: ["Web Development"]
  },
  {
    id: 6,
    title: "Tera Site",
    description: "Python static site generator",
    longDescription: "Tool converting Markdown to secure, fast websites for blogs/portfolios, with templating, CLI tooling, and API integrations for easy deployability.",
    tech: "Python",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/TeraSite",
    categories: ["Web Development", "Desktop & Games"]
  },
  {
    id: 7,
    title: "Luna",
    description: "Web movie application",
    longDescription: "Site with backend for trailers, reviews, and responsive design to engage users in movie discovery.",
    tech: "HTML, CSS, JS, PHP",
    image: "/images/projects/luna.jpg",
    githubUrl: "https://github.com/LeulTew/Luna",
    categories: ["Web Development"]
  },
  {
    id: 8,
    title: "Pharmacy THE HIVE",
    description: "Desktop pharmacy management system",
    longDescription: "Mature app with database integration, transactional workflows for inventory, prescriptions, sales, user-friendly UI, and role-based access for real-world operations.",
    tech: "C#, T-SQL",
    image: "/images/projects/pharmacy.jpg",
    githubUrl: "https://github.com/LeulTew/Pharmacy-THE-HIVE-",
    categories: ["Desktop & Games"]
  },
  {
    id: 9,
    title: "Spider Solitaire C#",
    description: "Desktop card game implementation",
    longDescription: "Polished Spider Solitaire with event-driven UI, save/load, scoring, and modular logic/UI separation.",
    tech: "C#",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Spider-Solitaire-CSharp",
    categories: ["Desktop & Games"]
  },
  {
    id: 10,
    title: "Solitaire CPP",
    description: "Algorithms-focused card game",
    longDescription: "Classic Solitaire emphasizing data structures, algorithms, and documented logic for educational purposes.",
    tech: "C++",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Solitaire-CPP",
    categories: ["Desktop & Games", "Graphics & Algorithms"]
  },
  {
    id: 11,
    title: "Asteroidz",
    description: "Space game prototype",
    longDescription: "Python game demonstrating event loops, basic physics, and rapid prototyping in a space theme.",
    tech: "Python, Pygame",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Asteroidz",
    categories: ["Desktop & Games"]
  },
  {
    id: 12,
    title: "Deep Fake Alew",
    description: "AI deepfake video detection",
    longDescription: "Next-gen tool with modular CLI, configurable weights, and cross-platform support for accurate deepfake analysis in research/production.",
    tech: "PyTorch, EfficientNet",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/DeepFakeAlew",
    categories: ["AI/ML & Data Science"]
  },
  {
    id: 13,
    title: "Fikir Fix",
    description: "AI CLI assistant",
    longDescription: "Command-line tool for task automation, file editing, Amharic support, and developer productivity boosts via intelligent workflows.",
    tech: "Python, Gemini API",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/FikirFix",
    categories: ["AI/ML & Data Science"]
  },
  {
    id: 14,
    title: "Iris Dataset Machine Learning",
    description: "ML experiments on Iris dataset",
    longDescription: "Applied models like KNN, Decision Trees, Perceptron, Clustering with visualizations and analysis in Jupyter.",
    tech: "Python, Scikit-Learn",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Iris-Dataset-Machine-Learning",
    categories: ["AI/ML & Data Science"]
  },
  {
    id: 15,
    title: "Clustering Demo",
    description: "Data analysis clustering demo",
    longDescription: "Demo of clustering algorithms with visualizations for exploratory data insights.",
    tech: "Python",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/clustering-demo",
    categories: ["AI/ML & Data Science"]
  },
  {
    id: 16,
    title: "Bookbot",
    description: "Automation script for books",
    longDescription: "Tool managing book lists and reading workflows through scripted automation.",
    tech: "Python",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Bookbot",
    categories: ["Desktop & Games"]
  },
  {
    id: 17,
    title: "3D 8 Queens OpenGL",
    description: "Graphics visualization of puzzle",
    longDescription: "3D rendering of 8-Queens puzzle with textures, mouse interactions, and algorithmic highlights.",
    tech: "C++, OpenGL",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/3D-8-Queens-OpenGL",
    categories: ["Graphics & Algorithms"]
  },
  {
    id: 18,
    title: "Solar System OpenGL",
    description: "Interactive solar system simulation",
    longDescription: "Model with hierarchical transforms, rotations, lighting, and animations for immersive visualization.",
    tech: "C++, OpenGL",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Solar-System-OpenGL-c-",
    categories: ["Graphics & Algorithms"]
  },
  {
    id: 19,
    title: "Maze",
    description: "Algorithm visualization tool",
    longDescription: "Maze generator/solver using recursive backtracking and GUI for real-time display.",
    tech: "Python, Tkinter",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Maze",
    categories: ["Graphics & Algorithms", "Desktop & Games"]
  },
  {
    id: 20,
    title: "Celestial Bodies Database",
    description: "Relational database design",
    longDescription: "Schema for celestial bodies with queries, normalization, and exercises from FreeCodeCamp.",
    tech: "SQL",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "https://github.com/LeulTew/Celestial-Bodies-Database",
    categories: ["AI/ML & Data Science"]
  },
  {
    id: 21,
    title: "CS Exit Practice",
    description: "Hyper-Modern Exit Exam Interface",
    longDescription: "A modern web application providing an interactive interface for practicing Computer Science exit exams, targeted at students preparing for university or professional assessments. Hosted on Wasmer Edge for efficient, serverless deployment.",
    tech: "WebAssembly",
    image: "/images/projects/nanobanana.jpg",
    githubUrl: "",
    demoUrl: "https://exitpractice.wasmer.app/",
    categories: ["Web Development"]
  }
];
