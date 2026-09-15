import React, { useState, useEffect } from 'react';
import { Terminal, ShieldCheck, Activity, Cpu, Send, MessageSquare, Zap, Target, Lock, HelpCircle, ArrowRight, ExternalLink, ChevronRight, BarChart3, TrendingUp, Trophy } from 'lucide-react';
import './terminal/terminal.css';

// --- Data Models for Demo ---
const DEMO_COMMANDS = [
  { id: 'prices', label: '/prices', desc: 'Crypto prices', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'slotcall', label: '/slotcall', desc: 'Random slot pick', icon: <Target className="w-4 h-4" /> },
  { id: 'mostplayed', label: '/mostplayed', desc: 'Top games', icon: <Activity className="w-4 h-4" /> },
  { id: 'bigwins', label: '/bigwins', desc: 'Biggest wins', icon: <Trophy className="w-4 h-4" /> },
  { id: 'luckiest', label: '/luckiest', desc: 'Luckiest players', icon: <Zap className="w-4 h-4" /> },
  { id: 'koth', label: '/koth', desc: 'King of the Hill', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'promotions', label: '/promotions', desc: 'Live promos', icon: <MessageSquare className="w-4 h-4" /> },
];

const DEMO_RESPONSES: Record<string, string> = {
  prices: `[ SYSTEM: FETCHING MARKET DATA ]...
> BTC  $64,231.00  [+2.4%]
> ETH  $ 3,412.50  [+1.1%]
> SOL  $   142.10  [-0.8%]
> CHIP $     0.05  [+12.4%]
MARKET STATUS: VOLATILE / BULLISH`,
  slotcall: `[ SYSTEM: ANALYZING GAME PATTERNS ]...
> RECOMMENDED SLOT: "TOME OF MADNESS"
> PROVIDER: PLAY'N GO
> VOLATILITY: HIGH
> CURRENT HOT RATING: 88%
[ Execute /play tome-of-madness to launch ]`,
  mostplayed: `[ SYSTEM: COMPILING ACTIVITY LOGS ]...
--- TOP 3 GAMES (24H) ---
1. SWEET BONANZA (Pragmatic) - 45,210 spins
2. GATES OF OLYMPUS (Pragmatic) - 38,100 spins
3. PLINKO (Originals) - 89,400 drops`,
  bigwins: `[ SYSTEM: QUERYING HIGH ROLLER DB ]...
--- RECENT BIG WINS ---
> User: DegenKing_99
> Game: Wanted Dead or a Wild
> Bet: $10.00 | Win: $125,000.00 (12,500x)
[ Time: 4 mins ago ]`,
  luckiest: `[ SYSTEM: CALCULATING RTP ANOMALIES ]...
--- LUCKIEST PLAYERS (WEEKLY) ---
1. @CryptoWhale  [ RTP: 1,450% ]
2. @SpinMaster   [ RTP:   820% ]
3. @LuckyStrike  [ RTP:   450% ]`,
  koth: `[ SYSTEM: CHECKING THRONE STATUS ]...
--- KING OF THE HILL ---
> CURRENT KING: @HighRoller_BTC
> REIGN DURATION: 14h 22m
> BOUNTY ACCUMULATED: $4,500.00
[ Use /koth challenge to compete ]`,
  promotions: `[ SYSTEM: CHECKING ACTIVE EVENTS ]...
--- LIVE PROMOTIONS ---
> WEEKLY WAGER RACE: $50,000 Prize Pool (Ends in 2d 4h)
> MULTIPLIER MADNESS: Hit 1000x on any Hacksaw slot for $100 bonus
> CHIP DROP: Random drops in Discord chat every 4 hours`
};

const TypewriterText = ({ text, delay = 0, speed = 30 }: { text: string, delay?: number, speed?: number }) => {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayed(text.substring(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay, speed]);

  return <span>{displayed}</span>;
};

