import { Link } from 'react-router-dom';

const highlights = [
  {
    title: 'Smart Matching',
    desc: 'AI-powered algorithm matches you with travelers on similar routes with compatible interests.',
    icon: '📈',
  },
  {
    title: 'Safe & Secure',
    desc: 'Contact information shared only after mutual approval. Build trust before connecting.',
    icon: '🛡️',
  },
  {
    title: 'Interest Compatibility',
    desc: 'Find travel companions who share your passions - from music to movies to hobbies.',
    icon: '👥',
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="glass-card min-h-[520px] grid place-items-center text-center px-8 py-14">
        <div className="max-w-4xl space-y-6">
          <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2 text-slate-700">✨ Smart Ride Compatibility Platform</p>
          <h1 className="text-6xl font-extrabold leading-tight">
            Find Your Perfect
            <br />
            <span className="gradient-text">Travel Companion</span>
          </h1>
          <p className="text-4xl md:text-3xl text-slate-600 max-w-3xl mx-auto">
            Connect with compatible travelers based on route similarity and shared interests.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/dashboard" className="primary-btn text-xl px-12">⚡ Start Matching</Link>
            <a href="#why" className="px-10 py-3 text-xl rounded-full border border-slate-300 bg-slate-100 font-semibold">Learn More</a>
          </div>
        </div>
      </section>

      <section id="why" className="space-y-8 pt-4">
        <div className="text-center space-y-3">
          <h2 className="text-6xl font-extrabold">Why Choose <span className="gradient-text">TuneTrip</span></h2>
          <p className="text-4xl md:text-3xl text-slate-600">Advanced technology meets human connection</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {highlights.map((item) => (
            <article key={item.title} className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-400 text-4xl text-white grid place-items-center shadow-xl mb-8">
                {item.icon}
              </div>
              <h3 className="text-4xl md:text-3xl font-bold mb-4">{item.title}</h3>
              <p className="text-2xl md:text-xl text-slate-600 leading-relaxed">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card text-center px-6 py-16">
        <h3 className="text-6xl font-extrabold">Ready to Find Your <span className="gradient-text">Perfect Match?</span></h3>
        <p className="text-3xl text-slate-500 mt-4">Join thousands of travelers who&apos;ve found their ideal ride companions</p>
        <Link to="/login" className="primary-btn mt-8 text-2xl px-14">⚡ Get Started Now</Link>
      </section>
    </div>
  );
}
