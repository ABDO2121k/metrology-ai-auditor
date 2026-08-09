'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  name?: string;
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  required = true,
  className = '',
  name
}: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative w-full">
      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 rtl:left-auto rtl:right-3.5" />
      <input
        type={showPassword ? 'text' : 'password'}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full pl-10 pr-10 rtl:pl-10 rtl:pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white outline-none focus:border-cyan-500 font-medium ${className}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-3.5 rtl:right-auto rtl:left-3 text-slate-500 hover:text-slate-300 transition"
        title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {showPassword ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