export function CryptoTerminal() {
  const [activeCmd, setActiveCmd] = useState<string>('prices');
  const [cmdOutput, setCmdOutput] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setIsTyping(true);
    setCmdOutput('');
    const fullText = DEMO_RESPONSES[activeCmd] || 'Error: Command not found.';
    
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setCmdOutput(fullText.substring(0, i));
        i += Math.floor(Math.random() * 3) + 1; // Type 1-3 chars at a time for realism
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [activeCmd]);

  return (
    <div className="terminal-theme terminal-container min-h-screen font-mono text-sm md:text-base relative pb-24">
      {/* Background Graphic (dimmed) */}
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none mix-blend-screen"
        style={{ 
          backgroundImage: 'url(/__mockup/images/crypto-terminal-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />

      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-40 terminal-panel terminal-border-b flex flex-col md:flex-row items-center justify-between p-4 bg-opacity-90 backdrop-blur">
        <div className="flex items-center gap-4 w-full md:w-auto mb-4 md:mb-0">
          <div className="text-[var(--term-green)] font-bold text-xl tracking-widest glitch" data-text="CHIPS.GG">
            CHIPS.GG
          </div>
          <div className="px-2 py-1 terminal-border text-xs flex items-center gap-2 text-[var(--term-green)]">
            <span className="w-2 h-2 bg-[var(--term-green)] rounded-full animate-blink inline-block"></span>
            VERIFIED BOT
          </div>
        </div>
        <div className="hidden md:flex gap-6 text-xs text-[var(--term-text-muted)]">
          <a href="#demo" className="hover:text-[var(--term-green)] transition-colors">[ DEMO ]</a>
          <a href="#features" className="hover:text-[var(--term-green)] transition-colors">[ FEATURES ]</a>
          <a href="#auth" className="hover:text-[var(--term-green)] transition-colors">[ AUTH ]</a>
        </div>
      </nav>

      {/* Global Ticker */}
      <div className="w-full overflow-hidden terminal-panel terminal-border-b py-2 text-xs text-[var(--term-green)] uppercase tracking-wider relative z-10 flex">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="mx-4">BTC $64,231.00 <span className="text-green-400">▲2.4%</span></span>
          <span className="mx-4">ETH $3,412.50 <span className="text-green-400">▲1.1%</span></span>
          <span className="mx-4">SOL $142.10 <span className="text-red-500">▼0.8%</span></span>
          <span className="mx-4">CHIP $0.05 <span className="text-green-400">▲12.4%</span></span>
          <span className="mx-4 text-[var(--term-text-muted)]">// SYSTEM ONLINE //</span>
          {/* Duplicate for infinite effect */}
          <span className="mx-4">BTC $64,231.00 <span className="text-green-400">▲2.4%</span></span>
          <span className="mx-4">ETH $3,412.50 <span className="text-green-400">▲1.1%</span></span>
          <span className="mx-4">SOL $142.10 <span className="text-red-500">▼0.8%</span></span>
          <span className="mx-4">CHIP $0.05 <span className="text-green-400">▲12.4%</span></span>
          <span className="mx-4 text-[var(--term-text-muted)]">// SYSTEM ONLINE //</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-12 relative z-10 space-y-24">
        
        {/* HERO SECTION */}
        <section className="flex flex-col lg:flex-row items-center gap-12 mt-12">
          <div className="lg:w-1/2 space-y-8">
            <div className="space-y-2">
              <p className="text-[var(--term-text-muted)]">root@chips-bot:~# ./initialize_companion.sh</p>
              <h1 className="text-4xl md:text-6xl font-bold text-[var(--term-green)] leading-tight terminal-text-glow">
                YOUR ULTIMATE<br/>
                GAMING & CRYPTO<br/>
                COMPANION.
              </h1>
            </div>
            
            <div className="terminal-panel terminal-border p-4 inline-block text-[var(--term-text-muted)] border-l-4 border-l-[var(--term-green)]">
              <TypewriterText text="> Bringing the Chips.gg crypto-casino directly into your Discord and Telegram. Real-time prices, stats, and alpha." delay={500} speed={20} />
              <span className="animate-blink">_</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button className="terminal-border hover:terminal-border-active bg-[var(--term-green-dim)] text-[var(--term-green)] px-6 py-3 flex items-center justify-center gap-3 transition-all duration-200 group">
                <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                [ ADD TO DISCORD ]
              </button>
              <button className="terminal-border hover:terminal-border-active bg-transparent hover:bg-[var(--term-green-dim)] text-[var(--term-green)] px-6 py-3 flex items-center justify-center gap-3 transition-all duration-200 group">
                <Send className="w-5 h-5 group-hover:scale-110 transition-transform" />
                [ ADD TO TELEGRAM ]
              </button>
            </div>
          </div>
          
          <div className="lg:w-1/2 w-full">
            <div className="relative aspect-video terminal-border terminal-panel overflow-hidden p-2 group">
              <div className="absolute inset-0 bg-[var(--term-green-glow)] opacity-0 group-hover:opacity-10 transition-opacity duration-1000 pointer-events-none"></div>
              <img 
                src="/__mockup/images/crypto-terminal-hero.png" 
                alt="Terminal Data visualization" 
                className="w-full h-full object-cover opacity-80 mix-blend-screen"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--term-bg)] via-transparent to-transparent"></div>
              
              {/* Overlay stats on image */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono">
                <div><span className="text-[var(--term-text-muted)]">STATUS:</span> <span className="animate-pulse">CONNECTED</span></div>
                <div><span className="text-[var(--term-text-muted)]">LATENCY:</span> 12ms</div>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE STATS COUNTERS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'COMMANDS RUN', value: '42,891,032', prefix: '>' },
            { label: 'MESSAGES SENT', value: '184,002,941', prefix: '>' },
            { label: 'DISCORD SERVERS', value: '14,204', prefix: '#' },
            { label: 'TELEGRAM CHATS', value: '8,941', prefix: '@' },
          ].map((stat, i) => (
            <div key={i} className="terminal-panel terminal-border p-6 flex flex-col justify-between group hover:border-[var(--term-green)] transition-colors">
              <div className="text-[var(--term-text-muted)] text-xs mb-4">{stat.label}</div>
              <div className="text-2xl md:text-3xl font-bold text-[var(--term-green)] terminal-text-glow">
                <span className="opacity-50 mr-2 text-sm">{stat.prefix}</span>
                {stat.value}
              </div>
            </div>
          ))}
        </section>

        {/* INTERACTIVE LIVE DEMO */}
        <section id="demo" className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold border-b border-[var(--term-green)] pb-2 inline-block">/// LIVE_DEMO.EXE</h2>
            <div className="h-px bg-[var(--term-border)] flex-grow"></div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6 h-[500px]">
            {/* Command List */}
            <div className="lg:w-1/3 flex flex-col gap-2 terminal-panel terminal-border p-4 overflow-y-auto">
              <div className="text-xs text-[var(--term-text-muted)] mb-2 uppercase tracking-widest">Select Command:</div>
              {DEMO_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => setActiveCmd(cmd.id)}
                  className={`flex items-center justify-between p-3 terminal-border transition-all text-left ${
                    activeCmd === cmd.id 
                      ? 'bg-[var(--term-green-dim)] border-[var(--term-green)] text-[var(--term-green)] shadow-[0_0_10px_var(--term-green-glow)]' 
                      : 'hover:border-[var(--term-green)] text-[var(--term-text-muted)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {cmd.icon}
                    <span className="font-bold">{cmd.label}</span>
                  </div>
                  <span className="text-xs opacity-70 hidden sm:block">{cmd.desc}</span>
                </button>
              ))}
            </div>

            {/* Output Window */}
            <div className="lg:w-2/3 terminal-panel terminal-border relative flex flex-col">
              <div className="border-b border-[var(--term-border)] p-2 px-4 flex justify-between items-center bg-[var(--term-bg)]">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-900 border border-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-900 border border-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-900 border border-green-500"></div>
                </div>
                <div className="text-xs text-[var(--term-text-muted)]">bash — {activeCmd} — 80x24</div>
              </div>
              
              <div className="p-6 flex-grow overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap relative">
                <div className="text-[var(--term-text-muted)] mb-4">
                  guest@chips:~$ {DEMO_COMMANDS.find(c => c.id === activeCmd)?.label}
                </div>
                
                <div className="text-[var(--term-green)] min-h-[200px]">
                  {cmdOutput}
                  {isTyping && <span className="animate-blink inline-block w-2 h-4 bg-[var(--term-green)] ml-1 align-middle"></span>}
                  {!isTyping && <span className="animate-blink text-[var(--term-text-muted)]">_</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold border-b border-[var(--term-green)] pb-2 inline-block">/// MODULES_OVERVIEW</h2>
            <div className="h-px bg-[var(--term-border)] flex-grow"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Real-time Gaming Info',
                icon: <Target className="w-6 h-6" />,
                commands: ['/slotcall', '/mostplayed', '/koth'],
                desc: 'Instantly query active game states, random slot recommendations, and King of the Hill status directly from the casino core.'
              },
              {
                title: 'Player Stats & Rankings',
                icon: <BarChart3 className="w-6 h-6" />,
                commands: ['/bigwins', '/luckiest', '/stats', '/banner'],
                desc: 'Track the degens. Pull high roller leaderboards, luckiest RTP metrics, and generate visual stat banners on demand.'
              },
              {
                title: 'Platform Updates',
                icon: <Activity className="w-6 h-6" />,
                commands: ['/promotions', '/prices', '/search'],
                desc: 'Stay plugged into live crypto market feeds, active platform promotions, and instantly search the entire game catalog.'
              },
              {
                title: 'Community Tools',
                icon: <MessageSquare className="w-6 h-6" />,
                commands: ['/chat', '/auth', '/help'],
                desc: 'Securely link your platform account, access help directories, and connect with the broader Chips community.'
              }
            ].map((feature, i) => (
              <div key={i} className="terminal-panel terminal-border p-6 hover:border-[var(--term-green)] transition-all group relative overflow-hidden">
                {/* Decorative corner brackets */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-transparent group-hover:border-[var(--term-green)] transition-colors"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-transparent group-hover:border-[var(--term-green)] transition-colors"></div>

                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 terminal-border bg-[var(--term-bg)] text-[var(--term-green)]">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--term-green)]">{feature.title}</h3>
                    <div className="text-xs text-[var(--term-text-muted)] mt-1 flex gap-2">
                      {feature.commands.map(c => <span key={c} className="bg-[var(--term-bg)] px-1 border border-[var(--term-border)]">{c}</span>)}
                    </div>
                  </div>
                </div>
                <p className="text-[var(--term-text-muted)] text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* AUTH EXPLAINER */}
        <section id="auth" className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold border-b border-[var(--term-green)] pb-2 inline-block">/// SECURE_AUTH</h2>
            <div className="h-px bg-[var(--term-border)] flex-grow"></div>
          </div>

          <div className="terminal-panel terminal-border p-8 relative">
            <Lock className="absolute top-8 right-8 w-16 h-16 text-[var(--term-border)] opacity-50" />
            <p className="text-lg text-[var(--term-text-muted)] mb-6 max-w-2xl">
              Link your Chips.gg account securely to enable advanced tracking and personalized stats. 
              Requires 2FA/TOTP enabled on your main account.
            </p>

            <div className="bg-[var(--term-bg)] terminal-border p-6 font-mono text-sm space-y-4">
              <div className="flex gap-4">
                <span className="text-[var(--term-text-muted)]">01.</span>
                <span className="text-gray-300">Enable 2FA/TOTP on your Chips.gg account settings.</span>
              </div>
              <div className="flex gap-4">
                <span className="text-[var(--term-text-muted)]">02.</span>
                <div className="space-y-2">
                  <span className="text-gray-300">Run the auth command in any supported channel:</span>
                  <div className="p-3 bg-black border border-[var(--term-border)] text-[var(--term-green)] flex items-center justify-between group">
                    <code>/auth username:<span className="text-white">YOUR_NAME</span> totp:<span className="text-white">YOUR_CODE</span></code>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="text-[var(--term-text-muted)]">03.</span>
                <span className="text-gray-300">Await system confirmation of successful handshake.</span>
              </div>
            </div>
          </div>
        </section>

        {/* SUPPORT / LINKS */}
        <section className="grid md:grid-cols-2 gap-6">
          <a href="https://discord.gg/chips" target="_blank" rel="noopener noreferrer" className="terminal-panel terminal-border p-6 flex items-center justify-between hover:bg-[var(--term-green-dim)] hover:border-[var(--term-green)] transition-all group">
            <div className="flex items-center gap-4">
              <MessageSquare className="w-8 h-8 text-[#5865F2]" />
              <div>
                <div className="font-bold text-lg">Discord Command Center</div>
                <div className="text-[var(--term-text-muted)] text-sm">discord.gg/chips</div>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-[var(--term-text-muted)] group-hover:text-[var(--term-green)]" />
          </a>

          <a href="https://t.me/chipsgg" target="_blank" rel="noopener noreferrer" className="terminal-panel terminal-border p-6 flex items-center justify-between hover:bg-[var(--term-green-dim)] hover:border-[var(--term-green)] transition-all group">
            <div className="flex items-center gap-4">
              <Send className="w-8 h-8 text-[#0088cc]" />
              <div>
                <div className="font-bold text-lg">Telegram Operations</div>
                <div className="text-[var(--term-text-muted)] text-sm">t.me/chipsgg</div>
              </div>
            </div>
            <ExternalLink className="w-5 h-5 text-[var(--term-text-muted)] group-hover:text-[var(--term-green)]" />
          </a>
        </section>

      </main>

      {/* FOOTER - REQUIRED */}
      <footer className="absolute bottom-0 w-full terminal-panel terminal-border-t py-6 mt-20">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-[var(--term-text-muted)]">
            <div className="w-2 h-2 rounded-full bg-[var(--term-green)]"></div>
            SYSTEM OPERATIONAL
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[var(--term-text-muted)]">Developed by</span>
            <a 
              href="https://redpkt.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[var(--term-green)] hover:text-white transition-colors font-bold tracking-widest border-b border-transparent hover:border-white"
            >
              REDPKT
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
