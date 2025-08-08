import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// --- Data for Sections ---

const experienceData = [
  {
    title: "Research and Development Intern",
    company: "Nokia",
    date: "Aug 2024 - May 2025",
    description: [
      "Developed a web solution to streamline management and visualization of test results.",
      "Aimed to reduce management workflow by 30% through automation and centralized reporting.",
      "Improved overall productivity by simplifying navigation and analysis of test data across several boards.",
    ],
    tech: ["openGrok", "Markdown", "Tomcat", "Mercurial"],
  },
];

const skillsData = [
  {
    name: "Java",
    icon: <img src="https://www.vectorlogo.zone/logos/java/java-icon.svg" alt="Java" className="w-12 h-12" />,
    color: "from-orange-500 to-red-600"
  },
  {
    name: "Spring Boot", 
    icon: <img src="https://www.vectorlogo.zone/logos/springio/springio-icon.svg" alt="Spring Boot" className="w-12 h-12" />,
    color: "from-green-500 to-green-600"
  },
  {
    name: "MySQL",
    icon: <img src="https://www.vectorlogo.zone/logos/mysql/mysql-icon.svg" alt="MySQL" className="w-12 h-12" />,
    color: "from-blue-500 to-blue-600"
  },
  {
    name: "Python",
    icon: <img src="https://www.vectorlogo.zone/logos/python/python-icon.svg" alt="Python" className="w-12 h-12" />,
    color: "from-yellow-500 to-blue-600"
  },
  {
    name: "Generative AI",
    icon: <img src="https://www.vectorlogo.zone/logos/google_cloud/google_cloud-icon.svg" alt="Generative AI" className="w-12 h-12" />,
    color: "from-purple-500 to-pink-600"
  },
  {
    name: "Git",
    icon: <img src="https://www.vectorlogo.zone/logos/git-scm/git-scm-icon.svg" alt="Git" className="w-12 h-12" />,
    color: "from-red-500 to-orange-600"
  },
  {
    name: "HTML5",
    icon: <img src="https://www.vectorlogo.zone/logos/w3_html5/w3_html5-icon.svg" alt="HTML5" className="w-12 h-12" />,
    color: "from-orange-500 to-red-500"
  },
  {
    name: "Docker",
    icon: <img src="https://www.vectorlogo.zone/logos/docker/docker-icon.svg" alt="Docker" className="w-12 h-12" />,
    color: "from-blue-500 to-cyan-600"
  },
  {
    name: "Flask",
    icon: <img src="https://www.vectorlogo.zone/logos/palletsprojects_flask/palletsprojects_flask-icon.svg" alt="Flask" className="w-12 h-12" />,
    color: "from-gray-600 to-gray-800"
  },
  {
    name: "IntelliJ IDEA",
    icon: <img src="https://upload.wikimedia.org/wikipedia/commons/9/9c/IntelliJ_IDEA_Icon.svg" alt="IntelliJ IDEA" className="w-12 h-12" />,
    color: "from-blue-600 to-purple-600"
  }
];

const projectsData = [
  {
    title: "Blogging Platform API",
    image: "https://placehold.co/600x400/1f2937/4ade80?text=Blogging+API",
    description: [
        "Built a complete backend system using Spring Boot.",
        "Enabled user registration, post creation, likes, and comments.",
        "Implemented full CRUD (Create, Read, Update, Delete) functionality for posts.",
    ],
    tags: ["Spring Boot", "MySQL", "Spring Data JPA", "REST API"],
    link: "https://github.com/siddharth-ranjan/blogging-project",
  },
  {
    title: "Chat with PDF using Gemini",
    image: "https://placehold.co/600x400/1f2937/4ade80?text=Chat+with+PDF",
    description: [
        "Created a web app for interactive document querying.",
        "Allowed users to upload PDFs and extract text automatically.",
        "Used Google's Generative AI to provide fast, context-driven answers from the document.",
    ],
    tags: ["Streamlit", "LangChain", "Generative AI", "FAISS"],
    link: "https://github.com/siddharth-ranjan/multi-pdf-chat",
  },
];

// --- Components ---

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navLinks = ["Experience", "Skills", "Projects", "Contact"];

  return (
    <header className="fixed w-full z-50 top-0" style={{ background: 'rgba(31, 41, 55, 0.5)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <a href="#" className="text-2xl font-bold text-white">Siddharth Ranjan</a>
        <div className="hidden md:flex space-x-8">
          {navLinks.map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} className="text-lg text-gray-300 hover:text-green-400 transition-colors">{link}</a>
          ))}
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </nav>
      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden">
          {navLinks.map(link => (
             <a key={link} href={`#${link.toLowerCase()}`} className="block py-2 px-4 text-sm text-gray-200 hover:bg-gray-700" onClick={() => setIsOpen(false)}>{link}</a>
          ))}
        </div>
      )}
    </header>
  );
};

