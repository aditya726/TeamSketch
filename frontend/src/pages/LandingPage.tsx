import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-indigo-600">TeamSketch</h1>
        <div className="space-x-4">
          <Link to="/login" className="text-gray-600 hover:text-indigo-600 font-medium">Log In</Link>
          <Link to="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">Sign Up</Link>
        </div>
      </nav>

      <main className="flex-grow flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
          Collaborate freely, <br />
          <span className="text-indigo-600">Sync instantly.</span>
        </h2>
        <p className="text-xl text-gray-500 max-w-2xl mb-10">
          The secure, real-time whiteboard for high-performance teams. 
        </p>
        <div className="flex gap-4">
          <Link to="/whiteboard" className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg">
            Start Sketching Now
          </Link>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;