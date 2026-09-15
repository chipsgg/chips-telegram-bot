import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Send, MessageSquare, Shield, Gamepad2, Trophy, Flame, ChevronRight, Zap, Target, Crown, Gift, LineChart, Search, Users, ExternalLink } from "lucide-react";
import "./NeonCasino/styles.css";

// --- Components ---

const GlowingButton = ({ children, onClick, className = "", variant = "pink" }: any) => {
  const base = "relative inline-flex items-center justify-center px-8 py-4 font-display font-bold text-lg rounded-none transition-all duration-300 uppercase tracking-widest overflow-hidden group";
  
  const variants = {
    pink: "bg-transparent text-white border-2 border-[hsl(var(--neon-pink))] hover:bg-[hsl(var(--neon-pink)_/_0.2)] box-glow-pink",
    blue: "bg-transparent text-white border-2 border-[hsl(var(--neon-blue))] hover:bg-[hsl(var(--neon-blue)_/_0.2)] box-glow-blue",
    purple: "bg-[hsl(var(--neon-purple))] text-white border-2 border-[hsl(var(--neon-purple))] hover:bg-[hsl(var(--neon-purple)_/_0.8)] box-glow-purple",
  };

  return (
    <button onClick={onClick} className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <div className="absolute inset-0 h-full w-full scale-0 rounded-none transition-all duration-300 ease-out group-hover:scale-100 group-hover:bg-white/5 z-0"></div>
    </button>
  );
};

