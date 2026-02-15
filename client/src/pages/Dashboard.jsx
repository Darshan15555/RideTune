import { Link } from 'react-router-dom';

const items = [
  {
    to: '/post-ride',
    title: 'Post Ride',
    desc: 'Share your journey and find compatible travelers',
    icon: '➕',
    tone: 'from-purple-500 to-indigo-400',
  },
  {
    to: '/search-ride',
    title: 'Search Rides',
    desc: 'Find rides matching your route and interests',
    icon: '🔍',
    tone: 'from-cyan-500 to-sky-400',
  },
  {
    to: '/requests',
    title: 'My Requests',
    desc: 'View and manage your ride requests',
    icon: '📝',
    tone: 'from-pink-500 to-fuchsia-400',
  },
];

export default function Dashboard() {
  return (
    <section className="glass-card p-10 max-w-5xl mx-auto">
      <h2 className="text-6xl font-extrabold mb-3">Welcome to <span className="gradient-text">TuneTrip</span></h2>
      <p className="text-3xl text-slate-500 mb-10">Choose an action to get started</p>
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="border border-slate-300 rounded-3xl p-7 hover:border-purple-300 hover:shadow-md transition">
            <div className={`h-[72px] w-[72px] rounded-3xl bg-gradient-to-br ${item.tone} text-white text-4xl grid place-items-center shadow-xl mb-6`}>
              {item.icon}
            </div>
            <h3 className="text-4xl md:text-3xl font-bold mb-3">{item.title}</h3>
            <p className="text-2xl md:text-xl text-slate-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
