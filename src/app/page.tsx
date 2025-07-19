"use client"

import FaceTracker from '@/components/FaceTracker';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <main className="container mx-auto px-4 py-8">
        <FaceTracker />
      </main>
      
      {/* Optional footer */}
      <footer className="text-center text-gray-500 text-sm py-6">
        <p>AI Face Tracking Technology © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default HomePage;