const Hero = () => (
  <section id="home" className="min-h-screen flex items-center">
    <div className="flex flex-col md:flex-row items-center justify-between w-full gap-12">
      <div className="md:w-1/2 text-center md:text-left">
        <p className="text-lg text-green-400 mb-2 animate-fade-in-up">Hi, my name is</p>
        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>Siddharth Ranjan.</h1>
        <h2 className="text-4xl md:text-6xl font-bold text-gray-400 mb-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>I build robust backend solutions.</h2>
        <p className="max-w-xl mx-auto md:mx-0 text-lg text-gray-300 mb-8 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          I'm a Java developer building a solid foundation in Spring Boot, with a strong interest in exploring the capabilities of Generative AI and Machine Learning. My experience includes an R&D internship at Nokia and a strong background in competitive programming.
        </p>
        <div className="flex flex-wrap justify-center md:justify-start gap-4 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
          <a href="#projects" className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300">View My Projects</a>
          <a href="/resume" target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300">View Resume</a>
        </div>
      </div>
      <div className="md:w-1/2 lg:w-1/3 mt-12 md:mt-0 reveal">
        <a href="/image" className="block">
          <img 
            src="https://myimagesiddharth.blob.core.windows.net/$web/photo.jpeg" 
            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/400x400/1f2937/d1d5db?text=SR'; }} 
            alt="Siddharth Ranjan" 
            className="rounded-2xl shadow-lg w-full max-w-sm mx-auto cursor-pointer hover:scale-105 transition-transform duration-300" 
          />
        </a>
      </div>
    </div>
  </section>
);

