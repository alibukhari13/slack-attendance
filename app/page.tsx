import Link from "next/link";
import { Activity, Shield, Zap, Users, ArrowRight, CheckCircle, MessageSquare } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10">
        <nav className="px-8 py-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 h-10 w-10 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                Attendance Pro
              </span>
            </div>
            <div className="flex gap-4">
              <Link
                href="/channels"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Slack Channels
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300 flex items-center gap-2"
              >
                Launch Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </nav>
        
        <main className="max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/50 border border-gray-800 mb-8">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-gray-300">Enterprise Edition</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              Workforce Intelligence
            </span>
            <br />
            <span className="text-white">Reimagined</span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
            Premium attendance monitoring and analytics platform for modern enterprises. 
            Real-time insights, advanced reporting, and seamless workforce management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-300 flex items-center justify-center gap-3 group"
            >
              Open Dashboard
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/channels"
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 flex items-center justify-center gap-3 group"
            >
              <MessageSquare className="h-5 w-5" />
              Manage Slack Channels
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-gray-800 text-left hover:border-amber-500/30 transition-all duration-300">
              <div className="h-14 w-14 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                <Activity className="h-7 w-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Real-time Monitoring</h3>
              <p className="text-gray-400">Live tracking of employee attendance with instant notifications and alerts.</p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-gray-800 text-left hover:border-blue-500/30 transition-all duration-300">
              <div className="h-14 w-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Enterprise Security</h3>
              <p className="text-gray-400">Military-grade encryption and compliance with industry security standards.</p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-gray-800 text-left hover:border-green-500/30 transition-all duration-300">
              <div className="h-14 w-14 bg-green-500/10 rounded-xl flex items-center justify-center mb-6">
                <Users className="h-7 w-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Team Analytics</h3>
              <p className="text-gray-400">Advanced insights and reporting for workforce optimization and planning.</p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="mt-20 pt-20 border-t border-gray-800/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              {[
                { label: 'Active Users', value: '10K+' },
                { label: 'Daily Logs', value: '50K+' },
                { label: 'Accuracy', value: '99.9%' },
                { label: 'Uptime', value: '24/7' },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
        
        <footer className="border-t border-gray-800/50 mt-20 py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} Attendance Pro. Enterprise Workforce Intelligence Platform.</p>
            <p className="mt-2">Premium analytics and monitoring for modern organizations.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}