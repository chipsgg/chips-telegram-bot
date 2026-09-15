import React, { useState } from 'react';
import { Bot, Shield, ShieldCheck, Trophy, TrendingUp, MessageSquare, ChevronRight, Lock, Command, Activity, Users, Database, HelpCircle, CheckCircle2 } from 'lucide-react';
import './VipHighRoller/styles.css';

export function VipHighRoller() {
  const [activeTab, setActiveTab] = useState('prices');

  const demoData = {
    prices: {
      desc: "Real-time cryptocurrency prices at a glance.",
      cmd: "/prices",
      content: (
        <div className="space-y-3 font-mono text-sm">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-gray-400">BTC</span>
            <span className="text-gold">$94,241.50</span>
            <span className="text-green-400">+2.4%</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-gray-400">ETH</span>
            <span className="text-gold">$3,450.20</span>
            <span className="text-green-400">+1.1%</span>
          </div>
          <div className="flex justify-between items-center pb-2">
            <span className="text-gray-400">SOL</span>
            <span className="text-gold">$182.40</span>
            <span className="text-red-400">-0.5%</span>
          </div>
        </div>
      )
    },
    slotcall: {
      desc: "Randomly selected slot recommendations.",
      cmd: "/slotcall",
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-gold text-lg font-serif mb-1">Gates of Olympus</div>
            <div className="text-gray-400 text-sm">Pragmatic Play</div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 bg-black/50 p-2 rounded">
            <span>RTP: 96.50%</span>
            <span>Max Win: 5,000x</span>
          </div>
        </div>
      )
    },
    mostplayed: {
      desc: "See what the high rollers are playing right now.",
      cmd: "/mostplayed",
      content: (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gold font-serif">01</span>
            <span className="text-gray-200">Sweet Bonanza</span>
            <span className="ml-auto text-gray-500">1,240 players</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 font-serif">02</span>
            <span className="text-gray-200">Wanted Dead or a Wild</span>
            <span className="ml-auto text-gray-500">985 players</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-serif">03</span>
            <span className="text-gray-200">Starlight Princess</span>
            <span className="ml-auto text-gray-500">842 players</span>
          </div>
        </div>
      )
    },
    bigwins: {
      desc: "The largest recent payouts on the platform.",
      cmd: "/bigwins",
      content: (
        <div className="space-y-3 text-sm">
          <div className="bg-gradient-to-r from-yellow-600/20 to-transparent p-3 rounded border-l-2 border-gold">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white font-medium">CryptoWhale</span>
              <span className="text-gold font-serif text-lg">$245,000</span>
            </div>
            <div className="text-xs text-gray-400">Sweet Bonanza • 2,450x</div>
          </div>
          <div className="p-3 rounded border-l-2 border-gray-700 bg-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white font-medium">DegenKing</span>
              <span className="text-gray-300 font-serif text-lg">$182,500</span>
            </div>
            <div className="text-xs text-gray-500">Gates of Olympus • 1,825x</div>
          </div>
        </div>
      )
    },
    luckiest: {
      desc: "Players hitting the highest multipliers.",
      cmd: "/luckiest",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold border border-gold/30">
              <Trophy size={18} />
            </div>
            <div>
              <div className="text-white font-medium">LuckyStrike</div>
              <div className="text-xs text-gray-400">Mental</div>
            </div>
            <div className="ml-auto text-gold font-serif">15,000x</div>
          </div>
          <div className="flex items-center gap-4 opacity-70">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 border border-white/10">
              2
            </div>
            <div>
              <div className="text-white font-medium">SpinMaster</div>
              <div className="text-xs text-gray-400">Dead or Alive 2</div>
            </div>
            <div className="ml-auto text-gray-300 font-serif">12,400x</div>
          </div>
        </div>
      )
    },
    koth: {
      desc: "Current King of the Hill status.",
      cmd: "/koth",
      content: (
        <div className="text-center p-4 border border-gold/30 bg-gold/5 rounded-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50"></div>
          <Trophy className="mx-auto text-gold mb-2" size={24} />
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Current King</div>
          <div className="text-xl font-serif text-white mb-2">HighRoller99</div>
          <div className="inline-block px-3 py-1 bg-black/50 rounded-full text-sm text-gold border border-gold/20">
            Prize Pool: $50,000
          </div>
        </div>
      )
    },
    promotions: {
      desc: "Live platform promotions and events.",
      cmd: "/promotions",
      content: (
        <div className="space-y-3">
          <div className="p-3 border border-gold/20 bg-black/40 rounded">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gold font-medium">Weekend Race</span>
              <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">Live</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">Compete for a share of $100,000 in our weekend multiplier race.</div>
            <div className="text-xs text-gray-500">Ends in 2d 14h</div>
          </div>
        </div>
      )
    }
  };

  return (
    <div className="vip-theme">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 py-4">
        <div className="container mx-auto px-6 max-w-6xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/__mockup/images/vip-gold-chip.png" alt="Chips.gg Icon" className="w-8 h-8 rounded-full border border-gold/30 shadow-[0_0_10px_rgba(212,175,55,0.2)]" />
            <span className="font-serif font-bold text-xl tracking-wider text-white">CHIPS<span className="text-gold">.GG</span></span>
          </div>
          <div className="hidden md:flex gap-4">
            <button className="btn-gold px-6 py-2 text-sm tracking-widest uppercase">Discord</button>
            <button className="btn-gold-solid px-6 py-2 text-sm tracking-widest uppercase text-black font-semibold">Telegram</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden bg-hero-img">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-[#050505] z-0"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)] z-0"></div>
        
        <div className="container mx-auto px-6 max-w-4xl relative z-10 text-center flex flex-col items-center">
          <div className="fade-in-up inline-flex items-center gap-2 border border-gold/30 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full mb-8">
            <CheckCircle2 size={14} className="text-gold" />
            <span className="text-xs uppercase tracking-widest text-gold font-medium">Verified Bot</span>
          </div>
          
          <h1 className="fade-in-up delay-100 font-serif text-5xl md:text-7xl font-bold leading-tight mb-6">
            ELEVATE YOUR <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dim via-[#D4AF37] to-gold-dim text-glow">GAMING PRESTIGE</span>
          </h1>
          
          <p className="fade-in-up delay-200 text-lg md:text-xl text-gray-400 font-light max-w-2xl mx-auto mb-12 tracking-wide leading-relaxed">
            Your Ultimate Gaming & Crypto Companion. Bring the exclusive Chips.gg casino experience directly into your private channels.
          </p>
          
          <div className="fade-in-up delay-300 flex flex-col sm:flex-row gap-6 w-full justify-center">
            <button className="btn-gold-solid flex items-center justify-center gap-3 px-8 py-4 text-sm tracking-widest uppercase font-semibold">
              <MessageSquare size={18} />
              Add to Discord
            </button>
            <button className="btn-gold flex items-center justify-center gap-3 px-8 py-4 text-sm tracking-widest uppercase">
              <Command size={18} />
              Add to Telegram
            </button>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="py-16 border-y border-white/5 bg-black/40 relative z-10">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center">
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-serif text-gold">14.2M</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Commands Run</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-serif text-gold">42.8M</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Messages Sent</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-serif text-gold">84.5K</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Discord Users</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-serif text-gold">112K</div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Telegram Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Area */}
      <section className="py-24 relative z-10 bg-texture-img">
        <div className="absolute inset-0 bg-[#050505]/90 z-0"></div>
        
        <div className="container mx-auto px-6 max-w-5xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4 text-white">EXPERIENCE THE COMMAND</h2>
            <div className="w-16 h-0.5 bg-gold mx-auto mb-4"></div>
            <p className="text-gray-400 tracking-wide">Real-time data and insights, summoned instantly.</p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="md:col-span-5 flex flex-col gap-2">
              {Object.keys(demoData).map((key) => (
                <button 
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`text-left px-5 py-4 flex items-center justify-between transition-all ${
                    activeTab === key 
                      ? 'bg-gold/10 border-l-2 border-gold text-white' 
                      : 'bg-transparent border-l-2 border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span className="font-mono text-sm tracking-wider">/{key}</span>
                  {activeTab === key && <ChevronRight size={16} className="text-gold" />}
                </button>
              ))}
            </div>
            
            <div className="md:col-span-7">
              <div className="glass-panel-static p-6 rounded-lg min-h-[300px] flex flex-col">
                <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                  <img src="/__mockup/images/vip-gold-chip.png" alt="Bot Avatar" className="w-10 h-10 rounded-full border border-gold/20" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">Chips.gg Bot</span>
                      <span className="bg-gold/20 text-gold text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded">Bot</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{demoData[activeTab as keyof typeof demoData].cmd}</div>
                  </div>
                </div>
                
                <div className="flex-1 bg-black/40 rounded p-5 border border-white/5">
                  <div className="text-sm text-gray-300 mb-6 italic">
                    {demoData[activeTab as keyof typeof demoData].desc}
                  </div>
                  {demoData[activeTab as keyof typeof demoData].content}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-24 relative z-10 border-t border-white/5 bg-[#080808]">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4 text-white">BESPOKE FEATURES</h2>
            <div className="w-16 h-0.5 bg-gold mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-panel p-8 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-gold mb-6 border border-gold/20">
                <Activity size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold mb-3 text-white">Real-time Gaming Info</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">Access live casino data without leaving your conversation. Perfect for fast-paced decision making.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/slotcall</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/mostplayed</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/koth</span>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-gold mb-6 border border-gold/20">
                <Trophy size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold mb-3 text-white">Player Stats & Rankings</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">Track the high rollers and display your own prestige with beautifully generated stat banners.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/bigwins</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/luckiest</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/stats</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/banner</span>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-gold mb-6 border border-gold/20">
                <TrendingUp size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold mb-3 text-white">Platform Updates</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">Never miss a lucrative opportunity. Get instant updates on promotions and live cryptocurrency markets.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/promotions</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/prices</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/search</span>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-gold mb-6 border border-gold/20">
                <Users size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold mb-3 text-white">Community Tools</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">Connect deeply with the ecosystem. Secure your profile and integrate seamlessly with community channels.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/chat</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/auth</span>
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-gray-300">/help</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authentication & Security */}
      <section className="py-24 relative z-10 border-t border-white/5 bg-[#050505]">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="bg-gradient-to-br from-[#111] to-black border border-white/10 rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch shadow-2xl">
            <div className="p-10 md:w-1/2 flex flex-col justify-center border-r border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
              <Lock className="text-gold mb-6" size={32} />
              <h3 className="font-serif text-2xl font-bold mb-4 text-white">Ironclad Authentication</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">
                Your security is paramount. Link your Chips.gg account to unlock personalized tracking, secure vault management, and exclusive high-roller commands.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 mt-0.5">1</div>
                  <p className="text-sm text-gray-300">Enable 2FA/TOTP on your Chips.gg account settings.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 mt-0.5">2</div>
                  <p className="text-sm text-gray-300">Run the authorization command in a secure channel.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 mt-0.5">3</div>
                  <p className="text-sm text-gray-300">Instantly receive confirmation of successful linking.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-black/60 p-10 md:w-1/2 flex items-center justify-center font-mono">
              <div className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-5 shadow-inner">
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                </div>
                <div className="text-gray-400 text-sm mb-2"># enter command securely</div>
                <div className="text-white text-sm break-all leading-relaxed">
                  <span className="text-gold">/auth</span> username:<span className="text-green-400">YOUR_NAME</span> totp:<span className="text-blue-400">YOUR_CODE</span>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 text-gray-500 text-xs flex items-center gap-2">
                  <ShieldCheck size={14} className="text-gold" />
                  End-to-end encrypted connection
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support / Community */}
      <section className="py-20 relative z-10 border-t border-white/5 bg-texture-img">
        <div className="absolute inset-0 bg-[#050505]/95 z-0"></div>
        <div className="container mx-auto px-6 max-w-4xl text-center relative z-10">
          <h2 className="font-serif text-3xl font-bold mb-6 text-white">JOIN THE INNER CIRCLE</h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto">
            Experience the ultimate gaming community. Support, high-stakes discussion, and real-time alerts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://discord.gg/chips" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 hover:border-gold/50 hover:bg-white/10 text-white rounded transition-all text-sm uppercase tracking-widest">
              <MessageSquare size={16} />
              discord.gg/chips
            </a>
            <a href="https://t.me/chipsgg" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 hover:border-gold/50 hover:bg-white/10 text-white rounded transition-all text-sm uppercase tracking-widest">
              <Command size={16} />
              t.me/chipsgg
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 bg-black relative z-10 text-center">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/__mockup/images/vip-gold-chip.png" alt="Chips.gg" className="w-5 h-5 rounded-full opacity-50" />
              <span className="text-gray-600 text-sm font-serif font-bold tracking-wider">CHIPS.GG BOT</span>
            </div>
            
            <div className="text-gray-500 text-xs tracking-widest uppercase flex items-center gap-2">
              Developed by 
              <a href="https://redpkt.com" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-white transition-colors font-medium">
                REDPKT
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