const StatCard = ({ value, label, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    className="flex flex-col items-center justify-center p-6 border border-[hsl(var(--neon-blue)_/_0.3)] bg-[hsl(var(--surface)_/_0.8)] backdrop-blur-md relative overflow-hidden"
  >
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[hsl(var(--neon-blue))] to-transparent opacity-50"></div>
    <span className="font-display text-4xl md:text-5xl font-bold text-glow-blue text-white mb-2">{value}</span>
    <span className="font-sans text-sm md:text-base text-gray-400 uppercase tracking-widest">{label}</span>
  </motion.div>
);

const FeatureCard = ({ icon: Icon, title, commands, description, delay = 0, color = "pink" }: any) => {
  const colorMap = {
    pink: "text-[hsl(var(--neon-pink))] border-[hsl(var(--neon-pink)_/_0.3)]",
    blue: "text-[hsl(var(--neon-blue))] border-[hsl(var(--neon-blue)_/_0.3)]",
    purple: "text-[hsl(var(--neon-purple))] border-[hsl(var(--neon-purple)_/_0.3)]"
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className={`p-8 border ${colorMap[color as keyof typeof colorMap].split(' ')[1]} bg-[hsl(var(--surface)_/_0.5)] backdrop-blur-sm group hover:bg-[hsl(var(--surface))] transition-colors duration-300 relative overflow-hidden`}
    >
      <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
        <Icon size={120} />
      </div>
      
      <div className={`mb-6 p-4 inline-block border border-white/10 rounded-xl bg-white/5 ${colorMap[color as keyof typeof colorMap].split(' ')[0]}`}>
        <Icon size={32} />
      </div>
      <h3 className="font-display text-2xl font-bold mb-4 text-white uppercase tracking-wide">{title}</h3>
      <p className="text-gray-400 mb-6 font-sans leading-relaxed">{description}</p>
      
      <div className="flex flex-wrap gap-2">
        {commands.map((cmd: string, i: number) => (
          <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 text-sm font-mono text-gray-300 rounded">
            {cmd}
          </span>
        ))}
      </div>
    </motion.div>
  );
};

// --- Main Page ---

export function NeonCasino() {
  const [activeCommand, setActiveCommand] = useState("prices");
  const [isTyping, setIsTyping] = useState(false);

  // Simulate bot typing effect when switching commands
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 600);
    return () => clearTimeout(timer);
  }, [activeCommand]);

  const demoData: Record<string, { label: string, title: string, content: React.ReactNode }> = {
    prices: {
      label: "Crypto Prices",
      title: "Real-Time Market Data",
      content: (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <div className="flex items-center gap-3"><span className="text-2xl text-[#F7931A]">BTC</span> <span className="font-bold text-white">Bitcoin</span></div>
            <div className="text-right">
              <div className="font-mono text-xl text-white">$64,230.50</div>
              <div className="text-sm text-green-400">+2.4%</div>
            </div>
          </div>
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <div className="flex items-center gap-3"><span className="text-2xl text-[#627EEA]">ETH</span> <span className="font-bold text-white">Ethereum</span></div>
            <div className="text-right">
              <div className="font-mono text-xl text-white">$3,450.20</div>
              <div className="text-sm text-green-400">+1.2%</div>
            </div>
          </div>
          <div className="flex justify-between items-center pb-2">
            <div className="flex items-center gap-3"><span className="text-2xl text-[#14C89E]">USDT</span> <span className="font-bold text-white">Tether</span></div>
            <div className="text-right">
              <div className="font-mono text-xl text-white">$1.00</div>
              <div className="text-sm text-gray-400">0.0%</div>
            </div>
          </div>
        </div>
      )
    },
    slotcall: {
      label: "Random Slot",
      title: "Slot Recommendation",
      content: (
        <div className="text-center py-4">
          <div className="inline-block p-4 border-2 border-[hsl(var(--neon-pink))] box-glow-pink mb-4 rounded-xl bg-black/40">
            <Gamepad2 size={48} className="text-[hsl(var(--neon-pink))] mx-auto mb-2" />
            <h4 className="font-display text-2xl font-bold text-white">Gates of Olympus</h4>
            <p className="text-sm text-gray-400 mt-1">Pragmatic Play</p>
          </div>
          <div className="flex justify-center gap-4 text-sm font-mono text-gray-300">
            <span className="px-3 py-1 bg-white/10 rounded">RTP: 96.5%</span>
            <span className="px-3 py-1 bg-white/10 rounded">Max Win: 5000x</span>
          </div>
        </div>
      )
    },
    bigwins: {
      label: "Big Wins",
      title: "Top Multipliers (24h)",
      content: (
        <div className="space-y-3">
          {[
            { user: "CryptoWhale", game: "Wanted Dead or a Wild", mult: "10,000x", bet: "$5.00" },
            { user: "LuckyDegen", game: "Sweet Bonanza", mult: "5,400x", bet: "$10.00" },
            { user: "Satoshi_Rolls", game: "Money Train 3", mult: "2,100x", bet: "$2.50" }
          ].map((win, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-[hsl(var(--neon-pink))] to-[hsl(var(--neon-purple))] flex items-center justify-center font-bold text-xs">{i+1}</div>
                <div>
                  <div className="font-bold text-white">{win.user}</div>
                  <div className="text-xs text-gray-400 font-mono">{win.game}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-[hsl(var(--neon-pink))]">{win.mult}</div>
                <div className="text-xs text-gray-500">Bet: {win.bet}</div>
              </div>
            </div>
          ))}
        </div>
      )
    },
    promotions: {
      label: "Live Promos",
      title: "Active Casino Events",
      content: (
        <div className="grid gap-4">
          <div className="relative overflow-hidden border border-[hsl(var(--neon-purple))] p-4 bg-gradient-to-r from-[hsl(var(--neon-purple)_/_0.2)] to-transparent">
            <div className="absolute top-0 right-0 px-2 py-1 bg-[hsl(var(--neon-purple))] text-xs font-bold uppercase">Ending Soon</div>
            <h4 className="font-display font-bold text-xl text-white mb-2">$50,000 Weekly Wager Race</h4>
            <p className="text-sm text-gray-300 mb-3">Top 100 players share the prize pool. Play any slot to participate.</p>
            <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
              <div className="bg-[hsl(var(--neon-purple))] w-3/4 h-full"></div>
            </div>
            <div className="text-right text-xs text-gray-400 mt-1">2 days remaining</div>
          </div>
        </div>
      )
    }
  };

  return (
    <div className="neon-casino-theme font-sans selection:bg-[hsl(var(--neon-pink))] selection:text-white">
      
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-20"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[hsl(var(--neon-purple)_/_0.15)] blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[hsl(var(--neon-blue)_/_0.1)] blur-[120px]"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[hsl(var(--dark-bg)_/_0.8)] backdrop-blur-lg">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-[hsl(var(--neon-pink))] flex items-center justify-center box-glow-pink">
              <span className="font-display font-bold text-xl text-white">C</span>
            </div>
            <span className="font-display font-bold text-2xl tracking-widest text-white uppercase">
              Chips<span className="text-[hsl(var(--neon-pink))]">.gg</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded text-xs font-bold tracking-widest uppercase flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              Verified Bot
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 z-10 min-h-[90vh] flex items-center">
        <div className="absolute inset-0 -z-10 opacity-40 mix-blend-screen mask-image:linear-gradient(to_bottom,black,transparent)">
           <img src="/__mockup/images/neon-chips-bg.png" alt="Neon Casino Background" className="w-full h-full object-cover" />
        </div>
        
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[0.9] uppercase tracking-tighter mb-6">
                  The <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--neon-pink))] to-[hsl(var(--neon-purple))] text-glow-pink animate-pulse-glow">Ultimate</span> <br/>
                  Gaming <br/>
                  Companion
                </h1>
                <p className="text-xl md:text-2xl text-gray-300 font-light mb-10 max-w-lg border-l-4 border-[hsl(var(--neon-blue))] pl-6">
                  Bring the electrifying energy of Chips.gg directly into your Discord and Telegram communities.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6">
                  <GlowingButton variant="pink">
                    <MessageSquare size={20} />
                    Add to Discord
                  </GlowingButton>
                  <GlowingButton variant="blue">
                    <Send size={20} />
                    Add to Telegram
                  </GlowingButton>
                </div>
              </motion.div>
            </div>
            
            <div className="relative hidden md:block h-[500px]">
               <motion.div
                 initial={{ opacity: 0, scale: 0.8 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ duration: 0.8, delay: 0.2 }}
                 className="absolute inset-0 flex items-center justify-center animate-float"
               >
                 <div className="relative w-80 h-80">
                   <div className="absolute inset-0 rounded-full border border-[hsl(var(--neon-pink)_/_0.3)] animate-[spin_10s_linear_infinite]"></div>
                   <div className="absolute inset-4 rounded-full border border-[hsl(var(--neon-blue)_/_0.3)] animate-[spin_15s_linear_infinite_reverse]"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <img src="/__mockup/images/neon-bot-avatar.png" alt="Bot Avatar" className="w-64 h-64 object-cover rounded-full box-glow-pink" />
                   </div>
                 </div>
               </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-white/10 bg-[hsl(var(--dark-bg)_/_0.9)] backdrop-blur-xl relative z-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard value="2.4M+" label="Commands Run" delay={0.1} />
            <StatCard value="8.1M+" label="Messages Sent" delay={0.2} />
            <StatCard value="45K+" label="Discord Servers" delay={0.3} />
            <StatCard value="12K+" label="Telegram Groups" delay={0.4} />
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-24 px-6 relative z-10 overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--neon-pink)_/_0.05)] rounded-full blur-[100px] -z-10"></div>
        
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-6xl font-bold text-white uppercase tracking-wider mb-4">Command <span className="text-[hsl(var(--neon-blue))] text-glow-blue">Center</span></h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Experience the power of the Chips.gg bot right here. Click a command to see live simulated results.</p>
          </div>

          <div className="grid md:grid-cols-[250px_1fr] gap-8 bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
            
            <div className="p-6 border-r border-white/10 bg-[hsl(var(--surface)_/_0.5)]">
              <div className="flex items-center gap-2 mb-6 text-gray-500 font-mono text-sm uppercase tracking-widest">
                <Terminal size={16} />
                Available Commands
              </div>
              <div className="space-y-2">
                {Object.keys(demoData).map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => setActiveCommand(cmd)}
                    className={`w-full text-left px-4 py-3 font-mono text-sm rounded transition-all duration-200 flex items-center justify-between ${
                      activeCommand === cmd 
                        ? "bg-[hsl(var(--neon-blue)_/_0.2)] text-[hsl(var(--neon-blue))] border border-[hsl(var(--neon-blue)_/_0.5)] shadow-[0_0_15px_rgba(0,188,255,0.2)]" 
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>/{cmd}</span>
                    <ChevronRight size={14} className={activeCommand === cmd ? "opacity-100" : "opacity-0"} />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 md:p-12 relative min-h-[400px] flex flex-col">
              <div className="flex items-center gap-4 border-b border-white/10 pb-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--surface))] border border-[hsl(var(--neon-blue))] flex items-center justify-center">
                  <span className="font-display font-bold text-[hsl(var(--neon-blue))]">C</span>
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    Chips.gg Bot 
                    <span className="px-1.5 py-0.5 bg-[#5865F2] text-white text-[10px] rounded leading-none">BOT</span>
                  </div>
                  <div className="text-xs text-gray-500">Today at 12:00 AM</div>
                </div>
              </div>

              <div className="flex-1">
                <div className="font-mono text-[hsl(var(--neon-pink))] mb-4">&gt; User executed /{activeCommand}</div>
                
                <AnimatePresence mode="wait">
                  {isTyping ? (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-1"
                    >
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#2B2D31] border-l-4 border-[hsl(var(--neon-blue))] rounded-r-lg p-5 shadow-lg"
                    >
                      <h3 className="font-bold text-white text-lg mb-4">{demoData[activeCommand].title}</h3>
                      {demoData[activeCommand].content}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Full Width Image Break */}
      <section className="h-[40vh] w-full relative">
        <div className="absolute inset-0 z-10 bg-[hsl(var(--dark-bg))] mix-blend-multiply opacity-50"></div>
        <img src="/__mockup/images/neon-big-win.png" alt="Big Win Jackpot" className="w-full h-full object-cover" />
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <h2 className="font-display text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-widest uppercase">
            Hit The <span className="text-[hsl(var(--neon-pink))] text-glow-pink">Jackpot</span>
          </h2>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-24 px-6 relative z-10">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white uppercase tracking-wider mb-2">Platform <span className="text-[hsl(var(--neon-purple))] text-glow-purple">Arsenal</span></h2>
            <div className="w-24 h-1 bg-[hsl(var(--neon-purple))] mb-6"></div>
            <p className="text-gray-400 text-lg">Everything you need to dominate the casino floor, directly in your chat.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard 
              icon={Target}
              title="Real-time Gaming Info"
              description="Instantly access game statistics, discover trending slots, and track the current King of the Hill leader."
              commands={["/slotcall", "/mostplayed", "/koth"]}
              color="blue"
              delay={0.1}
            />
            <FeatureCard 
              icon={Trophy}
              title="Player Stats & Rankings"
              description="Flex your wins, check the leaderboards, and generate visual banners of your casino statistics."
              commands={["/bigwins", "/luckiest", "/stats", "/banner"]}
              color="pink"
              delay={0.2}
            />
            <FeatureCard 
              icon={LineChart}
              title="Platform Updates"
              description="Stay ahead of the market with live crypto pricing, find new games, and never miss a promotion."
              commands={["/promotions", "/prices", "/search"]}
              color="purple"
              delay={0.3}
            />
            <FeatureCard 
              icon={Users}
              title="Community Tools"
              description="Connect with other players, get help, and securely link your account for personalized features."
              commands={["/chat", "/auth", "/help"]}
              color="blue"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* Authentication Explainer */}
      <section className="py-20 px-6 border-y border-white/10 bg-[hsl(var(--surface))] relative z-10">
        <div className="container mx-auto max-w-4xl text-center">
          <Shield size={48} className="mx-auto text-[hsl(var(--neon-blue))] mb-6 text-glow-blue" />
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white uppercase tracking-wider mb-6">Secure Account Linking</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Connect your Chips.gg account to access personalized stats and exclusive features. We use TOTP verification to ensure your account remains completely secure.
          </p>
          
          <div className="inline-block bg-black p-6 border border-[hsl(var(--neon-blue)_/_0.3)] box-glow-blue text-left">
            <div className="text-xs text-gray-500 font-mono uppercase mb-2">Execute Command:</div>
            <code className="font-mono text-lg text-white">
              <span className="text-[hsl(var(--neon-pink))]">/auth</span> username:<span className="text-green-400">YOUR_NAME</span> totp:<span className="text-yellow-400">YOUR_CODE</span>
            </code>
          </div>
        </div>
      </section>

      {/* Support / CTA */}
      <section className="py-32 px-6 relative z-10 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-[hsl(var(--neon-pink)_/_0.1)]"></div>
        
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-5xl md:text-7xl font-black text-white uppercase tracking-tighter mb-8">
            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--neon-pink))] to-[hsl(var(--neon-blue))]">Play?</span>
          </h2>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16">
            <GlowingButton variant="pink" className="!px-12 !py-6 !text-xl">
              Add to Discord
            </GlowingButton>
            <GlowingButton variant="blue" className="!px-12 !py-6 !text-xl">
              Add to Telegram
            </GlowingButton>
          </div>

          <div className="flex justify-center gap-8 text-gray-400 font-mono uppercase tracking-widest text-sm">
            <a href="https://discord.gg/chips" className="hover:text-[hsl(var(--neon-pink))] transition-colors flex items-center gap-2">
              <ExternalLink size={16} /> discord.gg/chips
            </a>
            <a href="https://t.me/chipsgg" className="hover:text-[hsl(var(--neon-blue))] transition-colors flex items-center gap-2">
              <ExternalLink size={16} /> t.me/chipsgg
            </a>
          </div>
        </div>
      </section>

      {/* Footer (REQUIRED) */}
      <footer className="py-8 px-6 border-t border-white/10 bg-black text-center relative z-20">
        <div className="container mx-auto">
          <a 
            href="https://redpkt.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono text-sm uppercase tracking-widest"
          >
            Developed by 
            <span className="font-bold text-white tracking-normal">REDPKT</span>
          </a>
        </div>
      </footer>

    </div>
  );
}
