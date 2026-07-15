export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-12"
        style={{ background: '#0D1B2A' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0D9488, #0891B2)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 Q4 10 12 10 Q20 10 20 18" />
              <path d="M4 18h16" />
              <path d="M8 18v-4" />
              <path d="M16 18v-4" />
            </svg>
          </div>
          <span className="font-serif text-[19px]" style={{ color: '#F1F5F9' }}>ShiftBridge</span>
        </div>

        {/* Tagline */}
        <div>
          <p className="font-serif text-[38px] leading-[1.15]" style={{ color: '#F1F5F9' }}>
            Per diem nursing,<br />
            <span style={{ color: '#2DD4BF' }}>simplified.</span>
          </p>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: '#5B7A94' }}>
            Connect facilities with qualified nurses.<br />
            Track credentials. Fill shifts instantly.
          </p>
        </div>

        {/* Footer */}
        <p className="text-[12px]" style={{ color: '#3D5166' }}>
          © {new Date().getFullYear()} ShiftBridge
        </p>
      </div>

      {/* Right form area */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col" style={{ background: '#F4F7FA' }}>
        <div className="w-full max-w-[420px] mx-auto my-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div
              className="w-8 h-8 rounded-[8px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0D9488, #0891B2)' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2}
                viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 18 Q4 10 12 10 Q20 10 20 18" />
                <path d="M4 18h16" />
                <path d="M8 18v-4" />
                <path d="M16 18v-4" />
              </svg>
            </div>
            <span className="font-serif text-[17px]" style={{ color: '#0D1B2A' }}>ShiftBridge</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
