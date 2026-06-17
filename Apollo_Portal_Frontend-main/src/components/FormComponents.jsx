import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const baseStyles =
    "font-semibold rounded-lg transition duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
    success: "bg-emerald-600 text-white hover:bg-emerald-500",
    outline: "border border-slate-700 text-slate-100 hover:bg-slate-800 bg-transparent",
    ghost: "text-slate-300 hover:bg-slate-800 bg-transparent",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-5 py-3 text-base",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && !loading && <Icon className="w-4 h-4" />}
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ label, error, icon: Icon, type = "text", placeholder, className = "", ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === "password" && showPassword ? "text" : type;

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-200 mb-2">{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />}
        <input
          type={inputType}
          placeholder={placeholder}
          className={`w-full ${Icon ? "pl-10" : "pl-3"} pr-3 py-3 border rounded-lg bg-slate-950/60 text-slate-100 placeholder-slate-500 ${
            error ? "border-red-500" : "border-slate-700"
          } focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          {...props}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-300 mt-1">{error}</p>}
    </div>
  );
}

export function Select({ label, error, options = [], className = "", ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-200 mb-2">{label}</label>}
      <select
        className={`w-full px-3 py-3 border rounded-lg bg-slate-950/60 text-slate-100 ${
          error ? "border-red-500" : "border-slate-700"
        } focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        {...props}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-300 mt-1">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = "", ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-200 mb-2">{label}</label>}
      <textarea
        className={`w-full px-3 py-3 border rounded-lg bg-slate-950/60 text-slate-100 placeholder-slate-500 ${
          error ? "border-red-500" : "border-slate-700"
        } focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-red-300 mt-1">{error}</p>}
    </div>
  );
}

export function Badge({ children, variant = "default", className = "" }) {
  const variants = {
    default: "bg-slate-800 text-slate-200 border border-slate-700",
    success: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
    danger: "bg-red-500/10 text-red-300 border border-red-500/30",
    info: "bg-blue-500/10 text-blue-300 border border-blue-500/30",
  };
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>{children}</span>;
}

export function Alert({ children, variant = "info", icon: Icon, className = "" }) {
  const variants = {
    success: "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-200 border border-amber-500/30",
    danger: "bg-red-500/10 text-red-200 border border-red-500/30",
    info: "bg-blue-500/10 text-blue-200 border border-blue-500/30",
  };
  return (
    <div className={`flex items-center gap-3 p-4 rounded-md ${variants[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      <div>{children}</div>
    </div>
  );
}

export function Card({ children, className = "", hover = true }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 ${hover ? "hover:border-slate-700" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children, actions = [] }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
        <div className="text-slate-300 mb-6">{children}</div>
        <div className="flex gap-3 justify-end">
          <button className="px-4 py-2 bg-slate-800 text-slate-100 rounded-md hover:bg-slate-700" onClick={onClose}>
            Cancel
          </button>
          {actions.map((action, idx) => (
            <button key={idx} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