const Experience = () => (
  <section id="experience" className="py-20">
    <h2 className="text-4xl font-bold text-center mb-12 text-white reveal">Experience</h2>
    <div className="max-w-3xl mx-auto">
      {experienceData.map((job, index) => (
        <div key={index} className="bg-gray-800 rounded-lg p-6 mb-8 reveal transition duration-300 hover:shadow-lg hover:shadow-green-500/10">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-2">
            <div>
              <h3 className="text-2xl font-bold text-white">{job.title}</h3>
              <p className="text-lg text-green-400 font-semibold">{job.company}</p>
            </div>
            <p className="text-gray-400 mt-2 sm:mt-0">{job.date}</p>
          </div>
          <ul className="text-gray-300 mt-4 list-disc space-y-2 pl-5">
            {job.description.map((point, i) => <li key={i}>{point}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2 mt-4">
            {job.tech.map(t => <span key={t} className="bg-green-900 text-green-300 text-sm font-medium px-2.5 py-0.5 rounded">{t}</span>)}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const Skills = () => (
  <section id="skills" className="py-20">
    <h2 className="text-4xl font-bold text-center mb-12 text-white reveal">Skills</h2>
    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      {skillsData.map((skill, index) => (
        <div 
          key={skill.name} 
          className="bg-gray-800 p-6 rounded-xl reveal transition duration-300 hover:shadow-lg hover:shadow-green-500/20 hover:scale-105 group"
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              {skill.icon}
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors duration-300">
              {skill.name}
            </h3>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const Projects = () => (
  <section id="projects" className="py-20">
    <h2 className="text-4xl font-bold text-center mb-12 text-white reveal">Projects</h2>
    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {projectsData.map((project, index) => (
        <div key={index} className="bg-gray-800 rounded-lg overflow-hidden transition duration-300 hover:shadow-lg hover:shadow-green-500/10 reveal">
          <img src={project.image} alt={project.title} className="w-full h-48 object-cover" />
          <div className="p-6">
            <h3 className="text-2xl font-bold text-white mb-2">{project.title}</h3>
            <ul className="text-gray-400 mb-4 list-disc space-y-2 pl-5">
              {project.description.map((point, i) => <li key={i}>{point}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2 mb-4">
              {project.tags.map(tag => <span key={tag} className="bg-green-900 text-green-300 text-sm font-medium px-2.5 py-0.5 rounded">{tag}</span>)}
            </div>
            <div className="flex space-x-4">
              <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">GitHub</a>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const Contact = () => (
  <section id="contact" className="py-20">
    <h2 className="text-4xl font-bold text-center mb-12 text-white reveal">Get In Touch</h2>
    <div className="max-w-lg mx-auto text-center">
      <p className="text-lg text-gray-300 mb-8 reveal">
        I'm actively seeking new opportunities and collaborations. If you have an interesting project or just want to connect, feel free to reach out!
      </p>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 reveal">
        <a href="mailto:siddharthranjan0909@gmail.com" className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300">Email Me</a>
        <a href="https://www.linkedin.com/in/siddharth-ranjan09/" target="_blank" rel="noopener noreferrer" className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300">LinkedIn</a>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-gray-900 py-6">
    <div className="container mx-auto px-6 text-center text-gray-500">
      <p>&copy; {new Date().getFullYear()} Siddharth Ranjan. All rights reserved.</p>
      <p>
        <a href="https://github.com/siddharth-ranjan" target="_blank" rel="noopener noreferrer" className="hover:text-green-400">GitHub</a> | {' '}
        <a href="https://leetcode.com/u/sid0909/" target="_blank" rel="noopener noreferrer" className="hover:text-green-400">LeetCode</a>
      </p>
    </div>
  </footer>
);

// Portfolio Component (your existing portfolio)
const Portfolio = () => {
  // Initialize ScrollReveal and set document title
  useEffect(() => {
    // Set document title
    document.title = "Portfolio - Siddharth Ranjan";
    
    // Set favicon for portfolio page
    const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.type = 'image/png';
    favicon.rel = 'shortcut icon';
    favicon.href = "https://myimagesiddharth.blob.core.windows.net/$web/portfolio-icon.png";
    if (!document.querySelector("link[rel*='icon']")) {
      document.getElementsByTagName('head')[0].appendChild(favicon);
    }
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/scrollreveal';
    script.async = true;

    script.onload = () => {
      if (window.ScrollReveal) {
        const sr = window.ScrollReveal({
          delay: 200,
          distance: '50px',
          origin: 'bottom',
          easing: 'ease-in-out',
          reset: false,
        });

        sr.reveal('.reveal');
        
        sr.reveal('.animate-fade-in-up', {
          distance: '20px',
          opacity: 0,
          duration: 800,
          easing: 'cubic-bezier(0.5, 0, 0, 1)',
          interval: 200,
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="bg-gray-900 text-gray-300 antialiased">
      <Header />
      <main className="container mx-auto px-6 pt-24">
        <Hero />
        <Experience />
        <Skills />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

// Image Component for the /image route
const ImagePage = () => {
  useEffect(() => {
    // Set document title and favicon for image page
    document.title = "Photo - Siddharth Ranjan";
    
    const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.type = 'image/png';
    favicon.rel = 'shortcut icon';
    favicon.href = "https://myimagesiddharth.blob.core.windows.net/$web/photo-icon.png";
    if (!document.querySelector("link[rel*='icon']")) {
      document.getElementsByTagName('head')[0].appendChild(favicon);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-white mb-8">Siddharth Ranjan</h1>
        <img 
          src="https://myimagesiddharth.blob.core.windows.net/$web/photo.jpeg" 
          alt="Siddharth Ranjan" 
          className="rounded-2xl shadow-lg w-full max-w-md mx-auto"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://placehold.co/400x400/1f2937/d1d5db?text=SR';
          }}
        />
        <div className="mt-8">
          <a 
            href="/" 
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
          >
            Back to Portfolio
          </a>
        </div>
      </div>
    </div>
  );
};

// Resume Component for the /resume route
const ResumePage = () => {
  useEffect(() => {
    // Set document title and favicon for resume page
    document.title = "Resume - Siddharth Ranjan";
    
    // Remove existing favicon and create new one
    const existingFavicon = document.querySelector("link[rel*='icon']");
    if (existingFavicon) {
      existingFavicon.remove();
    }
    
    const favicon = document.createElement('link');
    favicon.type = 'image/png';
    favicon.rel = 'shortcut icon';
    favicon.href = "https://myimagesiddharth.blob.core.windows.net/$web/resume-icon.png";
    document.getElementsByTagName('head')[0].appendChild(favicon);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center mb-6">
        <h1 className="text-4xl font-bold text-white mb-4">Resume</h1>
        <p className="text-gray-300 mb-6">Siddharth Ranjan</p>
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <a 
            href="https://myimagesiddharth.blob.core.windows.net/$web/siddharth-ranjan-resume.pdf" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
          >
            Download PDF
          </a>
          <a 
            href="/" 
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
          >
            Back to Portfolio
          </a>
        </div>
      </div>
      
      {/* PDF Viewer */}
      <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <iframe
          src="https://myimagesiddharth.blob.core.windows.net/$web/siddharth-ranjan-resume.pdf"
          className="w-full h-[80vh] min-h-[600px]"
          title="Siddharth Ranjan Resume"
        />
      </div>
    </div>
  );
};

// --- Main App Component with Routing ---
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/image" element={<ImagePage />} />
        <Route path="/resume" element={<ResumePage />} />
      </Routes>
    </Router>
  );
}
