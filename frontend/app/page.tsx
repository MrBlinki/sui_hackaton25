import Link from "next/link";
import App from "./App";

export default function Home() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Welcome to Counter App
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A beautiful and modern counter application built with Next.js, Tailwind CSS, and shadcn/ui components.
          </p>
          
          <div className="mt-8 flex gap-4 justify-center flex-wrap">
            <Link 
              href="/simple-audio" 
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              🎵 Lecteur Audio Simple
            </Link>
            <Link 
              href="/audio-player" 
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
            >
              🌊 Lecteur Audio Avancé
            </Link>
          </div>
        </div>
        
        <div className="flex justify-center">
          <App />
        </div>
      </div>
    </div>
  );
}